/**
 * Contact handling: normalisation, keyed hashing, visibility policy and withdrawal.
 *
 * Where this belongs: features/registration; the crypto lives in src/server/crypto/contact-hash.ts.
 * Specification: TASKS.md T-REG-011, PRIVACY.md §4, THREAT_MODEL T-07.
 * Invariants: the minimised projection is the DEFAULT everywhere (lists, exports, API responses);
 *   `contact_hash` is keyed (not a plain digest) and salted, so a phone-number dictionary attack fails;
 *   withdrawal removes the contact value while keeping the registration and any attendance record.
 * Security: protects against harvesting; every contact read is audited with actor, event and purpose.
 * Privacy: purpose limitation; contact data never joins analytics or exports unless explicitly selected.
 * Failure cases: local numbers needing normalisation (never reject plausible local formats) ·
 *   duplicate contact with a different name · withdrawal racing a queued notification (skip the send).
 * Task ownership: T-REG-011, T-ATTEND-006.
 */
export interface ContactVisibility {
  readonly defaultProjectionIncludesContact: false;
  readonly requiresPermission: "registration.read";
  readonly reasonRequired: boolean;
}

/** @throws Error("Not implemented: T-REG-011") */
export function normaliseContact(kind: "EMAIL" | "PHONE", raw: string): { normalised: string; plausible: boolean } {
  throw new Error("Not implemented: T-REG-011");
}

/** @throws Error("Not implemented: T-REG-011") */
export async function withdrawContact(input: { registrationId: string; actorKind: "PARTICIPANT" | "ORGANIZER"; reason: string }): Promise<void> {
  throw new Error("Not implemented: T-REG-011");
}
