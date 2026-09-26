/**
 * Clock port - time is injected, never read directly.
 *
 * Where this belongs: shared/time, because registration windows, check-in windows, recurrence,
 * reminders, retention and audit timestamps all depend on it.
 * Specification: ADR-0018 (store UTC instants; render in the venue's IANA timezone; prayer-relative
 * scheduling resolves against a configured source with an explicit "perkiraan" fallback).
 *
 * Invariants:
 *   1. Domain code never calls `new Date()` or `Date.now()` (lint-enforced once T-ARCH-002 lands).
 *   2. Server time is authoritative for decisions; device clocks only inform display.
 *   3. Timezone conversions use the venue's IANA zone, never a fixed offset.
 */
export interface Clock {
  nowInstant(): string;                 // ISO-8601 UTC
  nowInZone(tz: string): { localIso: string; weekday: string; utcOffsetMinutes: number };
}

/**
 * Production clock. Implementation is deliberately absent in Phase 0 (no product behaviour).
 * @throws Error("Not implemented: T-ARCH-001")
 */
export function systemClock(): Clock {
  throw new Error("Not implemented: T-ARCH-001");
}
