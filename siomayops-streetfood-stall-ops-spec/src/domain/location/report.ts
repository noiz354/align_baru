export type LocationTrigger = "ARRIVED" | "CONFIRM_UNCHANGED" | "MOVE_SITE" | "STEPPED_AWAY" | "DEPARTED";

export type MoveReason =
  | "CROWDED" | "PERMISSION_ISSUE_REPORTED" | "WEATHER" | "COMPETITION" | "CUSTOMER_FLOW"
  | "EQUIPMENT" | "PERSONAL" | "OTHER";

export type LocationOperationalStatus =
  | "AVAILABLE" | "ACTIVE" | "CROWDED" | "TEMPORARILY_UNAVAILABLE" | "RESTRICTED" | "INACTIVE";

export interface LocationGpsSample {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAt: Date;
}

export function validateLocationGpsSample(sample: LocationGpsSample, now = new Date()): void {
  if (!Number.isFinite(sample.latitude) || sample.latitude < -90 || sample.latitude > 90) throw new Error("GPS latitude is invalid");
  if (!Number.isFinite(sample.longitude) || sample.longitude < -180 || sample.longitude > 180) throw new Error("GPS longitude is invalid");
  if (!Number.isFinite(sample.accuracyMeters) || sample.accuracyMeters < 0 || sample.accuracyMeters > 100_000) throw new Error("GPS accuracy is invalid");
  if (!(sample.capturedAt instanceof Date) || !Number.isFinite(sample.capturedAt.getTime())) throw new Error("GPS capture time is invalid");
  const ageMs = now.getTime() - sample.capturedAt.getTime();
  if (ageMs < -2 * 60_000 || ageMs > 5 * 60_000) throw new Error("GPS sample must be no more than five minutes old");
}

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
  readonly gpsSample?: LocationGpsSample;
  readonly clientReportId: string;
}

export function validateLocationReport(report: LocationReport, now = new Date()): void {
  if (!report.shiftId) throw new Error("shiftId required");
  if (!report.sellingLocationId) throw new Error("sellingLocationId required");
  if (!report.operatorId) throw new Error("operatorId required");
  if (report.trigger === "MOVE_SITE" && !report.reasonForMove) {
    throw new Error("reasonForMove required for MOVE_SITE");
  }
  if (report.arrivedAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    throw new Error("arrivedAt cannot be in the future beyond 5 min tolerance");
  }
  if (report.gpsSample) validateLocationGpsSample(report.gpsSample, now);
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
