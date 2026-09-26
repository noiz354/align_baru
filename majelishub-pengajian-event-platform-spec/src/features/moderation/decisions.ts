/**
 * Moderation decisions on reports and published content.
 *
 * Where this belongs: features/moderation.
 * Specification: TASKS.md T-MOD-001…T-MOD-004, CONTENT.md §6, SECURITY.md §4 (platform-only, SoD).
 * Invariants: a decision requires a reason and is audited; only platform moderators make final decisions
 *   (a reporter or publisher cannot decide their own case); hiding is reversible and never destroys the
 *   audit trail; the content owner is informed without exposing the reporter's identity where anonymity
 *   was requested.
 * Task ownership: T-MOD-002/003.
 */
export interface ModerationDecision {
  readonly reportId: string;
  readonly action: "NO_ACTION" | "HIDE_CONTENT" | "HIDE_COMMENT" | "RESTORE" | "TAKE_DOWN";
  readonly reason: string;
  readonly actor: import("@/shared/contracts/permissions").Actor;
}

/** @throws Error("Not implemented: T-MOD-003") */
export async function decide(decision: ModerationDecision): Promise<void> {
  throw new Error("Not implemented: T-MOD-003");
}
