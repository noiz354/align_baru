import { memoryStore, generateId, purgeExpiredGpsSamples } from "../../server/db/memory-store";
import type { SellingLocationId, AreaId, ShiftId, OperatorId } from "../../shared/types/ids";
import type { Scope } from "../../shared/types/scope";
import type { LocationOperationalStatus, MoveReason, LocationReport, LocationGpsSample } from "../../domain/location";
import { validateLocationReport, validateLocationGpsSample, closeLocationReport as domainCloseReport } from "../../domain/location/report";
import { writeAuditEvent } from "../audit";
import { isGpsSampleCaptureEnabled } from "./gps-policy";

export interface SellingPoint {
  readonly sellingLocationId: SellingLocationId;
  readonly areaId: AreaId;
  readonly name: string;
  readonly addressText: string;
  readonly landmark?: string;
  readonly status: LocationOperationalStatus;
  readonly permissionVerifiedBy?: string;
  readonly permissionVerifiedAt?: Date;
  readonly organizationId: string;
}

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface OperatorLocationContext {
  readonly generatedAt: string;
  readonly gpsCaptureEnabled: boolean;
  readonly activeShift: null | {
    readonly shiftId: string;
    readonly businessDay: string;
    readonly startedAt: string;
    readonly stallCode: string;
  };
  readonly currentLocation: null | {
    readonly sellingLocationId: string;
    readonly name: string;
    readonly status: LocationOperationalStatus;
    readonly hasOpenReport: boolean;
  };
  readonly gpsSample: null | {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
    readonly capturedAt: string;
  };
  readonly locationChoices: readonly {
    readonly sellingLocationId: string;
    readonly name: string;
    readonly status: LocationOperationalStatus;
  }[];
}

/** Self-scoped Page 10 read model; never returns another operator's shift or precise sample. */
export function getOperatorLocationContext(scope: Scope, now = new Date()): OperatorLocationContext {
  if (scope.kind !== "self" || !scope.operatorId) {
    throw Object.assign(new Error("Self operator scope required"), { code: "FORBIDDEN" });
  }
  const operator = memoryStore.operators.get(scope.operatorId);
  if (!operator || operator.organizationId !== scope.organizationId) {
    throw Object.assign(new Error("Operator not found"), { code: "NOT_FOUND" });
  }
  if (!operator.active || operator.status !== "ACTIVE") {
    throw Object.assign(new Error("Operator is not active"), { code: "PRECONDITION_FAILED" });
  }
  purgeExpiredGpsSamples(now);

  const shifts = [...memoryStore.shifts.values()].filter((shift) =>
    shift.organizationId === scope.organizationId && shift.operatorId === scope.operatorId &&
    (shift.status === "OPEN" || shift.status === "PENDING_SYNC")
  );
  if (shifts.length > 1) {
    throw Object.assign(new Error("More than one active shift needs reconciliation"), { code: "CONFLICT" });
  }
  const shift = shifts[0];
  if (!shift) {
    return { generatedAt: now.toISOString(), gpsCaptureEnabled: isGpsSampleCaptureEnabled(), activeShift: null, currentLocation: null, gpsSample: null, locationChoices: [] };
  }

  const stall = memoryStore.stalls.get(shift.stallId);
  if (!stall || stall.organizationId !== scope.organizationId) {
    throw Object.assign(new Error("Active shift operation is unavailable"), { code: "PRECONDITION_FAILED" });
  }
  const openReport = [...memoryStore.locationReports.values()]
    .filter((report) => report.organizationId === scope.organizationId && report.shiftId === shift.id &&
      report.operatorId === scope.operatorId && !report.departedAt)
    .sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime())[0];
  const currentLocationId = openReport?.sellingLocationId ?? shift.startLocationId;
  const currentLocation = memoryStore.sellingLocations.get(currentLocationId);
  const locationChoices = [...memoryStore.sellingLocations.values()]
    .filter((location) => location.organizationId === scope.organizationId && location.areaId === stall.areaId && location.status !== "INACTIVE")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((location) => ({
      sellingLocationId: location.id,
      name: location.name,
      status: location.status as LocationOperationalStatus,
    }));

  return {
    generatedAt: now.toISOString(),
    gpsCaptureEnabled: isGpsSampleCaptureEnabled(),
    activeShift: {
      shiftId: shift.id,
      businessDay: shift.businessDay,
      startedAt: shift.startedAt.toISOString(),
      stallCode: stall.code,
    },
    currentLocation: currentLocation && currentLocation.organizationId === scope.organizationId ? {
      sellingLocationId: currentLocation.id,
      name: currentLocation.name,
      status: currentLocation.status as LocationOperationalStatus,
      hasOpenReport: Boolean(openReport),
    } : null,
    gpsSample: openReport?.gpsSample ? {
      latitude: openReport.gpsSample.latitude,
      longitude: openReport.gpsSample.longitude,
      accuracyMeters: openReport.gpsSample.accuracyMeters,
      capturedAt: openReport.gpsSample.capturedAt.toISOString(),
    } : null,
    locationChoices,
  };
}

export async function createSellingPoint(input: {
  areaId: AreaId; name: string; addressText: string; landmark?: string; organizationId?: string;
}): Promise<SellingPoint> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const now = new Date();
  memoryStore.sellingLocations.set(id, {
    id,
    organizationId: orgId,
    areaId: input.areaId,
    name: input.name,
    addressText: input.addressText,
    status: "AVAILABLE",
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    action: "location.status_changed",
    subjectKind: "selling_location",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { name: input.name, status: "AVAILABLE" },
  });
  return {
    sellingLocationId: id,
    areaId: input.areaId,
    name: input.name,
    addressText: input.addressText,
    landmark: input.landmark,
    status: "AVAILABLE",
    organizationId: orgId,
  };
}

export async function setLocationStatus(input: {
  sellingLocationId: SellingLocationId; to: LocationOperationalStatus; reason: string; expiresAt?: Date; actorId?: string; organizationId?: string;
}): Promise<SellingPoint> {
  const loc = memoryStore.sellingLocations.get(input.sellingLocationId);
  if (!loc) throw Object.assign(new Error("Location not found"), { code: "NOT_FOUND" });
  if (input.to === "RESTRICTED" && !input.reason) {
    throw new Error("RESTRICTED requires reason");
  }
  const prev = loc.status;
  loc.status = input.to as any;
  loc.updatedAt = new Date();
  memoryStore.sellingLocations.set(loc.id, loc);
  await writeAuditEvent({
    organizationId: loc.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    action: "location.status_changed",
    subjectKind: "selling_location",
    subjectId: loc.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: input.to },
  });
  return {
    sellingLocationId: loc.id,
    areaId: loc.areaId,
    name: loc.name,
    addressText: loc.addressText || "",
    status: loc.status as LocationOperationalStatus,
    organizationId: loc.organizationId,
  };
}

export async function reportLocation(input: {
  shiftId: ShiftId; sellingLocationId: SellingLocationId; trigger: LocationReport["trigger"];
  reasonForMove?: MoveReason; note?: string; clientReportId: string; operatorId: string;
  organizationId?: string; gpsSample?: LocationGpsSample;
}): Promise<{ readonly locationReportId: string; readonly gpsSampleStored: boolean }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift || shift.organizationId !== orgId) {
    throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  }
  if (!input.operatorId || shift.operatorId !== input.operatorId) {
    throw Object.assign(new Error("Shift is not owned by this operator"), { code: "FORBIDDEN" });
  }
  const operator = memoryStore.operators.get(input.operatorId);
  if (!operator || operator.organizationId !== orgId) {
    throw Object.assign(new Error("Operator not found"), { code: "NOT_FOUND" });
  }
  if (!operator.active || operator.status !== "ACTIVE") {
    throw Object.assign(new Error("Operator is not active"), { code: "PRECONDITION_FAILED" });
  }
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error("Shift not active"), { code: "PRECONDITION_FAILED" });
  }
  const stall = memoryStore.stalls.get(shift.stallId);
  if (!stall || stall.organizationId !== orgId) {
    throw Object.assign(new Error("Shift operation not found"), { code: "NOT_FOUND" });
  }
  purgeExpiredGpsSamples();

  // A client-generated ID is only replayable inside the same operator/shift scope.
  const existingId = memoryStore.locationReportByClientId.get(input.clientReportId);
  if (existingId) {
    const existing = memoryStore.locationReports.get(existingId);
    if (!existing || existing.organizationId !== orgId || existing.operatorId !== input.operatorId || existing.shiftId !== input.shiftId) {
      throw Object.assign(new Error("Report ID already used"), { code: "CONFLICT" });
    }
    return { locationReportId: existingId, gpsSampleStored: Boolean(existing.gpsSample) };
  }

  const sellingLocation = memoryStore.sellingLocations.get(input.sellingLocationId);
  if (!sellingLocation || sellingLocation.organizationId !== orgId) {
    throw Object.assign(new Error("Selling location not found"), { code: "NOT_FOUND" });
  }
  if (sellingLocation.areaId !== stall.areaId) {
    throw Object.assign(new Error("Selling location is outside this operation's area"), { code: "FORBIDDEN" });
  }
  if (sellingLocation.status === "INACTIVE") {
    throw Object.assign(new Error("Location INACTIVE"), { code: "PRECONDITION_FAILED" });
  }

  const now = new Date();
  if (input.gpsSample && !isGpsSampleCaptureEnabled()) {
    throw Object.assign(new Error("GPS sample capture is disabled pending production privacy and retention approval"), { code: "PRECONDITION_FAILED" });
  }
  if (input.gpsSample) {
    try {
      validateLocationGpsSample(input.gpsSample, now);
    } catch (error) {
      throw Object.assign(error instanceof Error ? error : new Error("GPS sample is invalid"), { code: "VALIDATION_FAILED" });
    }
  }

  const openReport = [...memoryStore.locationReports.values()].find((report) =>
    report.organizationId === orgId && report.shiftId === input.shiftId &&
    report.operatorId === input.operatorId && !report.departedAt
  );

  if (openReport?.sellingLocationId === input.sellingLocationId) {
    // A fresh, explicitly submitted sample can update this point's one current sample; it does not
    // create a second report or a hidden history row. Expired prior sample fields are scrubbed above.
    if (input.gpsSample && input.trigger === "CONFIRM_UNCHANGED") {
      openReport.gpsSample = { ...input.gpsSample };
      memoryStore.locationReports.set(openReport.id, openReport);
      memoryStore.locationReportByClientId.set(input.clientReportId, openReport.id);
      await writeAuditEvent({
        organizationId: orgId,
        actorKind: "OPERATOR",
        actorId: input.operatorId,
        action: "location.gps_sample_saved",
        subjectKind: "location_report",
        subjectId: openReport.id,
        correlationId: generateId(),
        occurredAt: now,
        afterSummary: { gpsSampleIncluded: true },
      });
      return { locationReportId: openReport.id, gpsSampleStored: true };
    }
    memoryStore.locationReportByClientId.set(input.clientReportId, openReport.id);
    return { locationReportId: openReport.id, gpsSampleStored: Boolean(openReport.gpsSample) };
  }

  const id = generateId();
  const report = {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    stallId: shift.stallId,
    operatorId: input.operatorId,
    sellingLocationId: input.sellingLocationId,
    trigger: input.trigger,
    reasonForMove: input.reasonForMove,
    note: input.note,
    gpsSample: input.gpsSample ? { ...input.gpsSample } : undefined,
    arrivedAt: now,
    clientReportId: input.clientReportId,
    createdAt: now,
  };

  try {
    validateLocationReport({
      locationReportId: id,
      shiftId: input.shiftId,
      stallId: shift.stallId,
      sellingLocationId: input.sellingLocationId,
      operatorId: input.operatorId,
      reportedByOperatorId: input.operatorId,
      trigger: input.trigger,
      reasonForMove: input.reasonForMove,
      arrivedAt: now,
      note: input.note,
      gpsSample: input.gpsSample,
      clientReportId: input.clientReportId,
    }, now);
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("Location report is invalid"), { code: "VALIDATION_FAILED" });
  }

  // Close the previous point inside this verified shift, preserving its short-lived explicit sample.
  if (openReport) {
    openReport.departedAt = now;
    memoryStore.locationReports.set(openReport.id, openReport);
  }
  memoryStore.locationReports.set(id, report);
  memoryStore.locationReportByClientId.set(input.clientReportId, id);

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.operatorId,
    action: "location.reported",
    subjectKind: "location_report",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { sellingLocationId: input.sellingLocationId, trigger: input.trigger, gpsSampleIncluded: Boolean(input.gpsSample) },
  });

  return { locationReportId: id, gpsSampleStored: Boolean(input.gpsSample) };
}

export async function changeLocation(input: {
  shiftId: ShiftId; toSellingLocationId: SellingLocationId; reasonForMove: MoveReason; note?: string; operatorId?: string;
}): Promise<readonly LocationReport[]> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  if (shift.status !== "OPEN") {
    throw Object.assign(new Error("Shift not open, cannot move"), { code: "PRECONDITION_FAILED" });
  }
  // Close current
  const now = new Date();
  let currentOpen: any = null;
  for (const r of memoryStore.locationReports.values()) {
    if (r.shiftId === input.shiftId && !r.departedAt) {
      currentOpen = r;
      break;
    }
  }
  if (currentOpen) {
    const closed = domainCloseReport({
      locationReportId: currentOpen.id,
      shiftId: currentOpen.shiftId,
      stallId: currentOpen.stallId,
      sellingLocationId: currentOpen.sellingLocationId,
      operatorId: currentOpen.operatorId,
      reportedByOperatorId: currentOpen.operatorId,
      trigger: currentOpen.trigger,
      arrivedAt: currentOpen.arrivedAt,
      clientReportId: currentOpen.clientReportId,
    } as any, now, input.reasonForMove);
    currentOpen.departedAt = closed.departedAt;
    currentOpen.reasonForMove = input.reasonForMove;
  }

  // Create new report
  const newId = generateId();
  const clientReportId = generateId();
  const newReport: any = {
    id: newId,
    organizationId: shift.organizationId,
    shiftId: input.shiftId,
    stallId: shift.stallId,
    operatorId: input.operatorId || shift.operatorId,
    sellingLocationId: input.toSellingLocationId,
    trigger: "MOVE_SITE" as const,
    reasonForMove: input.reasonForMove,
    note: input.note,
    arrivedAt: now,
    clientReportId,
    createdAt: now,
  };
  memoryStore.locationReports.set(newId, newReport);
  memoryStore.locationReportByClientId.set(clientReportId, newId);

  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "OPERATOR",
    actorId: newReport.operatorId,
    action: "location.moved",
    subjectKind: "location_report",
    subjectId: newId,
    reason: input.reasonForMove,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { from: currentOpen?.sellingLocationId, to: input.toSellingLocationId },
  });

  // Return history for shift
  const history: LocationReport[] = [];
  for (const r of memoryStore.locationReports.values()) {
    if (r.shiftId === input.shiftId) {
      history.push({
        locationReportId: r.id,
        shiftId: r.shiftId,
        stallId: r.stallId,
        sellingLocationId: r.sellingLocationId,
        operatorId: r.operatorId,
        reportedByOperatorId: r.operatorId,
        trigger: r.trigger as any,
        reasonForMove: r.reasonForMove as any,
        arrivedAt: r.arrivedAt,
        departedAt: r.departedAt,
        note: r.note,
        clientReportId: r.clientReportId,
      });
    }
  }
  history.sort((a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime());
  return history;
}

export async function proposeSellingPoint(input: {
  operatorId: OperatorId; shiftId: ShiftId; name: string; addressText: string; note?: string; organizationId?: string;
}): Promise<{ readonly proposalId: string; readonly verificationState: "PENDING_VERIFICATION" }> {
  const id = generateId();
  // In this simplified implementation, we create a selling location with PENDING_VERIFICATION status via alert
  const orgId = input.organizationId || DEFAULT_ORG;
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  // Create location as TEMPORARILY_UNAVAILABLE pending verification
  const locId = generateId();
  memoryStore.sellingLocations.set(locId, {
    id: locId,
    organizationId: orgId,
    areaId: "00000000-0000-0000-0000-000000000000", // placeholder
    name: input.name,
    addressText: input.addressText,
    status: "TEMPORARILY_UNAVAILABLE" as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { proposalId: locId, verificationState: "PENDING_VERIFICATION" };
}

export async function listSellingPoints(orgId: string, areaId?: string): Promise<SellingPoint[]> {
  const result: SellingPoint[] = [];
  for (const loc of memoryStore.sellingLocations.values()) {
    if (loc.organizationId !== orgId) continue;
    if (areaId && loc.areaId !== areaId) continue;
    result.push({
      sellingLocationId: loc.id,
      areaId: loc.areaId,
      name: loc.name,
      addressText: loc.addressText || "",
      status: loc.status as LocationOperationalStatus,
      organizationId: loc.organizationId,
    });
  }
  return result;
}

export async function getCurrentLocationForShift(shiftId: string): Promise<SellingPoint | null> {
  let open: any = null;
  for (const r of memoryStore.locationReports.values()) {
    if (r.shiftId === shiftId && !r.departedAt) {
      if (!open || r.arrivedAt > open.arrivedAt) open = r;
    }
  }
  if (!open) return null;
  const loc = memoryStore.sellingLocations.get(open.sellingLocationId);
  if (!loc) return null;
  return {
    sellingLocationId: loc.id,
    areaId: loc.areaId,
    name: loc.name,
    addressText: loc.addressText || "",
    status: loc.status as LocationOperationalStatus,
    organizationId: loc.organizationId,
  };
}
