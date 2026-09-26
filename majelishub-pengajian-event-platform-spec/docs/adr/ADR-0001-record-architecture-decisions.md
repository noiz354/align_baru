# ADR-0001 — Record architecture decisions as ADRs

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect
- Requirements affected: — · Related: `CONTRIBUTING.md`, `AGENTS.md`

## Context

MajelisHub is developed in phases, largely by coding agents and rotating volunteers. The
failure mode that kills projects of this shape is not bad code; it is **lost reasoning**:
someone "fixes" the check-in path to be a single `UPDATE`, someone else adds Redis to solve a
problem nobody measured, and the constraints that made the system trustworthy disappear
without a decision ever being recorded.

## Decision

Every decision that constrains implementation is recorded as an ADR with Context, Decision,
Alternatives, Consequences, **Enforcement** and **Revisit trigger**. ADRs are immutable in
substance; changes are made by superseding.

## Alternatives considered

- **Wiki / meeting notes:** fast, but unversioned and not reviewed with code. Rejected.
- **Comments in code:** invisible to product/design/ops decisions and lost when files move.
  Rejected as the primary record (still used for local rationale).
- **No record, trust reviewers:** works until the third contributor joins; fails exactly when
  the system becomes complex. Rejected.

## Consequences

**Positive:** decisions are reviewable, reversible on evidence, and teachable; the authority
hierarchy in `README.md` becomes enforceable; coding agents get constraints in one place.

**Negative:** writing an ADR costs 20–40 minutes, and some decisions genuinely do not deserve
one (kept out of scope: naming, styling, library-internal choices).

**Neutral:** ADRs are documentation; they are reviewed in the same PR as the change.

## Enforcement

- A PR that introduces a stateful service, a provider dependency, a security-relevant
  mechanism, or reverses a documented decision **without** an ADR is rejected.
- `ADR.md` index must contain every file in `docs/adr/` (checked in the docs lint task
  `T-DOCS-001`).

## Revisit trigger

If the team grows beyond ~10 contributors and ADRs become a bottleneck for low-impact
decisions, introduce a lightweight "decision note" tier — but never for security, privacy,
media-reliability or ethics decisions.
