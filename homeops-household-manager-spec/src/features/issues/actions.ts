'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';
import type { IssueSeverity, IssueStatus } from '../../shared/types';

/**
 * Report an issue (FR-ISSUE-001/002). Title is the only required field; a photo is
 * attached after creation so an upload failure cannot block the report (I-ISSUE-005).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ISSUE-002 - requirements, ADR, design, and tests are listed there.
 */
export async function reportIssueAction(
  _input: {
    readonly title: string;
    readonly description?: string;
    readonly roomId?: string;
    readonly assetId?: string;
    readonly severity?: IssueSeverity;
    readonly clientRequestId: string;
  },
): Promise<OperationResult<{ readonly issueId: string }>> {
  throw new Error('Not implemented: T-ISSUE-002');
}

/**
 * Transition an issue (FR-ISSUE-003/004). Legal transitions only; closing is limited
 * to the reporter, OWNER, or ADMIN; WONT_FIX requires a reason (I-ISSUE-003).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ISSUE-001 - requirements, ADR, design, and tests are listed there.
 */
export async function transitionIssueAction(
  _input: { readonly issueId: string; readonly to: IssueStatus; readonly reason?: string },
): Promise<OperationResult<{ readonly issueId: string; readonly status: IssueStatus }>> {
  throw new Error('Not implemented: T-ISSUE-001');
}
