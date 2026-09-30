import type { SessionContext } from "@/server/auth/port";
import { getOperatorLocationContext } from "@/features/locations";
import { getTrafficSamplingPage } from "@/features/traffic-sampling";
import { listTransactions } from "@/features/sales/transactions";
import { deriveSiteConditionCue } from "@/domain/site-condition";
import type { SiteConditionObservationRequest } from "@/shared/contracts/site-condition";
import {
  generateId,
  memoryStore,
  type StoredSiteConditionObservation,
} from "@/server/db/memory-store";
import { noWeatherSnapshot, unavailableWeatherAdapter, type WeatherAdapter } from "@/server/weather/weather-adapter";
import { writeAuditEvent } from "@/features/audit";

const observationKey = (organizationId: string, clientRequestId: string) => `${organizationId}|${clientRequestId}`;
export const SITE_CONDITION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export function purgeExpiredSiteConditionObservations(now = new Date()): number {
  const cutoff = now.getTime() - SITE_CONDITION_RETENTION_MS;
  let deleted = 0;
  for (const [id, row] of memoryStore.siteConditionObservations) {
    if (row.observedAt.getTime() > cutoff) continue;
    memoryStore.siteConditionObservations.delete(id);
    memoryStore.siteConditionObservationByClientId.delete(observationKey(row.organizationId, row.clientRequestId));
    deleted += 1;
  }
  return deleted;
}

function assertOperatorSession(session: SessionContext): string {
  if (!session.roles.includes("OPERATOR") || !session.operatorId || session.scope.kind !== "self" ||
      session.scope.organizationId !== session.organizationId || session.scope.operatorId !== session.operatorId) {
    throw Object.assign(new Error("Operator self scope required"), { code: "FORBIDDEN" });
  }
  return session.operatorId;
}

function serializeObservation(row: StoredSiteConditionObservation) {
  return {
    observedAt: row.observedAt.toISOString(),
    groundCondition: row.groundCondition,
    shelterStatus: row.shelterStatus,
    shelterNote: row.shelterNote ?? null,
    relocationDecisionNote: row.relocationDecisionNote ?? null,
  };
}

export async function getSiteConditionPage(
  session: SessionContext,
  options: { now?: Date; weatherAdapter?: WeatherAdapter } = {},
) {
  const now = options.now ?? new Date();
  assertOperatorSession(session);
  purgeExpiredSiteConditionObservations(now);
  const context = getOperatorLocationContext(session.scope, now);
  const currentLocation = context.currentLocation;
  const activeShift = context.activeShift;
  const weather = currentLocation
    ? await (options.weatherAdapter ?? unavailableWeatherAdapter).currentForSite({
      organizationId: session.organizationId,
      sellingLocationId: currentLocation.sellingLocationId,
    })
    : noWeatherSnapshot;

  const observations = currentLocation
    ? [...memoryStore.siteConditionObservations.values()]
      .filter((row) => row.organizationId === session.organizationId && row.sellingLocationId === currentLocation.sellingLocationId)
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || b.id.localeCompare(a.id))
      .slice(0, 5)
      .map(serializeObservation)
    : [];
  const latestObservation = observations[0] ?? null;
  const assessment = deriveSiteConditionCue({
    observation: latestObservation ? {
      observedAt: new Date(latestObservation.observedAt),
      groundCondition: latestObservation.groundCondition,
      shelterStatus: latestObservation.shelterStatus,
    } : null,
    now,
  });

  let recentTraffic: {
    status: "NO_CURRENT_LOCATION" | "FEATURE_DISABLED" | "EMPTY" | "AVAILABLE";
    samples: Array<{ sampledAt: string; estimatedCount: number; trafficBand: string }>;
  } = { status: "NO_CURRENT_LOCATION", samples: [] };
  if (currentLocation && activeShift) {
    const traffic = await getTrafficSamplingPage(session.scope, now);
    if (!traffic.enabled) {
      recentTraffic = { status: "FEATURE_DISABLED", samples: [] };
    } else {
      const samples = traffic.history.slice(0, 5).map(({ sampledAt, estimatedCount, trafficBand }) => ({
        sampledAt,
        estimatedCount,
        trafficBand,
      }));
      recentTraffic = { status: samples.length ? "AVAILABLE" : "EMPTY", samples };
    }
  }

  let recentSales: {
    status: "NO_CURRENT_LOCATION" | "NO_ACTIVE_SHIFT" | "EMPTY" | "AVAILABLE";
    sourceScope: "ACTIVE_SHIFT_AND_LOCATION";
    records: Array<{ occurredAt: string; totalMinor: number; currency: "IDR"; status: string }>;
    truncated: boolean;
  } = { status: "NO_CURRENT_LOCATION", sourceScope: "ACTIVE_SHIFT_AND_LOCATION", records: [], truncated: false };
  if (activeShift && currentLocation) {
    const transactions = listTransactions(session, { businessDay: activeShift.businessDay, limit: 100 });
    const siteSales = transactions.data
      .filter((sale) => {
        const storedSale = memoryStore.sales.get(sale.id);
        return sale.shiftId === activeShift.shiftId &&
          storedSale?.organizationId === session.organizationId &&
          storedSale.shiftId === activeShift.shiftId &&
          storedSale.sellingLocationId === currentLocation.sellingLocationId;
      })
      .slice(0, 5)
      .map((sale) => ({
        occurredAt: sale.occurredAt,
        totalMinor: sale.totalMinor,
        currency: "IDR" as const,
        status: sale.status,
      }));
    recentSales = {
      status: siteSales.length ? "AVAILABLE" : "EMPTY",
      sourceScope: "ACTIVE_SHIFT_AND_LOCATION",
      records: siteSales,
      truncated: transactions.total > transactions.limit,
    };
  } else if (activeShift) {
    recentSales = { status: "NO_CURRENT_LOCATION", sourceScope: "ACTIVE_SHIFT_AND_LOCATION", records: [], truncated: false };
  } else {
    recentSales = { status: "NO_ACTIVE_SHIFT", sourceScope: "ACTIVE_SHIFT_AND_LOCATION", records: [], truncated: false };
  }

  return {
    generatedAt: now.toISOString(),
    environment: process.env.NODE_ENV === "production" ? "PRODUCTION" as const : "DEVELOPMENT" as const,
    activeShift: activeShift ? { businessDay: activeShift.businessDay, startedAt: activeShift.startedAt, stallCode: activeShift.stallCode } : null,
    currentLocation: currentLocation ? { name: currentLocation.name, status: currentLocation.status } : null,
    weather,
    recentTraffic,
    recentSales,
    observations,
    assessment: {
      ...assessment,
      source: "OPERATOR_OBSERVATION_ONLY" as const,
      weatherIntegrated: false as const,
    },
  };
}

export async function createSiteConditionObservation(input: {
  session: SessionContext;
  request: SiteConditionObservationRequest;
  requestId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const operatorId = assertOperatorSession(input.session);
  purgeExpiredSiteConditionObservations(now);
  const context = getOperatorLocationContext(input.session.scope, now);
  if (!context.activeShift || !context.currentLocation) {
    throw Object.assign(new Error("An active shift and current selling point are required"), { code: "PRECONDITION_FAILED" });
  }

  const indexKey = observationKey(input.session.organizationId, input.request.clientRequestId);
  const priorId = memoryStore.siteConditionObservationByClientId.get(indexKey);
  if (priorId) {
    const prior = memoryStore.siteConditionObservations.get(priorId);
    const matches = prior && prior.operatorId === operatorId && prior.shiftId === context.activeShift.shiftId &&
      prior.sellingLocationId === context.currentLocation.sellingLocationId &&
      prior.groundCondition === input.request.groundCondition && prior.shelterStatus === input.request.shelterStatus &&
      prior.shelterNote === (input.request.shelterNote || undefined) &&
      prior.relocationDecisionNote === (input.request.relocationDecisionNote || undefined);
    if (!matches) {
      throw Object.assign(new Error("Request ID was already used for a different observation"), { code: "IDEMPOTENCY_MISMATCH" });
    }
    return { observation: serializeObservation(prior), replayed: true as const };
  }

  const row: StoredSiteConditionObservation = {
    id: generateId(),
    organizationId: input.session.organizationId,
    operatorId,
    shiftId: context.activeShift.shiftId,
    sellingLocationId: context.currentLocation.sellingLocationId,
    observedAt: now,
    groundCondition: input.request.groundCondition,
    shelterStatus: input.request.shelterStatus,
    ...(input.request.shelterNote ? { shelterNote: input.request.shelterNote } : {}),
    ...(input.request.relocationDecisionNote ? { relocationDecisionNote: input.request.relocationDecisionNote } : {}),
    clientRequestId: input.request.clientRequestId,
    createdAt: now,
  };
  memoryStore.siteConditionObservations.set(row.id, row);
  memoryStore.siteConditionObservationByClientId.set(indexKey, row.id);
  await writeAuditEvent({
    organizationId: row.organizationId,
    actorKind: "OPERATOR",
    actorId: operatorId,
    action: "site_condition.observation_saved",
    subjectKind: "site_condition_observation",
    subjectId: row.id,
    correlationId: input.requestId,
    occurredAt: now,
    afterSummary: {
      groundCondition: row.groundCondition,
      shelterStatus: row.shelterStatus,
      hasShelterNote: Boolean(row.shelterNote),
      hasRelocationDecisionNote: Boolean(row.relocationDecisionNote),
    },
  });
  return { observation: serializeObservation(row), replayed: false as const };
}
