/**
 * Revoke or rotate a check-in token (lost phone, suspected sharing, mass leak).
 *
 * Where this belongs: features/checkin; the participant-facing rotation and the organizer-facing
 * individual/mass revocation share this service.
 * Specification: docs/security/QR-SECURITY.md §4, FR-CHECKIN-013/016, T-CHECKIN-011.
 * Invariants: revocation takes effect immediately for future scans; an already-recorded attendance is
 *   NOT undone by revocation; re-issue creates a NEW token and revokes the old one (both audited); a
 *   mass revocation is one audited action with a reason.
 * Privacy: revocation reasons are an enum plus optional short note, never a personal narrative.
 * Failure cases: revoking an already-revoked token (idempotent) · revoking during an open window ·
 *   unavailable database (fail closed; the manual path remains).
 * Task ownership: T-CHECKIN-011.
 */
export interface RevocationResult {
  readonly revokedCount: number;
  readonly rotatedTokenDisplayPrefix?: string;
}

/** @throws Error("Not implemented: T-CHECKIN-011") */
export async function revokeToken(input: { registrationId: string; reason: "LOST_PHONE" | "SUSPECTED_SHARING" | "ORGANIZER_DECISION" | "EVENT_LEAK" | "OTHER"; note?: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<RevocationResult> {
  throw new Error("Not implemented: T-CHECKIN-011");
}
