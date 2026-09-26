/**
 * PHASE 0 — SKELETON ONLY. No business logic, no I/O, no calculations.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX`.
 * See ADR-0036 (skeleton policy) and AGENTS.md.
 */

/**
 * Business day is server-derived in Asia/Jakarta with a configurable cut hour (default 04:00),
 * so a 00:40 sale belongs to the previous business day (ADR-0033).
 */
export type BusinessDay = string; // YYYY-MM-DD
export type TimezoneId = "Asia/Jakarta";

export interface BusinessDayConfig {
  readonly timezone: TimezoneId;
  readonly cutHour: number; // 0..23
}

/** Throws. Task: T-FOUND-006. */
export function toBusinessDay(_instant: Date, _config: BusinessDayConfig): BusinessDay {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. */
export function businessDayRange(_day: BusinessDay, _config: BusinessDayConfig): { start: Date; end: Date } {
  throw new Error("Not implemented: T-FOUND-006");
}
