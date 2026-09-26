# Architecture Decision Records

Every ADR answers: **what did we decide, what did we reject, what does it force on us, and
what would make us change our mind.**

## Template

```markdown
# ADR-XXXX — <decision in the imperative>

- Status: Proposed | Accepted | Superseded by ADR-YYYY | Rejected
- Date: YYYY-MM-DD
- Deciders: <roles>
- Supersedes / Superseded by: <links>
- Requirements affected: FR-XXX-nnn, NFR-XXX-nnn
- Related: <docs>, <other ADRs>

## Context
What problem exists, what constraints apply (organizational, legal, operational), and what
would happen if we decided nothing.

## Decision
The decision, stated so that a reviewer can tell whether an implementation complies.

## Alternatives considered
Each with: what it would give us, what it would cost, why it was rejected.

## Consequences
Positive / Negative / Neutral-but-important. Include what becomes *harder*.

## Enforcement
How a violation is detected: a constraint, a test, a review checklist item, a lint rule.

## Revisit trigger
The observable condition under which this decision should be reopened (be specific: a metric,
a cost, a deployment reality).
```

## Rules

1. ADRs are **immutable in substance**. To change a decision, write a new ADR that supersedes
   it and update the old one's status line only.
2. Every ADR must have an **enforcement** section. A decision nobody can detect a violation of
   is not a decision.
3. Every ADR must have a **revisit trigger**. "Never" is only acceptable for ethics decisions
   (e.g. ADR-0024) and must say so explicitly.
4. ADRs may constrain requirements; they may not contradict `PRD.md`. If a requirement and an
   ADR conflict, the PRD wins and the ADR must be amended.
5. Amendments are appended as an `## Amendment YYYY-MM-DD` section, never edited into history.

## Index

See `ADR.md` at the repository root.
