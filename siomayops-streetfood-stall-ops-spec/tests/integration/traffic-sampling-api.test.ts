import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "@/app/api/v1/operators/me/traffic-sampling/route";
import { POST as postSample } from "@/app/api/v1/operators/me/traffic-samples/route";
import { POST as postUpload } from "@/app/api/v1/operators/me/traffic-samples/uploads/route";
import { POST as postEvent } from "@/app/api/v1/operators/me/traffic-sampling/events/route";
import { createTrafficSample, purgeExpiredTrafficMedia, uploadTrafficVideo } from "@/features/traffic-sampling";
import { isTrafficSamplingEnabled } from "@/features/traffic-sampling/policy";
import { memoryStore } from "@/server/db/memory-store";
import { logger } from "@/server/telemetry/logger";

const orgId = "10000000-0000-7000-0000-000000000001";
const areaId = "20000000-0000-7000-0000-000000000001";
const operatorId = "30000000-0000-7000-0000-000000000001";
const otherOperatorId = "30000000-0000-7000-0000-000000000002";
const stallId = "40000000-0000-7000-0000-000000000001";
const shiftId = "50000000-0000-7000-0000-000000000001";
const locationId = "60000000-0000-7000-0000-000000000001";
const otherLocationId = "60000000-0000-7000-0000-000000000002";
const now = new Date("2026-09-30T08:17:00.000Z");
let mediaDir = "";

function seed() {
  for (const id of [operatorId, otherOperatorId]) {
    memoryStore.operators.set(id, { id, organizationId: orgId, areaId, name: "Operator", phoneE164: "+620000000001", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now });
  }
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "PDG-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Pasar Raya", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId, name: "Area lain", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-1", version: 1, createdAt: now, updatedAt: now });
}

const jsonRequest = (url: string, body: unknown, method = "POST") => new NextRequest(`http://localhost${url}`, {
  method,
  headers: { "Content-Type": "application/json", ...(typeof body === "object" && body && "clientRequestId" in body ? { "Idempotency-Key": String((body as any).clientRequestId) } : {}) },
  body: JSON.stringify(body),
});
const sampleBody = (clientRequestId = "70000000-0000-7000-0000-000000000001", estimatedCount = 12) => ({ clientRequestId, estimatedCount, note: "Hujan ringan" });

beforeEach(() => {
  vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
  vi.stubEnv("TRAFFIC_SAMPLING_ENABLED", "true");
  vi.stubEnv("NODE_ENV", "test");
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "siomay-traffic-"));
  vi.stubEnv("SIOMAYOPS_PRIVATE_MEDIA_DIR", mediaDir);
  memoryStore.clear();
  seed();
});
afterEach(() => {
  memoryStore.clear();
  fs.rmSync(mediaDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Page 11 authenticated API and persistence", () => {
  it("serves current self outlet context and same-location history without operator/shift linkage", async () => {
    const sample = await createTrafficSample({ scope: { kind: "self", organizationId: orgId, operatorId }, clientRequestId: "70000000-0000-7000-0000-000000000002", estimatedCount: 8, now });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentLocation).toMatchObject({ sellingLocationId: locationId, name: "Pasar Raya" });
    expect(body.activeShift).toMatchObject({ shiftId, stallCode: "PDG-01" });
    expect(body.history[0]).toMatchObject({ id: sample.id, estimatedCount: 8, trafficBand: "STEADY" });
    expect(body.history[0]).not.toHaveProperty("operatorId");
    expect(body.history[0]).not.toHaveProperty("shiftId");
    expect(body.history[0].sampledAt).toBe("2026-09-30T08:00:00.000Z");
  });

  it("fails closed when unauthenticated or when a non-operator requests the self route", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await GET()).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    expect((await GET()).status).toBe(403);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", "10000000-0000-7000-0000-000000000099");
    expect((await GET()).status).toBe(404);
    vi.stubEnv("FAKE_ORG_ID", orgId);
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    const unauthorized = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", sampleBody()));
    expect(unauthorized.status).toBe(403);
  });

  it("persists manual samples, writes anonymous system audit, and rejects idempotency collisions", async () => {
    const info = vi.spyOn(logger, "info");
    const first = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", sampleBody()));
    expect(first.status).toBe(201);
    const body = await first.json();
    expect(body.sample).toMatchObject({ estimatedCount: 12, trafficBand: "BUSY", videoStatus: "NOT_PROVIDED" });
    expect(memoryStore.trafficSamples.size).toBe(1);
    const audit = memoryStore.auditEvents.find((entry) => entry.action === "traffic.sample_recorded");
    expect(audit).toMatchObject({ actorKind: "SYSTEM", entityType: "traffic_sample" });
    expect(audit?.actorId).toBeUndefined();
    expect(audit?.newValueJson).not.toContain("12");

    const replay = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", sampleBody()));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.trafficSamples.size).toBe(1);
    expect(info.mock.calls.filter(([, context]) => (context as any).eventName === "traffic_analysis_completed")).toHaveLength(1);
    const mismatch = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", sampleBody(undefined, 13)));
    expect(mismatch.status).toBe(422);
    expect(memoryStore.trafficSamples.size).toBe(1);
  });

  it("rejects invalid count and body fields before persistence", async () => {
    const badCount = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", sampleBody("70000000-0000-7000-0000-000000000003", 501)));
    expect(badCount.status).toBe(400);
    const extraField = await postSample(jsonRequest("/api/v1/operators/me/traffic-samples", { ...sampleBody("70000000-0000-7000-0000-000000000004"), operatorId: otherOperatorId }));
    expect(extraField.status).toBe(400);
    expect(memoryStore.trafficSamples.size).toBe(0);
  });

  it("keeps traffic history scoped to the server-derived current location", async () => {
    await createTrafficSample({ scope: { kind: "self", organizationId: orgId, operatorId }, clientRequestId: "70000000-0000-7000-0000-000000000005", estimatedCount: 3, now });
    memoryStore.shifts.set(shiftId, { ...memoryStore.shifts.get(shiftId)!, startLocationId: otherLocationId });
    const response = await GET();
    expect((await response.json()).history).toEqual([]);
  });

  it("accepts same-origin WebM uploads only for an authenticated operator and is idempotent", async () => {
    const info = vi.spyOn(logger, "info");
    const makeUpload = (key: string, payload = [0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x86, 0x81]) => {
      const form = new FormData();
      form.append("video", new Blob([new Uint8Array(payload)], { type: "video/webm" }), "ignored-client-name.webm");
      form.append("durationMs", "8500");
      return new NextRequest("http://localhost/api/v1/operators/me/traffic-samples/uploads", {
        method: "POST", headers: { "Idempotency-Key": key }, body: form,
      });
    };
    const key = "70000000-0000-7000-0000-000000000009";
    const first = await postUpload(makeUpload(key));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    const replay = await postUpload(makeUpload(key));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect((await replay.json()).uploadId).toBe(firstBody.uploadId);
    expect(info.mock.calls.filter(([, context]) => (context as any).eventName === "traffic_sample_uploaded")).toHaveLength(1);
    expect(memoryStore.trafficVideoAssets.size).toBe(1);
    expect(fs.readdirSync(mediaDir)).toEqual([`${firstBody.uploadId}.webm`]);

    const noKey = await postUpload(makeUpload(""));
    expect(noKey.status).toBe(400);
  });

  it("rejects attaching a valid upload from another current selling point", async () => {
    const scope = { kind: "self" as const, organizationId: orgId, operatorId };
    const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x86, 0x81]);
    const uploaded = await uploadTrafficVideo({ scope, bytes, durationMs: 8_000, contentType: "video/webm", clientRequestId: "70000000-0000-7000-0000-000000000012", now });
    memoryStore.shifts.set(shiftId, { ...memoryStore.shifts.get(shiftId)!, startLocationId: otherLocationId });
    await expect(createTrafficSample({ scope, clientRequestId: "70000000-0000-7000-0000-000000000013", estimatedCount: 4, videoUploadId: uploaded.uploadId, now })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(memoryStore.trafficSamples.size).toBe(0);
  });

  it("validates WebM signatures/size/duration and deletes raw objects within 24h, detaching result metadata", async () => {
    const scope = { kind: "self" as const, organizationId: orgId, operatorId };
    const invalidBytes = Buffer.from("not-a-video");
    await expect(uploadTrafficVideo({ scope, bytes: invalidBytes, durationMs: 5000, contentType: "video/webm", clientRequestId: "70000000-0000-7000-0000-000000000007", now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x86, 0x81]);
    const uploaded = await uploadTrafficVideo({ scope, bytes, durationMs: 10_000, contentType: "video/webm", clientRequestId: "70000000-0000-7000-0000-000000000008", now });
    expect(uploaded.status).toBe("UPLOADED");
    expect(fs.existsSync(path.join(mediaDir, `${uploaded.uploadId}.webm`))).toBe(true);
    const asset = memoryStore.trafficVideoAssets.get(uploaded.uploadId)!;
    expect(asset).not.toHaveProperty("operatorId");
    expect(asset).not.toHaveProperty("shiftId");
    const sample = await createTrafficSample({ scope, clientRequestId: "70000000-0000-7000-0000-000000000006", estimatedCount: 9, videoUploadId: uploaded.uploadId, now });
    expect(sample.videoStatus).toBe("UPLOADED");
    const purge = await purgeExpiredTrafficMedia(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    expect(purge).toMatchObject({ deleted: 1, failures: 0 });
    expect(fs.existsSync(path.join(mediaDir, `${uploaded.uploadId}.webm`))).toBe(false);
    expect(memoryStore.trafficVideoAssets.has(uploaded.uploadId)).toBe(false);
    const storedSample = memoryStore.trafficSamples.get(sample.id)!;
    expect(storedSample.videoStatus).toBe("DELETED");
    expect(storedSample.videoAssetId).toBeUndefined();
    expect(storedSample).not.toHaveProperty("operatorId");
    expect(storedSample).not.toHaveProperty("shiftId");
  });

  it("logs only allowlisted event fields and rejects added identity properties", async () => {
    const info = vi.spyOn(logger, "info");
    const valid = await postEvent(jsonRequest("/api/v1/operators/me/traffic-sampling/events", { event: "traffic_sample_started" }));
    expect(valid.status).toBe(202);
    const invalid = await postEvent(jsonRequest("/api/v1/operators/me/traffic-sampling/events", { event: "traffic_sample_started", operatorId }));
    expect(invalid.status).toBe(400);
    expect(JSON.stringify(info.mock.calls)).not.toContain(operatorId);
  });

  it("hard-disables sampling in production even when environment flags are mistakenly set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAFFIC_SAMPLING_ENABLED", "true");
    vi.stubEnv("TRAFFIC_SAMPLING_PRIVACY_APPROVED", "true");
    vi.stubEnv("TRAFFIC_SAMPLING_PURGE_VERIFIED", "true");
    expect(isTrafficSamplingEnabled()).toBe(false);
  });
});
