# ADR-0037: Retention, deletion, and archival strategy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-17
- **Area:** Compliance
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

A cash business accumulates personal and financial records: operator identity and contact data, customer loyalty identifiers, evidence photos, incident reports, audit rows, and device metadata. Keeping everything forever is both a liability and, under Indonesia's UU PDP (enforceable since October 2024, with 72-hour breach notification duties and fines up to 2% of annual revenue), an exposure. Deleting too eagerly destroys the ability to resolve disputes and to satisfy accounting and audit expectations.

## Decision

Define retention per record class in `RETENTION.md` (R-01…R-24) and implement it as scheduled jobs: financial records kept for the accounting period required by law and internal policy; audit rows kept longer than the operational data they describe; evidence photos with short, explicit lifetimes and lifecycle rules at the storage layer; loyalty and customer identifiers deleted or anonymised on consent withdrawal, with a documented anonymisation path used where deletion is blocked by a legal hold; device metadata and sync logs kept only as long as needed for support. Deletion is executed as a job with logged outcomes, verification queries and a periodic restore-and-verify drill. Legal holds are explicit, time-boxed records, not silent exclusions.

## Consequences

Positive: bounded liability, defensible deletion evidence, and clear answers to "how long do you keep this?". Negative: jobs to operate and test, plus complexity where a record is referenced by another retained record (documented as redaction rather than deletion in those cases).

This ADR is binding now but implemented in VS-17; until then no production data exists.

## Alternatives considered

Anonymise or delete (rejected: keep everything "just in case"); delete on request everywhere including financial records (rejected: conflicts with accounting and audit obligations); policy without execution jobs (rejected: unenforceable).

## Compliance impact

Directly implements UU PDP storage-limitation and data-subject-rights obligations, including deletion, access and correction paths, with evidence of execution.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
