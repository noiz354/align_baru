// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-ISSUE-001..012.

import type { Id } from '../../shared/types';
import type { Issue, IssueComment } from './types';

export type IssueRepository = {
  findById(householdId: Id, issueId: Id): Promise<Issue | null>;
  listByHousehold(householdId: Id, options?: { readonly status?: readonly string[]; readonly severity?: readonly string[] }): Promise<readonly Issue[]>;
  insert(issue: Issue): Promise<void>;
  update(issue: Issue): Promise<void>;
  /** Append-only comment writes; adapters expose no update or delete for comments. */
  /** householdId first: a comment has no scope of its own; the parent issue's scope applies. */
  insertComment(householdId: Id, comment: IssueComment): Promise<void>;
  listComments(householdId: Id, issueId: Id, limit: number): Promise<readonly IssueComment[]>;
  /** Every transition appends here (I-ISSUE-001); used by the detail page and by reviews. */
  appendTransition(entry: {
    readonly householdId: Id;
    readonly issueId: Id;
    readonly from: string;
    readonly to: string;
    readonly actorMemberId: Id;
    readonly reason?: string;
    readonly occurredAt: string;
  }): Promise<void>;
};
