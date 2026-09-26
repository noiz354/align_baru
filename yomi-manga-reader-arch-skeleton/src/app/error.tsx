/**
 * Error boundary (5xx / render failures).
 *
 * Requirements: NFR-A11Y-003/004, NFR-SEC-010 (NO internals in UI),
 * API_CONTRACT §6 (INTERNAL_* mapping).
 * Task: T-FOUND-003.
 *
 * Contract: labeled error state ("Something went wrong" + what the user
 * can do + home link); the error object is logged server-side (typed,
 * requestId present) but the UI shows NOTHING beyond the user-safe
 * message (no stacks, no storage detail — THREAT T-13).
 */
export default function GlobalError(/* { error, reset } */) {
  return (
    <main>
      {/* TODO(T-FOUND-003): error layout (user-safe message + retry/home) */}
    </main>
  );
}
