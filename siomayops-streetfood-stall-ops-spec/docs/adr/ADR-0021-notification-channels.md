# ADR-0021: Notification channels: in-app first

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-12
- **Area:** Platform
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Operators cannot be reached reliably by email; Web Push is free but permission-gated and unreliable on some Android OEM battery savers; WhatsApp Cloud API is powerful but paid, template-approved and rate-limited by quality ratings. Money-critical flows must not depend on any third party.

## Decision

In-app inbox and alert objects are the primary channel and are fully under our control. Web Push (VAPID) is planned for P1/P2. WhatsApp Business Cloud API (On-Premises deprecated in 2025; Cloud API only) is optional and reserved for HQ/supervisor P1 escalations and customer receipts, subject to contract and cost review. SMS is a fallback only. No money state depends on delivery (FR-NOTIF-007).

## Consequences

Positive: no external dependency in critical paths; cost control; auditability of who was told what and when. Negative: operators must open the app to see non-urgent items (acceptable: they open it to sell).

## Alternatives considered

Email for operators (rejected: not their channel); SMS-first (rejected: cost and SIM-swap risk); push-only (rejected: OEM unreliability); building a chat product (rejected: out of scope).

## Compliance impact

Provider terms reviewed before activation (NFR-COMP-003); customer messaging requires separate consent (LOYALTY.md).

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
