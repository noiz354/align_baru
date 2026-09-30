/** PHASE 0 — Page 11 use cases; all reads/writes are scoped from the server session. */
import { getOperatorLocationContext } from "@/features/locations";
import { deriveTrafficBand, floorToTrafficHour } from "@/domain/traffic-sample";
import {
  memoryStore,
  generateId,
  TRAFFIC_SAMPLE_RETENTION_MS,
  TRAFFIC_VIDEO_RETENTION_MS,
  type StoredTrafficSample,
  type StoredTrafficVideoAsset,
} from "@/server/db/memory-store";
import type { Scope } from "@/shared/types/scope";
import { deleteTrafficVideo, storeTrafficVideo } from "@/server/storage/traffic-video-store";
import { isTrafficSamplingEnabled } from "./policy";
import { logger } from "@/server/telemetry/logger";
import { writeAuditEvent } from "@/features/audit";
import { TRAFFIC_VIDEO_MAX_BYTES, TRAFFIC_VIDEO_MAX_DURATION_MS } from "@/shared/contracts/traffic-samples";

const activeLocation = (scope: Scope, now: Date) => {
  if (scope.kind !== "self" || !scope.operatorId) {
    throw Object.assign(new Error("Self operator scope required"), { code: "FORBIDDEN" });
  }
  const context = getOperatorLocationContext(scope, now);
  if (!context.activeShift || !context.currentLocation) {
    throw Object.assign(new Error("An active shift and current selling point are required"), { code: "PRECONDITION_FAILED" });
  }
  return { context, locationId: context.currentLocation.sellingLocationId };
};

const sampleKey = (organizationId: string, clientRequestId: string): string => `${organizationId}|${clientRequestId}`;

export const getTrafficSamplingPage = async (scope: Scope, now = new Date()) => {
  await purgeExpiredTrafficMedia(now);
  const { context, locationId } = activeLocation(scope, now);
  const history = [...memoryStore.trafficSamples.values()]
    .filter((sample) => sample.organizationId === scope.organizationId && sample.sellingLocationId === locationId)
    .sort((a, b) => b.sampledAt.getTime() - a.sampledAt.getTime())
    .slice(0, 10)
    .map((sample) => ({
      id: sample.id,
      sampledAt: sample.sampledAt.toISOString(),
      estimatedCount: sample.estimatedCount,
      trafficBand: sample.trafficBand,
      note: sample.note ?? null,
      videoStatus: sample.videoStatus,
    }));
  return {
    enabled: isTrafficSamplingEnabled(),
    environment: process.env.NODE_ENV === "production" ? "PRODUCTION" as const : "DEVELOPMENT" as const,
    generatedAt: now.toISOString(),
    activeShift: context.activeShift,
    currentLocation: context.currentLocation,
    history,
  };
};

export const uploadTrafficVideo = async (input: {
  scope: Scope;
  bytes: Buffer;
  durationMs: number;
  contentType: string;
  clientRequestId: string;
  now?: Date;
}) => {
  const now = input.now ?? new Date();
  if (!isTrafficSamplingEnabled()) throw Object.assign(new Error("Traffic sampling is disabled"), { code: "FEATURE_DISABLED" });
  const { locationId } = activeLocation(input.scope, now);
  if (input.contentType !== "video/webm" || input.bytes.byteLength < 8 || input.bytes.byteLength > TRAFFIC_VIDEO_MAX_BYTES) {
    throw Object.assign(new Error("Unsupported or oversized video"), { code: "VALIDATION_FAILED" });
  }
  if (!Number.isInteger(input.durationMs) || input.durationMs < 1 || input.durationMs > TRAFFIC_VIDEO_MAX_DURATION_MS) {
    throw Object.assign(new Error("Video duration must be at most 10 seconds"), { code: "VALIDATION_FAILED" });
  }
  if (!input.bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    throw Object.assign(new Error("Video container is invalid"), { code: "VALIDATION_FAILED" });
  }

  const uploadIndexKey = sampleKey(input.scope.organizationId, input.clientRequestId);
  const existingUploadId = memoryStore.trafficVideoByClientId.get(uploadIndexKey);
  if (existingUploadId) {
    const existingUpload = memoryStore.trafficVideoAssets.get(existingUploadId);
    if (!existingUpload) {
      // Clear a stale reservation left by a failed write/restart, then allow a fresh attempt.
      memoryStore.trafficVideoByClientId.delete(uploadIndexKey);
    } else {
      if (existingUpload.expiresAt.getTime() <= now.getTime() ||
        existingUpload.byteSize !== input.bytes.byteLength || existingUpload.durationMs !== input.durationMs) {
        throw Object.assign(new Error("Upload request ID was already used for different media metadata"), { code: "IDEMPOTENCY_MISMATCH" });
      }
      return { uploadId: existingUpload.id, status: "UPLOADED" as const, uploadedAt: existingUpload.uploadedAt.toISOString(), expiresAt: existingUpload.expiresAt.toISOString(), replayed: true };
    }
  }

  const assetId = generateId();
  memoryStore.trafficVideoByClientId.set(uploadIndexKey, assetId);
  let storageKey: string;
  try {
    storageKey = await storeTrafficVideo({ assetId, bytes: input.bytes });
  } catch (error) {
    memoryStore.trafficVideoByClientId.delete(uploadIndexKey);
    throw error;
  }
  const asset: StoredTrafficVideoAsset = {
    id: assetId,
    organizationId: input.scope.organizationId,
    sellingLocationId: locationId,
    uploadedAt: now,
    expiresAt: new Date(now.getTime() + TRAFFIC_VIDEO_RETENTION_MS),
    contentType: "video/webm",
    byteSize: input.bytes.byteLength,
    durationMs: input.durationMs,
    clientRequestId: input.clientRequestId,
    storageKey,
  };
  memoryStore.trafficVideoAssets.set(asset.id, asset);
  return { uploadId: asset.id, status: "UPLOADED" as const, uploadedAt: now.toISOString(), expiresAt: asset.expiresAt.toISOString(), replayed: false };
};

export const createTrafficSample = async (input: {
  scope: Scope;
  clientRequestId: string;
  estimatedCount: number;
  note?: string;
  videoUploadId?: string;
  requestId?: string;
  idempotencyKey?: string;
  now?: Date;
}) => {
  const now = input.now ?? new Date();
  if (!isTrafficSamplingEnabled()) throw Object.assign(new Error("Traffic sampling is disabled"), { code: "FEATURE_DISABLED" });
  const { locationId } = activeLocation(input.scope, now);
  const trafficBand = deriveTrafficBand(input.estimatedCount);
  const cleanedNote = input.note?.trim() || undefined;
  const indexKey = sampleKey(input.scope.organizationId, input.clientRequestId);
  const existingId = memoryStore.trafficSampleByClientId.get(indexKey);
  if (existingId) {
    const existing = memoryStore.trafficSamples.get(existingId);
    const mediaReplayMatches = existing?.videoAssetId === input.videoUploadId ||
      (existing?.videoStatus === "DELETED" && !existing.videoAssetId && Boolean(input.videoUploadId));
    if (!existing || existing.sellingLocationId !== locationId || existing.estimatedCount !== input.estimatedCount ||
      existing.note !== cleanedNote || !mediaReplayMatches) {
      throw Object.assign(new Error("Request ID was already used for a different sample"), { code: "IDEMPOTENCY_MISMATCH" });
    }
    return { ...serializeSample(existing), replayed: true as const };
  }

  let asset: StoredTrafficVideoAsset | undefined;
  if (input.videoUploadId) {
    asset = memoryStore.trafficVideoAssets.get(input.videoUploadId);
    if (!asset || asset.organizationId !== input.scope.organizationId || asset.sellingLocationId !== locationId ||
      asset.expiresAt.getTime() <= now.getTime() || asset.sampleId) {
      throw Object.assign(new Error("Video upload is unavailable or already used"), { code: "NOT_FOUND" });
    }
  }

  // Deliberately store a coarse hour bucket; never persist operatorId or shiftId on sample metadata.
  const bucketedAt = floorToTrafficHour(now);
  const sample: StoredTrafficSample = {
    id: generateId(),
    organizationId: input.scope.organizationId,
    sellingLocationId: locationId,
    sampledAt: bucketedAt,
    estimatedCount: input.estimatedCount,
    trafficBand,
    ...(cleanedNote ? { note: cleanedNote } : {}),
    clientRequestId: input.clientRequestId,
    ...(asset ? { videoAssetId: asset.id } : {}),
    videoStatus: asset ? "UPLOADED" : "NOT_PROVIDED",
    createdAt: bucketedAt,
  };
  memoryStore.trafficSamples.set(sample.id, sample);
  memoryStore.trafficSampleByClientId.set(indexKey, sample.id);
  if (asset) memoryStore.trafficVideoAssets.set(asset.id, { ...asset, sampleId: sample.id });
  await writeAuditEvent({
    organizationId: input.scope.organizationId,
    actorKind: "SYSTEM",
    action: "traffic.sample_recorded",
    subjectKind: "traffic_sample",
    subjectId: sample.id,
    correlationId: input.requestId || generateId(),
    occurredAt: bucketedAt,
    afterSummary: { trafficBand, videoStatus: sample.videoStatus },
  });
  return { ...serializeSample(sample), replayed: false as const };
};

const serializeSample = (sample: StoredTrafficSample) => ({
  id: sample.id,
  sampledAt: sample.sampledAt.toISOString(),
  estimatedCount: sample.estimatedCount,
  trafficBand: sample.trafficBand,
  note: sample.note ?? null,
  videoStatus: sample.videoStatus,
});

export const purgeExpiredTrafficMedia = async (now = new Date()) => {
  let deleted = 0;
  let failures = 0;
  const videoCutoff = now.getTime();
  for (const [assetId, asset] of memoryStore.trafficVideoAssets) {
    if (asset.expiresAt.getTime() > videoCutoff) continue;
    try {
      await deleteTrafficVideo(asset.storageKey);
      memoryStore.trafficVideoAssets.delete(assetId);
      memoryStore.trafficVideoByClientId.delete(sampleKey(asset.organizationId, asset.clientRequestId));
      if (asset.sampleId) {
        const sample = memoryStore.trafficSamples.get(asset.sampleId);
        if (sample) {
          const { videoAssetId: _detachedAsset, ...withoutAssetLink } = sample;
          memoryStore.trafficSamples.set(sample.id, { ...withoutAssetLink, videoStatus: "DELETED" });
        }
      }
      deleted += 1;
    } catch (error) {
      failures += 1;
      logger.error("traffic_video_purge_failed", error, { correlationId: asset.id, route: "traffic-video-retention" });
    }
  }
  const sampleCutoff = now.getTime() - TRAFFIC_SAMPLE_RETENTION_MS;
  for (const [sampleId, sample] of memoryStore.trafficSamples) {
    if (sample.sampledAt.getTime() > sampleCutoff) continue;
    if (sample.videoAssetId) {
      const asset = memoryStore.trafficVideoAssets.get(sample.videoAssetId);
      if (asset) {
        try {
          await deleteTrafficVideo(asset.storageKey);
          memoryStore.trafficVideoAssets.delete(asset.id);
          memoryStore.trafficVideoByClientId.delete(sampleKey(asset.organizationId, asset.clientRequestId));
        } catch (error) {
          failures += 1;
          logger.error("traffic_video_purge_failed", error, { correlationId: asset.id, route: "traffic-video-retention" });
          continue;
        }
      }
    }
    memoryStore.trafficSamples.delete(sampleId);
    memoryStore.trafficSampleByClientId.delete(sampleKey(sample.organizationId, sample.clientRequestId));
  }
  return { deleted, failures };
};

const runtime = globalThis as typeof globalThis & { __trafficVideoRetentionTimer?: ReturnType<typeof setInterval> };
if (!runtime.__trafficVideoRetentionTimer) {
  runtime.__trafficVideoRetentionTimer = setInterval(() => {
    void purgeExpiredTrafficMedia().catch((error) => logger.error("traffic_video_retention_job_failed", error, { route: "traffic-video-retention" }));
  }, 15 * 60 * 1000);
  runtime.__trafficVideoRetentionTimer.unref?.();
}
