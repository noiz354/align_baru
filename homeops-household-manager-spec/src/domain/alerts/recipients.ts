// HomeOps - domain skeleton (specification phase). Pure functions only.

import type { AlertPriority, Id, LocalDate, Role } from '../../shared/types';
import type { Recipient, RecipientReason } from '../members/types';

/**
 * Resolve who should act, deterministically and without broadcasting (I-ALERT-006, ADR-009):
 *   1. the assigned member (chore assignee, container assignee, plan assignee, issue assignee);
 *   2. otherwise the role target (household-level problems go to OWNER, then ADMIN);
 *   3. otherwise the OWNER fallback.
 * Away members are skipped unless the alert is URGENT; removed members are never selected; ties are
 * broken deterministically (earliest joined) so the same input always yields the same recipient.
 * The reason is stored with the alert so the explain-why surface can answer "why did I get this?".
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-020 - requirements, ADR, design, and tests are listed there.
 */
export function resolveRecipient(_input: {
  readonly assignedMemberId?: Id;
  readonly priority: AlertPriority;
  readonly today: LocalDate;
  readonly candidates: readonly {
    readonly memberId: Id;
    readonly role: Role;
    readonly awayUntil?: LocalDate;
    readonly joinedAtInstant: string;
  }[];
}): { readonly recipient: Recipient; readonly reason: RecipientReason } | null {
  throw new Error('Not implemented: T-ALERT-020');
}
