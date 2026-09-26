# ADR-008: Alert Model — Durable, Deduplicated, Condition-Derived Alerts

## Status
Accepted

## Date
2026-09-26

## Context
The product's core bet (PRD §3) is that a few high-signal items beat a complete record. Alerts are where that bet is won or lost: a leaking tap, a full bin before collection day, running out of drinking water, and an AC service that is due all compete for attention. Naive designs ("emit a notification whenever something changes") produce fatigue and are explicitly rejected by DP-4. Alerts must also be *actionable* (what/why/who/what action/when) per FR-ALERT-004, must resolve themselves when the world changes (FR-ALERT-009), and must never deliver the same message twice for one real-world condition (FR-ALERT-005).

## Problem
How should alerts be modelled so they are (a) durable and inspectable in-app, (b) provably deduplicated per real-world condition, (c) automatically resolved, (d) recipient-directed rather than broadcast, and (e) still comprehensible to the household — while keeping delivery mechanics (ADR-009) out of the domain?

## Decision Drivers
- Deduplication and grouping are P0 (FR-ALERT-005..006, FR-ALERT-013).
- Alerts must exist even with zero notification channels configured (in-app truth).
- Multi-step lifecycle: open → acknowledged → (snoozed) → resolved/expired (FR-ALERT-001, 007, 008).
- Escalation requires knowing age and acknowledgement (FR-ALERT-011).
- Every alert must be traceable to a *condition*, so it can be recomputed rather than accumulated.
- Alert evaluation must be pure enough to test (deterministic given state + clock).

## Options Considered
1. **Condition-derived durable alerts with a stable dedupe key**, evaluated on tick and at event time — alerts are recomputed from domain state; the alert row carries lifecycle and recipients.
2. **Pure event-driven notifications without alert records** — simplest; no in-app truth, no way to acknowledge/snooze, no dedupe guarantee, and "why did I get this?" is unanswerable.
3. **Single alert row per (type, entity) that is updated in place forever** — good dedupe; loses lifecycle history of do-ack-snooze cycles and interferes with escalation logic.
4. **Rules engine / DSL configured by users** — powerful, but a configuration burden nobody asked for and a support surface we cannot maintain (DP-3, DP-7).
5. **Per-member alerts (fan-out to recipients at creation)** — convenient delivery, but multiplies rows, makes grouping hard, and turns dedupe into a per-member concern.

## Decision
Adopt **(1) condition-derived, household-scoped, durable alerts with a stable `dedupeKey`**, where each alert is owned by a **source condition** and one open alert per condition is enforced.

Alert record (contract in docs/product/ALERTS.md; types in `src/domain/alerts/types.ts`):
- Identity: `id`, `householdId`, `type`, `priority`, `dedupeKey` (unique among non-terminal alerts per household).
- Content: `title`, `explanation` (why it matters), `expectedAction`, `expectedBy` (when action is expected), `entityRef` (subject), `actionTarget` (deep link).
- Direction: `recipient` (member id or role) + `recipientReason` (assigned / role / owner fallback) — never "everyone".
- Lifecycle: `state` (`OPEN`, `ACKNOWLEDGED`, `SNOOZED`, `RESOLVED`, `EXPIRED`), `createdAt`, `acknowledgedAt?`, `snoozedUntil?`, `resolvedAt?`, `resolutionReason`.
- Provenance: `sourceEventId?`, `evaluatedBy` (`EVENT` | `TICK`), `priorityReason`.

Rules:
- **Evaluation, not accumulation.** `evaluateAlerts(householdState)` computes the desired alert set; the writer creates, refreshes (bumping priority/expectedBy), or auto-resolves alerts whose condition disappeared. Every alert carries the condition that justifies it.
- **Dedupe key** is deterministic and human-auditable, e.g. `TRASH_FULL:container:<id>`, `RESOURCE_CRITICAL:resource:<id>`, `CHORE_OVERDUE:occurrence:<id>`, `ISSUE_REQUIRES_ATTENTION:issue:<id>`. Grouping collisions are intentional where grouping is desired (e.g. `RESOURCE_LOW:household:<id>` groups multiple low items into one shopping alert, FR-RES-009).
- **Auto-resolution is required**: resolving the underlying condition (chore completed, trash collected, resource restocked, issue acknowledged, maintenance recorded) closes the alert with a reason (FR-ALERT-009).
- **Acknowledge ≠ resolve**: acknowledgement stops escalation and assigns ownership; the alert remains until the condition clears (FR-ALERT-007).
- **Snooze is bounded** (household-configurable maximum, default 24 h, options: 1 h / tonight / tomorrow / weekend) and always recorded with actor; a snoozed alert re-opens automatically (FR-ALERT-008, FR-ALERT-012).
- **Escalation** applies only to `IMPORTANT`/`URGENT` and only while unacknowledged beyond the household-configured delay; it raises priority/recipient scope, it does not create a second alert (FR-ALERT-011).
- **Quiet hours** suppress *delivery*, never alert creation (FR-ALERT-012) — in-app truth is always current.
- **Daily caps** are enforced at delivery, with overflow summarised (FR-ALERT-013).
- **Priority** is a statement about consequence (`INFO`/`ATTENTION`/`IMPORTANT`/`URGENT`), never a marketing dial; the reason for a priority is stored (`priorityReason`) so it can be explained (FR-ALERT-014).
- The alert module **never** chooses channels or sends anything; it emits domain events that `notifications` consumes (ADR-009).

## Consequences

### Positive
- One alert per real-world problem, provable by unique constraint + tests rather than by review.
- Alerts survive with zero channels configured: the in-app list is the source of truth.
- Acknowledge/snooze/escalate semantics give the household a way to reduce noise *without* muting reality.
- Auto-resolution prevents "ghost alerts" — the most common source of distrust in alerting systems.
- Alert evaluation is a pure-ish function of state + clock, so it is unit-testable without delivery infrastructure.
- Recipients are explicit, satisfying "do not notify everyone" (FR-NOTIF-010).

### Negative
- Alerts are derived data: they must be recomputed (tick or event) or they go stale.
- More tables/rows than a naive notification log (mitigated by retention and by terminal-state compaction).
- Grouping rules are opinionated and require per-type documentation; a wrong key causes either spam or hidden items.
- Escalation interacts with snooze/acknowledge in ways that need careful test coverage.
- Priority is a judgement call per type; it must be reviewed as the product matures.

## Risks
| Risk | Impact |
| --- | --- |
| Dedupe key too fine → spam | Alert fatigue |
| Dedupe key too coarse → hidden urgency | Missed problems |
| Evaluation never runs (scheduler down) | Silent staleness |
| Escalation loop or duplicate escalation | Trust loss |
| Grouping hides an individual critical item inside a summary | Safety-relevant miss |

## Mitigations
- Dedupe keys are specified per type in docs/product/ALERTS.md and asserted by unit tests (tests/unit/domain/alerts/dedupe.test.ts skeleton).
- The scheduler tick is the safety net: `evaluateAlerts` is idempotent, so a late run converges (ADR-013). Tick liveness is observable (NFR-OBS-003).
- Escalation is modelled as a state transition on the same alert with a recorded count and cooldown; unit tests enumerate the transitions.
- `CRITICAL`/`URGENT` items are never collapsed into summaries without their own visible entry (documented rule).
- Alert counts per member per day are a tracked signal in OPERATIONS.md; exceeding 3/day p95 is a documented review trigger.

## Revisit Conditions
- Users report missed urgent items due to grouping.
- p95 delivered notifications per member per day exceeds 3 for two consecutive weeks.
- A need emerges for user-authored alert rules (would require a new ADR, currently rejected).

## References
- PRD.md — FR-ALERT-001..014, FR-RES-009, FR-NOTIF-010
- docs/product/ALERTS.md, docs/product/NOTIFICATIONS.md
- docs/domain/INVARIANTS.md — I-ALERT-*
- src/domain/alerts/types.ts, src/domain/alerts/ports.ts (skeletons)
- ADR-009 (delivery), ADR-013 (scheduling)
- TASKS.md — T-ALERT-001..035
