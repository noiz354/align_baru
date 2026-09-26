# ADR.md — Architecture Decision Record Index

> 2026-09-26 · Status: **16 accepted decisions** · Owner: Principal Architect
> Individual records live in `docs/adr/`. Each record follows the same template: Status, Date, Context, Problem, Decision Drivers, Options Considered, Decision, Consequences (Positive/Negative), Risks, Mitigations, Revisit Conditions, References.
> **No ADR in this index has been implemented.** Decisions describe the intended implementation; skeleton files only declare contracts.

## Why ADRs here

A single-developer household app still makes irreversible choices (tenancy model, recurrence semantics, alert lifecycle). Writing them down serves three purposes: (1) a coding agent can implement a task without re-deciding architecture, (2) a future maintainer learns *why*, (3) a decision can be superseded explicitly rather than drifting.

## Index

| ADR | Title | Status | Area | Supersedes |
| --- | --- | --- | --- | --- |
| [ADR-001](docs/adr/ADR-001-web-framework.md) | Web framework: Next.js App Router | Accepted | Platform | — |
| [ADR-002](docs/adr/ADR-002-database.md) | Database: PostgreSQL 18 | Accepted | Platform | — |
| [ADR-003](docs/adr/ADR-003-data-access.md) | Data access: Drizzle + postgres.js behind repository ports | Accepted | Platform | — |
| [ADR-004](docs/adr/ADR-004-authentication.md) | Authentication: Better Auth with database sessions | Accepted | Security | — |
| [ADR-005](docs/adr/ADR-005-household-tenancy.md) | Household tenancy: single-household rows with scoped ports | Accepted | Domain | — |
| [ADR-006](docs/adr/ADR-006-domain-task-model.md) | Domain task model: chore definition vs occurrence vs completion | Accepted | Domain | — |
| [ADR-007](docs/adr/ADR-007-recurrence-engine.md) | Recurrence engine: calendar-anchored rules with completion-based mode | Accepted | Domain | — |
| [ADR-008](docs/adr/ADR-008-alert-model.md) | Alert model: durable, deduplicated, condition-derived alerts | Accepted | Domain | — |
| [ADR-009](docs/adr/ADR-009-notification-model.md) | Notification model: alerts and delivery separated by policy | Accepted | Domain | — |
| [ADR-010](docs/adr/ADR-010-room-status-model.md) | Room status: hybrid derivation with expiring manual override | Accepted | Domain | — |
| [ADR-011](docs/adr/ADR-011-resource-inventory-model.md) | Resource inventory: three quantity modes, no invented precision | Accepted | Domain | — |
| [ADR-012](docs/adr/ADR-012-maintenance-model.md) | Maintenance: lightweight plans and service records, not a CMMS | Accepted | Domain | — |
| [ADR-013](docs/adr/ADR-013-background-processing.md) | Background processing: in-process scheduler with DB single-flight; pg-boss as the upgrade path | Accepted | Platform | — |
| [ADR-014](docs/adr/ADR-014-pwa-strategy.md) | PWA strategy: installable shell, honest staleness, no full offline sync | Accepted | Platform | — |
| [ADR-015](docs/adr/ADR-015-observability.md) | Observability: OTel traces/metrics + structured stdout logs, zero household content | Accepted | Operations | — |
| [ADR-016](docs/adr/ADR-016-deployment.md) | Deployment: single container + managed Postgres, Docker Compose | Accepted | Operations | — |

## Decision dependencies

```text
ADR-001 (framework) ──┬── ADR-013 (scheduler lives in the web process)
                      ├── ADR-014 (PWA built on App Router)
                      └── ADR-016 (deployment artifact)

ADR-002 (database) ───┬── ADR-003 (access layer over Postgres)
                      ├── ADR-005 (tenancy enforced with scoped rows)
                      ├── ADR-013 (DB lock + outbox, no broker)
                      └── ADR-016 (backup/restore story)

ADR-005 (tenancy) ────┬── ADR-004 (sessions carry the household context)
                      ├── ADR-008 (alerts are household-scoped)
                      └── ADR-009 (recipients come from household membership)

ADR-006 (task model) ─┬── ADR-007 (recurrence produces occurrences)
                      └── ADR-008 (chore due/overdue is an alert source)

ADR-008 (alerts) ─────┬── ADR-009 (policy decides delivery)
                      └── ADR-010/011/012 (each domain contributes alert conditions)
```

## Planned decisions not yet accepted (tracked, not decided)

| Candidate | Question | Trigger to decide | Owner |
| --- | --- | --- | --- |
| ADR-017 (proposed) | Photo storage: filesystem volume vs object storage | When FR-ISSUE-008 photos are implemented (VS-11) | Architecture |
| ADR-018 (proposed) | Queue adoption: pg-boss vs stay in-process | Missed/late notification delivery observed in VS-10 | Architecture |
| ADR-019 (proposed) | Email provider selection | Email channel implementation (VS-10) | Architecture |
| ADR-020 (proposed) | Multi-household support | A real user with two homes (assumption A-1 breaks) | Product |

## Process rules

1. **When an ADR is required:** a choice that is hard to reverse, spans modules, changes a boundary, or constrains future tasks (framework, storage, auth, tenancy, scheduling, delivery, deployment).
2. **When it is not:** naming, local component structure, copy, single-module refactors.
3. **How to supersede:** never edit a past decision's substance. Add a new ADR, mark the old one `Superseded by ADR-NNN`, and add a DECISIONS.md entry.
4. **Traceability:** every ADR lists references to requirements (PRD.md), designs (`docs/product/*`, `docs/design/*`) and tasks (TASKS.md). `scripts/verify-docs.mjs` checks that referenced files exist and are referenced back.
5. **Status vocabulary:** `Proposed` → `Accepted` → (`Superseded by …` | `Deprecated`). A superseded ADR keeps its record.

## Template

```markdown
# ADR-NNN: Title

Status
Date

## Context
## Problem
## Decision Drivers
## Options Considered
## Decision
## Consequences
### Positive
### Negative
## Risks
## Mitigations
## Revisit Conditions
## References
```
