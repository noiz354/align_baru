# ADR-0027: Field expense categorisation and neutral review model

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-7
- **Area:** Finance/Ethics
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

In the field, operators encounter small cash demands from parties whose authority cannot be verified by an app. Today these are paid informally or out of the operator's own pocket. A system that requires the operator to name a recipient or justify an alleged authority would encode unverifiable assumptions, could facilitate improper payments, and would leave the lowest-paid person carrying the risk. A system that refuses to record them pushes real costs off the books.

## Decision

Record field expenses with neutral, auditable categories (`UNVERIFIED_FIELD_EXPENSE` among them) capturing description, amount, time, location, optional evidence, operator note and review status. Recipient identity, claimed authority and purpose are neither required nor asserted. Cash expenses entered during a shift act as cash-box outflows and are covered by the operator's cash count at closing. HQ reviews by pattern (frequency, amount, clustering, repeat context) with human judgement; review states are SUBMITTED, REVIEW_REQUIRED, REVIEWED, REJECTED, ESCALATED. Escalation routes to a human, never to an automated penalty.

## Consequences

Positive: honest cost capture; reduced pressure on operators; no machinery that automates, hides, facilitates or optimises irregular payments; a reviewable trail if the organisation is ever asked. Negative: some costs cannot be verified, so assurance comes from pattern review rather than documentation.

Open question for VS-7: whether approved field expenses are reimbursed in the same settlement cycle or a separate one (finance decision, not a code decision).

## Alternatives considered

Requiring recipient details or claimed authority (rejected: unverifiable, potentially harmful); not recording these costs (rejected: transfers risk to the operator); auto-approval or auto-rejection (rejected: judgement must be human); refusing the category name (rejected: the neutral name is the point).

## Compliance impact

Designed to avoid encouraging, automating, hiding or facilitating improper payments; supports worker safety and the organisation's compliance posture.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
