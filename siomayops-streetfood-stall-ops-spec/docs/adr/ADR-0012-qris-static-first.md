# ADR-0012: QRIS MVP: static QR with honest pending states

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-6
- **Area:** Payments
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

QRIS is the dominant Indonesian retail payment rail, but accepting it requires a licensed provider relationship (KYC, credentials, settlement account) and dynamic QR requires per-transaction API integration plus signed callbacks. A pilot cannot wait weeks for that, and faking payment success is unacceptable.

## Decision

MVP records static-QRIS payments as PENDING_VERIFICATION: the operator confirms the customer's payment on the merchant's static QR, the UI says "Menunggu verifikasi", and HQ Finance resolves it via a manual reconciliation record (role + evidence note + audit). Dynamic QR with verified callbacks is a later slice behind the same port; PENDING_VERIFICATION items then flow through the same reconciliation queue.

## Consequences

Positive: works on day one with zero integration; keeps the books honest; builds the reconciliation workflow that dynamic QR will need anyway; no false revenue. Negative: manual verification cost, which must be batched into the evening settlement routine; operators must be trained on the wording.

## Alternatives considered

Faking success states (rejected: fraud-enabling); trusting customer screenshots (rejected: not evidence); waiting for full gateway integration before launching (rejected: delays the pilot and the offline/cash flows).

## Compliance impact

Unverified digital amounts are always reported separately from verified ones, so management reporting cannot overstate income.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
