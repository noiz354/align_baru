# ADR-0033: Time storage and business-day semantics

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Data
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Stalls sell past midnight and close after selling. Using UTC days for operational reporting would split one night's work across two days; using device clocks for ordering or money decisions would let a cheap, misconfigured phone move money between days.

## Decision

Store timestamps as UTC `timestamptz`; derive `businessDay` server-side using an explicit, configurable cut rule in Asia/Jakarta (default 04:00 local, so a 00:40 sale belongs to the previous business day). Device time is captured only as `recordedAtDevice` metadata, never used for ordering, pricing or settlement. Daily closings, read models, alerts and retention jobs all reference the business day rather than a raw date. The cut rule is configuration per organisation/area so future cities with different trading rhythms can be supported without code changes.

## Consequences

Positive: one unambiguous notion of "today" for operations and finance; night shifts are accounted correctly; clock manipulation cannot move money between days. Negative: two date concepts must be used consistently and documented (done here and in `DATA_MODEL.md`).

## Alternatives considered

UTC-day reporting (rejected: splits night trade); device-local dates (rejected: manipulable, ambiguous across devices); rolling 24-hour windows (rejected: incompatible with daily cash closing).

## Compliance impact

Consistent business-day boundaries make retention, deletion and reporting periods explicit and auditable.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
