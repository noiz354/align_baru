// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, Instant, LocalDate } from '../../shared/types';
import type { ChoreDefinitionRepository, ChoreOccurrenceRepository } from './ports';
import type { ChoreDefinition, ChoreOccurrence } from './types';

export type ChoreDeps = {
  readonly definitions: ChoreDefinitionRepository;
  readonly occurrences: ChoreOccurrenceRepository;
  readonly clock: Clock;
};

/**
 * Materialise the single next occurrence for a definition when none is open (FR-CHORE-017).
 * Runs on every scheduler tick and is therefore idempotent twice over: the deterministic
 * occurrenceKey plus the partial unique index (I-CHORE-001, I-CHORE-003). A tick that runs
 * late produces exactly one occurrence dated by the rule - never a backlog of missed days.
 * Paused and archived definitions are skipped; other modules learn about the new occurrence
 * through events only (never through a direct call).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-010 - requirements, ADR, design, and tests are listed there.
 */
export async function materialiseNextOccurrence(
  _deps: ChoreDeps,
  _input: { readonly householdId: Id; readonly definitionId: Id; readonly today: LocalDate },
): Promise<ChoreOccurrence | null> {
  throw new Error('Not implemented: T-CHORE-010');
}

/**
 * Complete an occurrence with one action (FR-CHORE-004..006).
 * Idempotent per occurrence and per clientRequestId (I-CHORE-002). Effects, all inside one
 * transaction: record actor/time (plus optional note or photo), resolve this occurrence alerts
 * with reason COMPLETED, feed room status through an event, append an activity entry, and - for
 * AFTER_COMPLETION rules - set the anchor for the next date (I-CHORE-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-004 - requirements, ADR, design, and tests are listed there.
 */
export async function completeOccurrence(
  _deps: ChoreDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly occurrenceId: Id;
    readonly note?: string;
    readonly attachmentId?: Id;
    readonly clientRequestId: string;
  },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-004');
}

/**
 * Skip an occurrence with a reason (FR-CHORE-007). Resolves alerts with reason SKIPPED, keeps
 * the occurrence in history, and must NOT advance an AFTER_COMPLETION series (I-CHORE-005).
 * A second skip on the same occurrence is a no-op, not an error.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-007 - requirements, ADR, design, and tests are listed there.
 */
export async function skipOccurrence(
  _deps: ChoreDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly occurrenceId: Id;
    readonly reason: 'AWAY' | 'NOT_NEEDED' | 'CAME_UP' | 'OTHER';
    readonly note?: string;
  },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-007');
}

/**
 * Snooze an occurrence (FR-CHORE-009): attributed, bounded by the household maximum
 * (SNOOZE_TOO_LONG otherwise), suppressing its alert until `snoozedUntil` and re-evaluating on
 * expiry (I-ALERT-004). Snoozing never resolves anything.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-008 - requirements, ADR, design, and tests are listed there.
 */
export async function snoozeOccurrence(
  _deps: ChoreDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly occurrenceId: Id; readonly snoozedUntil: Instant },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-008');
}

/**
 * Reassign or claim an occurrence (FR-CHORE-008). Re-targets future alert delivery to the new
 * assignee only - never notifies the household (I-ALERT-006). Assignment of a completed
 * occurrence is rejected.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-009 - requirements, ADR, design, and tests are listed there.
 */
export async function reassignOccurrence(
  _deps: ChoreDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly occurrenceId: Id; readonly assigneeMemberId: Id | null },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-009');
}

/**
 * Reopen a completion (correction, FR-CHORE-005): within 24 h by the completer, any time by
 * OWNER/ADMIN with a reason (REOPEN_WINDOW_CLOSED otherwise). The completion is retained and a
 * correction is recorded; the alert is re-evaluated. History is corrected, never erased.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-005 - requirements, ADR, design, and tests are listed there.
 */
export async function reopenCompletion(
  _deps: ChoreDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly actorRole: string;
    readonly occurrenceId: Id;
    readonly reason: string;
  },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-005');
}

/**
 * Create an ad-hoc occurrence with no definition (FR-CHORE-010). Behaves exactly like a
 * scheduled occurrence in every list and alert path; it simply has no recurrence behind it.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-006 - requirements, ADR, design, and tests are listed there.
 */
export async function createAdHocOccurrence(
  _deps: ChoreDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly title: string;
    readonly roomId?: Id;
    readonly assigneeMemberId?: Id;
    readonly dueOn?: LocalDate;
  },
): Promise<ChoreOccurrence> {
  throw new Error('Not implemented: T-CHORE-006');
}

/**
 * Pause, resume, or archive a definition (FR-CHORE-018/019). Pausing resolves the open
 * occurrence alerts with reason PAUSED and stops materialisation; resuming recomputes the next
 * date from the rule anchor, never from the pause date (I-CHORE-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-003 - requirements, ADR, design, and tests are listed there.
 */
export async function setDefinitionLifecycle(
  _deps: ChoreDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly definitionId: Id;
    readonly action: 'PAUSE' | 'RESUME' | 'ARCHIVE';
    readonly openOccurrenceHandling?: 'CANCEL' | 'COMPLETE';
  },
): Promise<ChoreDefinition> {
  throw new Error('Not implemented: T-CHORE-003');
}
