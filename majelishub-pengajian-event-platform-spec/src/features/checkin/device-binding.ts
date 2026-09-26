/**
 * Device binding, idle timeout and revocation for check-in sessions.
 *
 * Where this belongs: features/checkin, backed by server/auth session handling.
 * Specification: SECURITY.md §7, THREAT_MODEL T-12, T-CHECKIN-016.
 * Invariants: a check-in session is scoped to exactly one event and one entrance; the permission set is
 *   a strict subset of the volunteer role; revocation takes effect on the next request; the console can
 *   never read participant lists or exports.
 * Privacy: the operator's own identity is protected from participants; contacts are never displayed.
 * Failure cases: lost device mid-event (revoke and continue elsewhere) · expired session at peak time
 *   (one-tap re-auth, the local queue is preserved) · duplicate device labels.
 * Task ownership: T-CHECKIN-016, T-CHECKIN-013 (device roster).
 */
export interface BoundDevice {
  readonly deviceId: string;
  readonly label: string;
  readonly eventId: string;
  readonly entranceId: string;
  readonly boundAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt?: string;
}

/** @throws Error("Not implemented: T-CHECKIN-016") */
export async function bindDevice(input: { eventId: string; entranceId: string; label: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<BoundDevice> {
  throw new Error("Not implemented: T-CHECKIN-016");
}

/** @throws Error("Not implemented: T-CHECKIN-016") */
export async function revokeDevice(input: { deviceId: string; reason: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<void> {
  throw new Error("Not implemented: T-CHECKIN-016");
}
