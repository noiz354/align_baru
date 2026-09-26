/**
 * The bound operator context (event, venue, entrance, device, window state).
 *
 * Where this belongs: features/checkin; server-derived, never client-asserted.
 * Specification: CHECKIN.md §2/§7, T-CHECKIN-006, ADR-0026.
 * Invariants: the context bar is authoritative from the server; it cannot be widened client-side;
 *   switching events invalidates the previous scan cache; a wrong-event scan names the event but never
 *   a person.
 * Failure cases: two events at one venue on one day · reschedule mid-session · device re-bound ·
 *   clock skew vs the window.
 * Task ownership: T-CHECKIN-006, T-CHECKIN-016 (device binding).
 */
export interface CheckInContext {
  readonly eventId: string;
  readonly eventTitle: string;
  readonly organizationId: string;
  readonly venueName: string;
  readonly entranceId: string;
  readonly entranceName: string;
  readonly deviceLabel: string;
  readonly window: { state: "NOT_OPEN" | "OPEN" | "CLOSED"; closesAt?: string };
  readonly lastSyncAt: string;
}

/** @throws Error("Not implemented: T-CHECKIN-006") */
export async function loadCheckInContext(input: { eventId: string; entranceId: string; deviceId: string; scope: import("@/shared/contracts/scope").TenantScope }): Promise<CheckInContext> {
  throw new Error("Not implemented: T-CHECKIN-006");
}
