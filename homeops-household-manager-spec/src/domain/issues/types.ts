// HomeOps - domain skeleton (specification phase). Types and value objects only.
// Owning tasks: T-ISSUE-001..012.

import type { Id, Instant, IssueSeverity, IssueStatus } from '../../shared/types';

export type Issue = {
  readonly id: Id;
  readonly householdId: Id;
  readonly title: string;
  readonly description?: string;
  readonly roomId?: Id;
  readonly assetId?: Id;
  readonly severity: IssueSeverity;
  readonly status: IssueStatus;
  readonly reportedByMemberId: Id;
  readonly assigneeMemberId?: Id;
  readonly vendorNote?: string;
  readonly attachmentIds: readonly Id[];
  readonly acknowledgedAt?: Instant;
  readonly resolvedAt?: Instant;
  readonly closedAt?: Instant;
  readonly wontFixReason?: string;
  readonly createdAt: Instant;
};

/** Append-only: the conversation is history, not a mutable field (I-ISSUE-004). */
export type IssueComment = {
  readonly id: Id;
  readonly issueId: Id;
  readonly authorMemberId: Id;
  readonly body: string;
  readonly attachmentId?: Id;
  readonly createdAt: Instant;
};

/** Who may close: the reporter, an OWNER, or an ADMIN (I-ISSUE-003, AUTHZ-MATRIX section 8). */
export type IssueClosePermission = 'REPORTER' | 'OWNER' | 'ADMIN' | 'DENIED';
