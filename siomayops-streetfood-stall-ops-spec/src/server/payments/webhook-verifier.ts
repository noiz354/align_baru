/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Provider callbacks are UNTRUSTED until verified: signature, reference match, amount match and a
 * replay guard must all pass before any state changes (NFR-SEC-005, API.md §9 §12).
 */
export interface VerifiedCallback {
  readonly providerId: string;
  readonly partnerReferenceNo: string;
  readonly providerReferenceId: string;
  readonly state: "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";
  readonly amountMinor: number;
  readonly currency: "IDR";
  readonly providerOccurredAt: Date;
  readonly callbackFingerprint: string;
}

export type CallbackVerification =
  | { readonly kind: "VERIFIED"; readonly callback: VerifiedCallback }
  | { readonly kind: "REJECTED"; readonly reasonCode: "SIGNATURE_INVALID" | "REFERENCE_UNKNOWN" | "AMOUNT_MISMATCH" | "REPLAY_DETECTED" | "MALFORMED" };

/** Throws. Task: T-PAY-003. */
export function verifyProviderCallback(_input: {
  providerId: string;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
}): CallbackVerification {
  throw new Error("Not implemented: T-PAY-003");
}
