import { memoryStore, generateId } from "../../server/db/memory-store";
import type { SellingLocationId, AreaId, ShiftId, OperatorId } from "../../shared/types/ids";
import type { LocationOperationalStatus, MoveReason, LocationReport } from "../../domain/location";
import { validateLocationReport, closeLocationReport as domainCloseReport } from "../../domain/location/report";
import { writeAuditEvent } from "../audit";

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
  reasonForMove?: MoveReason; note?: string; clientReportId: string; operatorId?: string; organizationId?: string;
}): Promise<{ readonly locationReportId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Check duplicate clientReportId
  const existingId = memoryStore.locationReportByClientId.get(input.clientReportId);
  if (existingId) {
    return { locationReportId: existingId };
  }
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error("Shift not active"), { code: "PRECONDITION_FAILED" });
  }
  const sellingLocation = memoryStore.sellingLocations.get(input.sellingLocationId);
  if (!sellingLocation) throw Object.assign(new Error("Selling location not found"), { code: "NOT_FOUND" });
  if (sellingLocation.status === "INACTIVE") {
    throw Object.assign(new Error("Location INACTIVE"), { code: "PRECONDITION_FAILED" });
  }
  if (sellingLocation.organizationId !== orgId && sellingLocation.organizationId !== shift.organizationId) {
    throw Object.assign(new Error("Organization mismatch"), { code: "FORBIDDEN" });
  }

  // Validate no open report for same shift unless this is a move? We allow multiple but close previous.
  // For ARRIVED, check if there's already open report for same location -> idempotent
  for (const r of memoryStore.locationReports.values()) {
    if (r.shiftId === input.shiftId && !r.departedAt && r.sellingLocationId === input.sellingLocationId) {
      // Idempotent: return existing open report
      return { locationReportId: r.id };
    }
  }

  const id = generateId();
  const now = new Date();
  const report: any = {
    id,
    organizationId: shift.organizationId,
    shiftId: input.shiftId,
    stallId: shift.stallId,
    operatorId: input.operatorId || shift.operatorId,
    sellingLocationId: input.sellingLocationId,
    trigger: input.trigger,
    reasonForMove: input.reasonForMove,
    note: input.note,
    arrivedAt: now,
    clientReportId: input.clientReportId,
    createdAt: now,
  };
  // Domain validation
  validateLocationReport({
    locationReportId: id,
    shiftId: input.shiftId,
    stallId: shift.stallId,
    sellingLocationId: input.sellingLocationId,
    operatorId: report.operatorId,
    reportedByOperatorId: report.operatorId,
    trigger: input.trigger,
    reasonForMove: input.reasonForMove as any,
    arrivedAt: now,
    note: input.note,
    clientReportId: input.clientReportId,
  });

  // Close previous open report for this shift
  for (const r of memoryStore.locationReports.values()) {
    if (r.shiftId === input.shiftId && !r.departedAt) {
      r.departedAt = now;
    }
  }

  memoryStore.locationReports.set(id, report);
  memoryStore.locationReportByClientId.set(input.clientReportId, id);

  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "OPERATOR",
    actorId: report.operatorId,
    action: "location.reported",
    subjectKind: "location_report",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { sellingLocationId: input.sellingLocationId, trigger: input.trigger },
  });

  return { locationReportId: id };
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
