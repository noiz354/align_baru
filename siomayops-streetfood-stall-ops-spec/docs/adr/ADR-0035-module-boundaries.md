# ADR-0035: Module boundaries and dependency direction

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Architecture
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

In a codebase where pricing, payments, stock and settlement interact, hidden coupling produces bugs that surface only as a cash mismatch in the field. Module sprawl and cycles make change unsafe precisely where safety matters most.

## Decision

Enforce one direction of dependencies: `app` → `features` → `domain` → `shared`, with `server/*` adapters reachable only from `features`. `domain/*` imports nothing framework-specific and holds no I/O; `features/*` may not import another feature's internals, only its public ports; cross-cutting concerns (auth, storage, telemetry, queues) live in `server/*`. The rules are machine-checked in lint and CI, and a violated import fails the build. Read models built by jobs are the sanctioned way to join across features for reporting (see `ARCHITECTURE.md` §read models).

## Consequences

Positive: predictable navigation, safe refactors, testable pure domain logic, and provider/auth/storage code that cannot leak into UI modules. Negative: some indirection and occasional "where does this belong?" debates, resolved by the module map in `ARCHITECTURE.md`.

Deliberate exclusion: a read-model ADR was folded here rather than added as a separate decision, because read models are a consequence of this boundary rule rather than an independent choice.

## Alternatives considered

Layerless barrel exports (rejected: encourage cycles); Nx-style package boundaries (rejected: build complexity without a multi-team need); documented-but-unenforced rules (rejected: they decay).

## Compliance impact

Keeps personal-data access inside authorised modules, making privacy review tractable per module rather than per file.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
