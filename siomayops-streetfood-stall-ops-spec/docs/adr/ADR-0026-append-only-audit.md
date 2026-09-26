# ADR-0026: Append-only audit events with mandatory reasons

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Compliance
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Disputes about who changed a price, approved an override, voided a sale, verified a payment or adjusted stock can only be resolved with records that cannot be edited afterwards. Cheap shared devices and high staff turnover make trust-by-person insufficient.

## Decision

Write append-only audit events for every money-affecting and permission-affecting action: actor, action, subject, before/after values (minimised), mandatory reason where the action is a correction, reversal, override, verification or adjustment, timestamp, and correlation/request id. Immutability is enforced at the database level (revoked UPDATE/DELETE grants and a trigger that rejects modification), not only by convention. Denied authorization attempts are audited too. Audit rows are readable by Owner, Finance and Auditor within their scope, exportable for review, and retained per `RETENTION.md`.

## Consequences

Positive: disputes are resolvable, insider risk is visible, external review is possible, and "who knew what when" is answerable. Negative: storage growth and the risk of audit becoming a shadow copy of personal data (mitigated by field-level minimisation and review).

## Alternatives considered

Application logs used as audit (rejected: mutable, unstructured, not queryable by subject); no audit (rejected: indefensible in a cash business); editable audit tables (rejected: no integrity).

## Compliance impact

Directly supports accountability and the organisation's ability to demonstrate lawful, purpose-bound processing under UU PDP; audit content is limited to identifiers and reasons, not unnecessary personal detail.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
