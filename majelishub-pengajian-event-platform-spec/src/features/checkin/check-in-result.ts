/**
 * Map a domain outcome to the single result shape the UI renders.
 *
 * Where this belongs: features/checkin - the UI must never invent wording or decide success.
 * Invariants: only VALID and ALREADY_CHECKED_IN are success-shaped (shared `isSuccess` predicate);
 *   UNAVAILABLE always offers the manual path; no message contains personal data of anyone else.
 * Accessibility: each result maps to a visual state, a text label and a sound/haptic cue
 *   (ACCESSIBILITY.md §4); wording reviewed for calm, plain Indonesian.
 * Task ownership: T-CHECKIN-014 (result shape), T-CHECKIN-010 (feedback states).
 */
import type { CheckInResult, CheckInResultKind } from "@/shared/contracts/checkin";

export const SUCCESS_KINDS: readonly CheckInResultKind[] = ["VALID", "ALREADY_CHECKED_IN"];

export function isSuccess(kind: CheckInResultKind): boolean {
  return SUCCESS_KINDS.includes(kind);
}

/**
 * @throws Error("Not implemented: T-CHECKIN-010")
 */
export function describeResult(result: CheckInResult): { title: string; detail: string; tone: "success" | "notice" | "warning" } {
  throw new Error("Not implemented: T-CHECKIN-010");
}
