export type LocationTrigger = "ARRIVED" | "CONFIRM_UNCHANGED" | "MOVE_SITE" | "STEPPED_AWAY" | "DEPARTED";

export type MoveReason =
  | "CROWDED" | "PERMISSION_ISSUE_REPORTED" | "WEATHER" | "COMPETITION" | "CUSTOMER_FLOW"
  | "EQUIPMENT" | "PERSONAL" | "OTHER";

export type LocationOperationalStatus =
  | "AVAILABLE" | "ACTIVE" | "CROWDED" | "TEMPORARILY_UNAVAILABLE" | "RESTRICTED" | "INACTIVE";

export interface LocationReport {
  readonly locationReportId: string;
  readonly shiftId: string;
  readonly stallId: string;
  readonly sellingLocationId: string;
  readonly operatorId: string;
  readonly reportedByOperatorId: string;
  readonly trigger: LocationTrigger;
  readonly reasonForMove?: MoveReason;
  readonly arrivedAt: Date;
  readonly departedAt?: Date;
  readonly note?: string;
  readonly clientReportId: string;
}

export function validateLocationReport(report: LocationReport): void {
  if (!report.shiftId) throw new Error("shiftId required");
  if (!report.sellingLocationId) throw new Error("sellingLocationId required");
  if (!report.operatorId) throw new Error("operatorId required");
  if (report.trigger === "MOVE_SITE" && !report.reasonForMove) {
    throw new Error("reasonForMove required for MOVE_SITE");
  }
  if (report.arrivedAt > new Date(Date.now() + 5 * 60 * 1000)) {
    throw new Error("arrivedAt cannot be in the future beyond 5 min tolerance");
  }
}

export function closeLocationReport(report: LocationReport, departedAt: Date, reason: MoveReason): LocationReport {
  if (report.departedAt) throw new Error("Report already closed");
  if (departedAt < report.arrivedAt) throw new Error("departedAt cannot be before arrivedAt");
  return {
    ...report,
    departedAt,
    reasonForMove: reason,
  };
}
