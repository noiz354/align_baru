// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, IssueSeverity, IssueStatus } from '../../shared/types';
import type { Issue, IssueComment } from './types';
import type { IssueRepository } from './ports';

export type IssueDeps = {
  readonly issues: IssueRepository;
  readonly clock: Clock;
};

/**
 * Report an issue in under 20 seconds (FR-ISSUE-001/002). Only the title is required; severity
 * defaults to NORMAL. A photo is never a precondition (I-ISSUE-005) - if the client sends one, the
 * attachment is linked after the issue exists, so an upload failure cannot block the report.
 * Idempotent per clientRequestId.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ISSUE-002 - requirements, ADR, design, and tests are listed there.
 */
export async function reportIssue(
  _deps: IssueDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly actorRole: string;
    readonly title: string;
    readonly description?: string;
    readonly roomId?: Id;
    readonly assetId?: Id;
    readonly severity?: IssueSeverity;
    readonly clientRequestId: string;
  },
): Promise<Issue> {
  throw new Error('Not implemented: T-ISSUE-002');
}

/**
 * Apply a lifecycle transition (FR-ISSUE-003/004). Legal moves only:
 *   OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> CLOSED, and any non-terminal -> WONT_FIX.
 * Every transition appends an audit row (I-ISSUE-001). Acknowledgement stops escalation while the
 * alert stays open (I-ISSUE-003). Closing is restricted to the reporter/OWNER/ADMIN.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ISSUE-001 - requirements, ADR, design, and tests are listed there.
 */
export async function transitionIssue(
  _deps: IssueDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly actorRole: string;
    readonly issueId: Id;
    readonly to: IssueStatus;
    readonly note?: string;
    readonly wontFixReason?: string;
  },
): Promise<Issue> {
  throw new Error('Not implemented: T-ISSUE-001');
}

/**
 * Add a comment (FR-ISSUE-008): 1-1000 characters, append-only, closed issues reject
 * new comments (I-ISSUE-006). Comments do not notify anyone by default - the issue alert carries
 * the urgency, and silence is a feature here.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ISSUE-008 - requirements, ADR, design, and tests are listed there.
 */
export async function addIssueComment(
  _deps: IssueDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly issueId: Id;
    readonly body: string;
    readonly attachmentId?: Id;
  },
): Promise<IssueComment> {
  throw new Error('Not implemented: T-ISSUE-008');
}
