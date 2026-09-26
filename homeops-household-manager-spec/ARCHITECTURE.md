# ARCHITECTURE.md — HomeOps System Architecture

> Version 1.0 (skeleton phase) · 2026-09-26 · Status: **DOCUMENTED, NOT IMPLEMENTED**
> Normative for repository structure and module boundaries. Deviations from the planned tree are justified in §9.
> Related: ADR.md (decisions), DOMAIN.md (model), DATA_MODEL.md (persistence shape), docs/architecture/MODULE-MAP.md (dependency detail), docs/architecture/FINAL-REVIEW.md (audit).

## 1. Architectural summary

HomeOps is a **modular monolith**: one Next.js application, one PostgreSQL database, one deployment artifact, one scheduler inside the web process.

```text
                    ┌─────────────────────────────────────────────┐
   Browser / PWA ───▶  Next.js (App Router, Node runtime)         │
   (installed app,   │                                             │
    service worker)  │  app/(public|household)/**  ← routes (thin) │
                    │  features/**                 ← use cases     │
                    │  domain/**                   ← rules, ports  │
                    │  server/**                   ← infra adapters│
                    │  shared/**                   ← cross-cutting │
                    └──────────────┬──────────────────────────────┘
                                   │ (only via repository ports)
                    ┌──────────────▼──────────────┐     ┌───────────────────┐
                    │  PostgreSQL 18 (single DB)  │◀────│ Scheduler in-proc │
                    │  household-scoped rows      │     │ (DB-locked ticks) │
                    └─────────────────────────────┘     └───────────────────┘
```

Three runtime concerns: **HTTP request handling**, **scheduled evaluation** (same process, guarded by a database lock), and **notification delivery** (outbound, best-effort, non-transactional). Nothing else.

## 2. Architectural principles

| ID | Principle | Enforced by |
| --- | --- | --- |
| AP-1 | **Household is the tenancy boundary.** Every scoped read/write flows through a household-scoped port. | ADR-005, docs/security/AUTHZ-MATRIX.md, integration tests |
| AP-2 | **Domain does not know about HTTP, SQL, or React.** It defines types, invariants, events, and ports. | dependency rules §6 |
| AP-3 | **Ports and adapters, applied surgically.** Ports exist where a second implementation is plausible (repositories, notifier, clock, id generator) and nowhere else. | docs/architecture/FINAL-REVIEW.md#abstractions |
| AP-4 | **Server-side authorization always.** UI never decides access. | SECURITY.md |
| AP-5 | **One database, no second stateful service.** No Redis, no message broker, no search cluster. | §3 simplicity budget |
| AP-6 | **Read models are explicit.** The dashboard is a declared snapshot contract, not accidental query composition. | docs/product/DASHBOARD.md |
| AP-7 | **Deterministic time.** All schedule math takes an injected `Clock` and a household timezone. | ADR-007, docs/product/RECURRENCE.md |
| AP-8 | **Idempotency by default.** Every mutation that a household member might double-tap is idempotent. | FR-CHORE-005, FR-TRASH-005 |
| AP-9 | **Honest failure.** Partial failures are visible; nothing is silently swallowed. | DESIGN.md§11 |
| AP-10 | **Simplicity is a feature with an owner.** Any proposal that adds a service must name the requirement it satisfies and the operational cost it adds. | §3 |

## 3. Simplicity budget (explicit)

This section exists to be quoted in review when someone proposes infrastructure.

| Constraint | Position | Why |
| --- | --- | --- |
| **Redis** | Not used. | No caching need (few households × few hundred rows), no cross-process queue need (single process), no rate-limit store need beyond a Postgres table at this scale. |
| **Background infrastructure (broker/worker fleet)** | Not used initially. The scheduler runs in-process with a DB advisory lock. pg-boss is the documented upgrade path (ADR-013). | Scheduled work is minutes-frequent, hundreds of rows, idempotent, and tolerant of a few minutes of delay. |
| **Microservices** | Not used. | One bounded context with tight coupling between chores → alerts → notifications; splitting adds network failure modes for zero throughput gain. |
| **Event bus** | Not used. EVENTS.md is a conceptual catalogue; events are recorded and consumed in-process (transactional outbox table is the only concession). | No second consumer exists. |
| **Separate read database / materialised views** | Not used in v1. Revisit if the dashboard exceeds NFR-PERF-001 with real data. | Avoided speculation. |
| **Search engine** | Not used. Postgres `ILIKE`/trigram or plain filtering is enough. | Household scale. |
| **Container orchestration** | Not used. One container, one database, one reverse proxy. | NFR-MAINT-001. |
| **Offline-first sync engine** | Not used. | ADR-014 defines a deliberately smaller offline contract. |

**Rule:** any addition here requires an ADR update plus a DECISIONS.md entry, and must state which requirement fails without it.

## 4. Layering

```text
        ┌──────────────────────────── app (routes, RSC, route handlers) ───────────┐
        │  thin: parse → validate → call feature service → render/return           │
        └───────────────────────────────┬──────────────────────────────────────────┘
                                        ▼
        ┌──────────────────────────── features (use cases, read models) ───────────┐
        │  orchestrates domain + ports; owns DTOs and authorization context        │
        └───────────────────────────────┬──────────────────────────────────────────┘
                                        ▼
        ┌──────────────────────────── domain (rules, invariants, events) ──────────┐
        │  pure TypeScript; no next/react/drizzle imports; declares ports          │
        └───────────────────────────────┬──────────────────────────────────────────┘
                                        ▼ (implemented by)
        ┌──────────────────────────── server (auth, db, notifications, scheduler,  ┐
        │  telemetry) — adapters that satisfy domain ports                          │
        └──────────────────────────────────────────────────────────────────────────┘

        shared/ is a horizontal leaf library importable by all layers
        (contracts, types, validation, ui, time). It must not import features/domain/server.
```

### 4.1 Layer rules

| Rule | Detail |
| --- | --- |
| L-1 | `app/**` may import `features/**`, `shared/**`, `server/**` (for adapters used at the boundary). |
| L-2 | `features/**` may import `domain/**` and `shared/**`, and `server/**` only for *adapters passed in*, never for direct DB access. |
| L-3 | `domain/**` imports only `shared/types` and `shared/time`. No framework, no ORM, no fetch. |
| L-4 | `server/**` may import `domain/**` (to implement ports) and `shared/**`. |
| L-5 | `shared/**` imports nothing from the layers above it. |
| L-6 | No barrel files (`index.ts`) that re-export across modules; imports are explicit paths. |
| L-7 | Cross-module communication happens through explicit service functions or domain events — never by reaching into another module's internals. |
| L-8 | A `"use client"` file must not import from `server/**` or `domain/**` implementation modules (types-only imports are fine). |

## 5. Domain module map

```text
                        ┌──────────────┐
                        │  household   │◀── tenant root (owns every scoped row)
                        └──────┬───────┘
             ┌─────────────────┼───────────────────────────────┐
             ▼                 ▼                               ▼
        ┌────────┐        ┌────────┐                     ┌──────────┐
        │ members│        │ rooms  │                     │ activity │
        └────┬───┘        └───┬────┘                     └────▲─────┘
             │                │                                │ (append-only)
             ▼                ▼                                │
        ┌────────┐        ┌────────┐   ┌──────────┐   ┌────────┴──┐
        │ chores │◀──────▶│ trash  │   │resources │   │maintenance│
        └───┬────┘        └───┬────┘   └────┬─────┘   └─────┬─────┘
            │                 │             │               │
            └────────┬────────┴─────────────┴───────┬───────┘
                     ▼                              ▼
                  ┌──────┐                     ┌────────┐
                  │alerts│◀────────────────────│ issues │
                  └──┬───┘                     └────────┘
                     ▼
              ┌───────────────┐
              │ notifications │  (delivery only; consumes alerts)
              └───────────────┘

              ┌───────────┐
              │ dashboard │  read-only composition over rooms/chores/trash/
              └───────────┘  resources/maintenance/alerts/activity
```

Allowed dependency directions (arrows above) and the forbidden ones are detailed in docs/architecture/MODULE-MAP.md. **No cycles.** Full matrix is verified by `scripts/verify-docs.mjs` (declared edges) and by code review until an import-lint rule lands in VS-0.

### 5.1 Module responsibilities (one line each)

| Module | Owns | Does not own |
| --- | --- | --- |
| `household` | Household aggregate, roles, timezone, invite lifecycle, tenancy context | Member profile details (members), anything else |
| `members` | Membership, role changes, away status, removal effects | Authentication credentials (auth) |
| `rooms` | Room identity, high-level state, room occupancy of chores | Chore scheduling |
| `chores` | Definitions, occurrences, completions, skips, snoozes, recurrence | Who gets notified |
| `trash` | Containers, container state machine, collection commitments/history | Waste collection schedules of the municipality (text only) |
| `resources` | Consumables, quantity modes, thresholds, restock needs | Shopping list presentation (feature), purchase records |
| `maintenance` | Assets, plans, service records, due computation | Work orders/approvals (NG, ADR-012) |
| `issues` | Issue lifecycle, severity, assignment, comments | Vendor directory management (free-text on the issue) |
| `alerts` | Alert records, dedupe/grouping, escalate/snooze/acknowledge/resolve | Channel choice and delivery mechanics |
| `notifications` (feature+server) | Recipient selection, policy evaluation, channel delivery, delivery records | Alert truth (alert state is never owned here) |
| `activity` | Append-only activity log projection | Source-of-truth data |
| `auth` (server) | Sessions, credentials, CSRF, rate limits, invitation token verification | Household membership rules |

## 6. Dependency rules (normative)

1. `dashboard` may depend on `chores`, `rooms`, `trash`, `resources`, `maintenance`, `alerts`, `activity` — **read-only**.
2. `alerts` may depend on `chores`, `trash`, `resources`, `maintenance`, `issues`, `members`. Nothing depends on `alerts` except `notifications`, `dashboard`, and the UI.
3. `notifications` depends on `alerts`, `members`, and `server/notifications` (adapters). Nothing depends on `notifications` except `server/scheduler`.
4. `activity` is a sink: everyone writes to it, it imports nothing from other modules except shared types.
5. `household` is a source: everyone reads tenancy from it; it never imports another feature module.
6. `issues` may create a follow-up `maintenance` record or `chore`; those modules must not import `issues`.
7. `rooms` is referenced by `chores`, `issues`, `resources` (location) — `rooms` imports none of them.
8. If a dependency seems to require a cycle, the correct fix is a domain event or a read model, never an import.

## 7. Request lifecycle (write path)

```text
1. Request/Server Action arrives
2. proxy.ts (Next 16) applies security headers; no authorization decisions live here
3. Route/action boundary:
   a. load session (server/auth)            → 401 if absent
   b. resolve active household from session → membership row (never from client input)
   c. parse input with Zod                  → VALIDATION_* on failure
   d. authorize (role + ownership)          → HOUSEHOLD_/MEMBER_/AUTH_ errors
   e. call feature service with context { actorId, householdId, clock, repositories }
4. Feature service:
   a. enforce domain invariants (domain/*)
   b. persist via repository ports inside a transaction
   c. append activity record
   d. emit domain event(s) for alert evaluation
5. Alert evaluation (in-transaction or queued for the next tick):
   a. match alert rules, compute dedupe key
   b. create/refresh/auto-resolve alerts
6. Response: revalidate affected paths/tags; return typed result
7. Notification delivery: asynchronous, best-effort, recorded (never blocks step 6)
```

Observability hooks at steps 3, 4, 5 and 7 are named in OBSERVABILITY.md#spans.

## 8. Read path (dashboard)

```text
/today (RSC)
  └─ features/dashboard/queries.getDashboardSnapshot(ctx)
       ├─ alerts.readModel.topForHousehold()      (urgent + important, grouped)
       ├─ chores.readModel.dueToday()             (+ overdue, bounded)
       ├─ rooms.readModel.statusSummary()
       ├─ resources.readModel.lowAndCritical()
       ├─ maintenance.readModel.dueWithin(leadTime)
       └─ activity.readModel.recent(5)
  └─ composition → DashboardSnapshot (single declared contract)
```

Rules: **no** per-card waterfall at render time (contract exists precisely to avoid it), no `SELECT *`, every aggregation must be backed by an index from DATA_MODEL.md. Queries are added only in the owning feature module.

## 9. Repository structure and justified deviations

```text
src/
├── app/            routes only (thin shells in this phase)
├── features/       use cases + read models + presentation units
├── domain/         rules, types, ports, domain errors (no framework)
├── server/         adapters: auth, db, notifications, scheduler, telemetry
└── shared/         contracts, types, validation, ui, time
tests/  unit/ integration/ e2e/
docs/   adr/ architecture/ design/ product/ domain/ api/ security/ testing/ operations/ research/
scripts/ verify-docs.mjs (docs & traceability gate)
```

Deviations from the reference tree, each justified:

| Deviation | Justification |
| --- | --- |
| `src/domain/activity/` added to the domain module list | Activity is a first-class aggregate in DOMAIN.md (§4.12) with its own invariants (append-only, household-scoped, retention-bounded) and is depended on by the audit/observability requirements FR-ACT-001/FR-ACT-005, NFR-PRIV-004, NFR-SEC-009. Modelling it as a feature-only concern would leave retention without an owner. |
| `src/domain/notifications/` intentionally **absent** | Notifications carry no domain rules; they are a delivery concern (FR-NOTIF-001). Recipient *policy* lives in `features/notifications` + `server/notifications`; the alert truth stays in `domain/alerts`. |
| `src/features/notifications/` present though not in the reference list | Settings surfaces (`/settings/notifications`) and preference read models need a feature home that is not `alerts`. |
| `scripts/` added at root | Traceability and docs-consistency checks must be executable (NFR-MAINT-003). A markdown-only traceability table rots silently. |
| `src/server/db/schema/` **absent** | Database *shape* is specified in DATA_MODEL.md and implemented in VS-0+ migrations. Shipping table definitions here would be accidental implementation (forbidden by this phase's rules). |
| `src/shared/ui/` limited to three primitives (`app-shell`, `status-badge`, `empty-state`) | Only primitives that encode a **cross-cutting rule** (status semantics NFR-A11Y-003, shell/nav N-1..N-6, empty-state contract §9) exist now. Everything else is created when a page needs it, in that feature. |
| `src/app/sw.ts` (service-worker entry) lives inside `app/` | @serwist/next requires the worker entry beside the router (`app/sw.ts` convention, ADR-014). It is compiled into a separate bundle at build time and is never a route; nothing imports it (docs/research/STACK-2026.md §9). |
| `src/app/api/cron/[job]/` exists as a shell | The scheduler must be triggerable without the in-process loop (manual run, external cron fallback). The route is a thin shell; the job registry is `src/server/scheduler/jobs/`. |

## 10. State & consistency model

| Concern | Decision |
| --- | --- |
| Source of truth | Postgres. No client-side source of truth for anything that matters. |
| Transactions | One transaction per use case, via `server/db/unit-of-work`. Repository ports never open their own transactions. |
| Optimistic UI | Allowed for idempotent actions; must be undoable (DESIGN §7). |
| Concurrency | Optimistic concurrency via `updatedAt`/version column on mutable aggregates; conflicts surface as E-4, never silently overwritten. |
| Derived state | Room status, alert state, and dashboard snapshot are **derived** and recomputable. Never store a derived value as authority. |
| Time | Stored as absolute UTC instants + household timezone; civil dates stored as `date` for schedule anchors. |
| Denormalisation | Only where an index demands it (e.g. `nextDueAt` on occurrences), and always recomputed by the owning module. |

## 11. Failure behaviour

| Failure | Behaviour |
| --- | --- |
| DB unavailable | Requests fail fast with E-5; health readiness reports unhealthy; scheduler ticks are skipped (not stacked). |
| Scheduler tick overlaps | Database advisory lock: the second tick exits immediately (single-flight). |
| Scheduler tick throws | Recorded with a metric + log; next tick retries; no partial state committed (each job is transactional). |
| Notification delivery fails | Domain change stands; delivery attempt recorded; retry with backoff capped; failure visible to the operator (RUNBOOK.md). |
| Push subscription gone (404/410) | Subscription removed; member not notified again on that device (FR-NOTIF-007). |
| Recurrence materialisation late | Occurrences are computed idempotently from schedule + last completion, so a late tick produces correct state, not duplicates. |
| Clock/timezone change | Never rewrites history; only future occurrences are recomputed (FR-HH-008). |

## 12. Extensibility seams

Deliberately open (cheap to extend, no speculative code today):

| Seam | Extend by | Documented in |
| --- | --- | --- |
| Notification channels | Implementing `NotificationChannel` port + registering it | NOTIFICATIONS.md, ADR-009 |
| Queue semantics | Swapping the in-process scheduler for pg-boss behind the same job registry | ADR-013 |
| Query layer | Replacing Drizzle adapters behind repository ports | ADR-003 |
| Recurrence extensions | Adding rule variants behind `RecurrenceRule` union | RECURRENCE.md, ADR-007 |
| Localisation | Adding a locale bundle to the strings module | PRD §2 |
| Photo storage | Swapping filesystem adapter for object storage behind `AttachmentStore` | PRIVACY.md, SECURITY.md |

Deliberately closed: multi-household organisations (ADR-005), public API, offline full sync (ADR-014), gamification (PRD NG-3), CMMS depth (ADR-012).

## 13. Architectural risks

| Risk | Impact | Mitigation | Revisit trigger |
| --- | --- | --- | --- |
| Next.js App Router cache semantics surprise (stale dashboard) | Members see wrong "what's due" | Explicit cache tags + `revalidateTag` per mutation; staleness indicator; no implicit caching relied upon | Two stale-data bug reports |
| In-process scheduler blocked by a deploy restart | Missed alert tick | Jobs are idempotent and catch-up capable; health check exposes last successful tick | Missed tick > 15 min in practice |
| Derived room status becomes confusing | Members distrust state | ADR-010 keeps the rule set tiny and shows *why* a room is flagged | Confusion reported twice |
| Alert fatigue creeps back in | Product core value lost | Dedupe/group/cap are P0 requirements with tests | p95 alerts/member/day > 3 |
| Recurrence edge cases (months, DST, completion-based) | Wrong due dates | ADR-007 + a dedicated unit test suite skeleton; no algorithm implemented yet | Any recurrence bug in production |
| Drizzle version-line ambiguity at VS-0 | Churn | Pin exact version, record in DECISIONS.md | Breaking minor change encountered |

## 14. Definition of "architecturally done" for any future task

A task is complete only when: requirement linked, ADR respected (or superseded), module boundary intact, invariants enforced in domain code, authorization enforced server-side, activity recorded where required, alerts/notification effects considered, tests present (unit + integration where a boundary is crossed), a11y states handled (DESIGN §9–11), and observability hooks named. Nothing less. See AGENTS.md#definition-of-done.
