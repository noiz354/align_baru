# ADR-0032: Identifiers: UUIDv7 + human-readable business codes

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Data
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Two audiences need identifiers. Applications need opaque, collision-free, sortable keys that can be generated offline on a device before the server sees the record. Humans in the field and in finance need short codes they can read aloud on the phone or write on a slip of paper.

## Decision

Primary keys are UUIDv7, generated server-side or client-side (for offline creations) and opaque to clients as an authorization token. Human-facing codes (stall, shift, sale, incident, settlement) are separate, short, organisation-unique, immutable once issued and never reused. Codes are never used for authentication or for URL authorization decisions. Support and HQ surfaces display codes; APIs accept either, but resolve authorization from the UUID scope, not the code.

## Consequences

Positive: offline-safe IDs, creation order implicit for debugging, printable codes for field communication. Negative: two identifier concepts to document and to avoid confusing (addressed in `GLOSSARY.md` and `DATA_MODEL.md`).

## Alternatives considered

auto-increment integers (rejected: enumerable and not offline-generatable); UUIDv4 (rejected: random ordering hurts index locality and debugging); opaque IDs everywhere (rejected: unusable on the phone); codes as authorization tokens (rejected: security by obscurity).

## Compliance impact

Non-enumerable identifiers reduce accidental exposure of record existence and volume between organisations.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
