import { getDefaultDashboardDay, getHqDashboard, HqDashboardNotFoundError, type AuthorizedHqScope, type OutletStatus } from "@/features/hq/dashboard";
import { memoryStore } from "@/server/db/memory-store";
import type { Scope } from "@/shared/types/scope";
import type { BusinessDay } from "@/shared/time/business-day";

export class OperationsMapQueryError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) { super(message); this.name = "OperationsMapQueryError"; }
}

export type LocationFreshness = "current" | "recent" | "stale" | "unknown";
export type MapPositionSource = "LOCATION_REPORT" | "SHIFT_START" | "CONFIGURED_SITE";

export interface OperationsMapMarker {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly coordinates: { readonly latitude: number; readonly longitude: number } | null;
  readonly coordinateStatus: "AVAILABLE" | "MISSING";
  readonly locationStatus: string;
  readonly operationalStatus: OutletStatus;
  readonly hasActiveShift: boolean;
  readonly positionSource: MapPositionSource;
  readonly positionAt: string | null;
  readonly freshnessBand: LocationFreshness;
  readonly salesMinor: number;
  readonly transactionCount: number;
  readonly openIncidentCount: number;
}

export interface OperationsMapInput {
  readonly scope: Scope;
  readonly businessDay?: BusinessDay;
  readonly areaId?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly now?: Date;
}

function validCoordinates(latitude: unknown, longitude: unknown): { latitude: number; longitude: number } | null {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function freshnessAt(positionAt: Date | undefined, now: Date): LocationFreshness {
  if (!(positionAt instanceof Date) || !Number.isFinite(positionAt.getTime())) return "unknown";
  const ageMs = Math.max(0, now.getTime() - positionAt.getTime());
  if (ageMs < 5 * 60_000) return "current";
  if (ageMs < 60 * 60_000) return "recent";
  return "stale";
}

function latestDate(current: Date | null, candidate: Date | undefined): Date | null {
  if (!(candidate instanceof Date) || !Number.isFinite(candidate.getTime())) return current;
  return !current || candidate > current ? candidate : current;
}

function mapPositionReport(shiftId: string, organizationId: string) {
  return Array.from(memoryStore.locationReports.values())
    .filter((report) => report.organizationId === organizationId && report.shiftId === shiftId && !report.departedAt)
    .sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime())[0];
}

/**
 * Projects the authenticated HQ dashboard's scoped selling-point rows into a privacy-minimal map
 * contract. Markers represent configured places and explicit shift reports, never a person/device.
 */
export function getOperationsMap(input: OperationsMapInput) {
  const authorizedScope = input.scope as AuthorizedHqScope; // Callers authorize the session before invoking this projection.
  const now = input.now ?? new Date();
  const businessDay = input.businessDay ?? getDefaultDashboardDay(now);
  const limit = input.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new OperationsMapQueryError("Map limit must be between 1 and 100");
  if (input.cursor && input.cursor.length > 160) throw new OperationsMapQueryError("Map cursor is invalid");

  const dashboard = getHqDashboard({
    scope: authorizedScope,
    businessDay,
    areaId: input.areaId,
    cursor: input.cursor,
    limit,
  });
  // The existing dashboard cursor helper restarts on unknown IDs. Reject that case rather than
  // silently serving the first page; these options have already been session-scope resolved.
  if (input.cursor && !dashboard.outletOptions.some((outlet) => outlet.id === input.cursor)) {
    throw new OperationsMapQueryError("Map cursor is not valid for this scope and filter");
  }

  const scopeDashboard = input.areaId
    ? getHqDashboard({ scope: authorizedScope, businessDay, limit: 1 })
    : dashboard;
  const activeShiftById = new Map<string, string>();
  const markerParts = dashboard.outlets.map((row) => {
    const location = memoryStore.sellingLocations.get(row.id);
    const shift = row.activeShiftId ? memoryStore.shifts.get(row.activeShiftId) : undefined;
    const report = shift && shift.organizationId === authorizedScope.organizationId ? mapPositionReport(shift.id, authorizedScope.organizationId) : undefined;
    const positionAt = report?.arrivedAt ?? (shift ? shift.startedAt : undefined);
    const positionSource: MapPositionSource = report ? "LOCATION_REPORT" : shift ? "SHIFT_START" : "CONFIGURED_SITE";
    if (row.activeShiftId && shift?.organizationId === authorizedScope.organizationId) activeShiftById.set(row.activeShiftId, row.id);
    let sourceWatermark: Date | null = latestDate(null, dashboard.sourceWatermark ? new Date(dashboard.sourceWatermark) : undefined);
    sourceWatermark = latestDate(sourceWatermark, location?.updatedAt);
    sourceWatermark = latestDate(sourceWatermark, shift?.updatedAt);
    sourceWatermark = latestDate(sourceWatermark, report?.arrivedAt);
    return {
      row,
      location,
      shift,
      report,
      positionAt,
      positionSource,
      sourceWatermark,
    };
  });

  const incidentCounts = new Map<string, number>();
  let sourceWatermark: Date | null = null;
  for (const part of markerParts) sourceWatermark = latestDate(sourceWatermark, part.sourceWatermark ?? undefined);
  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== authorizedScope.organizationId || !incident.shiftId || !activeShiftById.has(incident.shiftId)) continue;
    if (incident.status === "CLOSED" || incident.status === "RESOLVED") continue;
    const outletId = activeShiftById.get(incident.shiftId)!;
    incidentCounts.set(outletId, (incidentCounts.get(outletId) ?? 0) + 1);
    sourceWatermark = latestDate(sourceWatermark, incident.updatedAt);
  }

  const markers: OperationsMapMarker[] = markerParts.map(({ row, location, positionAt, positionSource }) => {
    const coordinates = validCoordinates(location?.lat, location?.lng);
    return {
      id: row.id,
      name: row.name,
      areaId: row.areaId,
      coordinates,
      coordinateStatus: coordinates ? "AVAILABLE" : "MISSING",
      locationStatus: location?.status ?? "INACTIVE",
      operationalStatus: row.status,
      hasActiveShift: Boolean(row.activeShiftId),
      positionSource,
      positionAt: positionAt instanceof Date && Number.isFinite(positionAt.getTime()) ? positionAt.toISOString() : null,
      freshnessBand: freshnessAt(positionAt, now),
      salesMinor: row.salesMinor,
      transactionCount: row.transactionCount,
      openIncidentCount: incidentCounts.get(row.id) ?? 0,
    };
  });
  const staleLocationCount = markers.filter((marker) => marker.hasActiveShift && marker.freshnessBand === "stale").length;
  const activeSellingPoints = markers.filter((marker) => marker.hasActiveShift).length;
  const openIncidentCount = markers.reduce((sum, marker) => sum + marker.openIncidentCount, 0);

  return {
    generatedAt: now.toISOString(),
    sourceWatermark: sourceWatermark?.toISOString() ?? null,
    businessDay,
    filters: { areaId: input.areaId ?? null },
    summary: {
      visibleSellingPoints: dashboard.pagination.total,
      activeSellingPoints,
      locationsWithCoordinates: markers.filter((marker) => marker.coordinates !== null).length,
      activePointsWithoutCoordinates: markers.filter((marker) => marker.hasActiveShift && marker.coordinates === null).length,
      staleLocationCount,
      openIncidentsOnActiveShifts: openIncidentCount,
    },
    freshness: { currentWithinMinutes: 5, recentWithinMinutes: 60 },
    areas: scopeDashboard.outletOptions
      .map(({ areaId }) => areaId)
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort()
      .map((id) => ({ id, label: `Area ${id}` })),
    markers,
    pagination: { limit, total: dashboard.pagination.total, nextCursor: dashboard.pagination.nextCursor },
  };
}

export { HqDashboardNotFoundError };
