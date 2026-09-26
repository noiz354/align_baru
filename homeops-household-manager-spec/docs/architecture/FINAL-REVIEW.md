# HomeOps - Final Architecture Review

**Date:** 2026-09-26 · **Reviewer:** Principal Software Architect (specification phase) · **Scope:** documentation, architecture, and skeleton only
**Verdict:** **PASS WITH NAMED GAPS.** The specification is implementable task-by-task without guessing; the gaps in §9 are scheduled work, not unknowns.

## 1. What was reviewed

| Artefact | Count | Checked for |
|---|---|---|
| PRD requirements | 204 (179 P0/P1, 25 P2) | testability, single meaning, no hidden scope |
| ADRs | 16 accepted + 4 proposed | fixed section set, decision vs. description |
| Root documents | 28 | non-empty, mutual consistency, no duplicated authority |
| Sub-documents | 29 | agreement with root docs |
| Domain modules | 10 (skeleton: 40 files) | invariants, boundaries, cycles |
| Vertical slices | 17 (VS-0..VS-16) | each produces something runnable |
| Tasks | 252 | requirement/ADR/design/module/cases/security/tests present |
| Skeleton files | 175 (128 under `src/`, 44 under `tests/` - 16 unit, 11 integration, 15 e2e, 2 harness, 3 tooling: `scripts/*`, `.github/workflows/ci.yml`) | no fake implementations; 141 not-implemented throws; 151 todo/fixme test markers |
| Traceability | 244 lines, generated | 179/179 P0/P1 mapped |

Method: read every document, then attempt to *implement T-CHORE-021 and T-ALERT-027 from the specification alone* and record every point where guessing was required. Those points became the gap list in §9.

## 2. Complexity budget

The brief said "solve the household's problems, do not build an ERP". Measured against that:

- **10 domain modules, 0 of which exist for a phantom requirement.** Every module traces to at least one P0 use case named in the brief.
- **One datastore, one process, one deployable.** No message broker, no cache tier, no search engine, no worker fleet.
- **Rows are small.** The largest table (`activity_event`) is append-only and pruned at 12 months; nothing grows by design without a retention rule.
- **No abstraction without two callers.** Ports exist because jobs, adapters, and tests need substitution - not because "enterprise". There is no generic repository, no specification pattern, no event sourcing, no CQRS.

| Complexity indicator | Budget | Actual | Verdict |
|---|---|---|---|
| Runtime services | 3 (web, db, proxy) | 3 | ✅ |
| Domain modules | ≤ 12 | 10 | ✅ |
| Tables | ≤ 30 | 24 planned | ✅ |
| Tables with a queue shape | 1 (`notification_outbox`) | 1 | ✅ |
| Background jobs | ≤ 6 | 4 + maintenance | ✅ |
| Cross-module imports per module | ≤ 3 | max 3 (alerts) | ✅ |
| Env vars the app requires | ≤ 12 | 11 | ✅ |

## 3. ERP-creep check

| ERP-flavoured feature | Status | Guard |
|---|---|---|
| Cost tracking / budgets / invoices | **not built** | PRD NG-2, DESIGN.md §18 |
| Asset depreciation, warranty registries, part inventories | **not built** | `docs/product/MAINTENANCE.md` §"not a CMMS" |
| Time tracking / effort estimates / productivity scores | **not built** | PRD NG-4; activity log records actions only |
| Gamification, streaks, leaderboards, points | **not built** | DESIGN.md §18; "never blame a member" |
| Roles matrices beyond four roles | **not built** | ADR-006 |
| Custom fields / workflow builder / rules engine | **not built** | ALERT-035 is a fixed settings page, not a builder |
| Multi-household, orgs, teams, tenants-as-a-service | **deferred** | ADR-020 (proposed) |
| Chat / comments-as-discussion | **bounded** | comments exist only on issues, append-only (I-ISSUE-006) |
| Reporting dashboards / exports as a feature area | **bounded** | one dashboard, one JSON export (T-PRIV-003) |

The pressure point to watch is maintenance: the first household that asks for "cost of last service" will pull in receipts, vendors, and budgets. `Maintenance` should stay date-and-action shaped; the answer to that request is a note on the service record, not a new field. Revisit only if three households ask (RISK-4).

## 4. Infrastructure simplicity (no Redis, no distributed architecture)

- **No Redis, no BullMQ.** Chosen deliberately: at household scale the queue shape is one table and the trigger is one in-process timer guarded by a Postgres advisory lock (ADR-013). Adding Redis would add a datastore to back up, monitor, and lose - for a workload of a few writes per hour.
- **Postgres does the hard parts.** `uuidv7()` ids, partial unique indexes for "one open alert per dedupe key" and "one open occurrence per definition", `FOR UPDATE SKIP LOCKED` for the outbox drain, advisory locks for single-flight.
- **One read model.** `DashboardSnapshot` is computed server-side from plain reads; no materialised view, no cache layer, no invalidation problem (DESIGN.md §6, DASHBOARD.md).
- **Failure domain.** The whole product is one container plus a database on a single VPS; recovery is `pg_dump` + a redeploy (RPO ≤ 24 h, RTO ≤ 2 h, `docs/operations/BACKUP-RESTORE.md`). There is no partial-outage mode to reason about.
- **Escalation path if scale ever demands it:** the in-process tick can be replaced by pg-boss (ADR-018, proposed) without touching a single domain function, because jobs and domain services are already separated.

## 5. Alert-fatigue review

This is the failure mode most likely to kill a household app, so it gets its own budget.

| Control | Where designed | Verified by |
|---|---|---|
| Dedupe key per alert type; one non-terminal alert per key (partial unique index) | ADR-008, `alerts/dedupe.ts` | T-ALERT-033 sweep, `tests/unit/domain/alerts/dedupe.test.ts` |
| Grouping (all low supplies = one alert with a count, never one per item) | ALERTS.md §4 | dedupe test |
| Priority defaults + rise/fall rules; nothing is URGENT by default except safety | ADR-008, `alerts/priority.ts` | priority test |
| Snooze with a maximum (24 h default), automatic re-open | ALERTS.md §6 | lifecycle test |
| Acknowledge ≠ resolve; ack stops escalation and assigns an owner | I-ALERT-004 | lifecycle test |
| Escalation once per cooldown, and only for IMPORTANT/URGENT | ALERT-011 | priority test |
| Quiet hours suppress delivery, never creation; next-allowed-window queueing | ADR-009 | policy test |
| Caps + digest: one digest per window when the cap overflows | ADR-009 | policy test |
| Recipient selection: assigned → role → owner; never a broadcast | ADR-009 | recipients test |
| Every alert answers the five questions or fails creation | I-ALERT-002 | content test |
| Empty day = all-clear state, not an empty list | DASHBOARD.md §5 | E2E QA-13 |

Counter-check performed by walking the triggers in `docs/product/ALERTS.md` against the dashboard's fixed section order: on a settled household day, most sections are empty and the all-clear state is the normal case, so the design's expectation is a handful of deliveries per day rather than dozens. **No delivery frequency has been measured yet** - the number is a design intent, not evidence, and the first real measurement is the counter assertion in T-ALERT-032. Until then the caps and the digest are the safety net.

## 6. Household isolation review (the security-critical property)

- `HouseholdContext` is minted in exactly one place (`src/server/auth/context.ts`) from the session; no route, action, or job accepts a household id from input (ADR-005, T-SEC-002).
- Every repository port takes `householdId` as its **first** parameter, so an unscoped call cannot be written by accident - the type system refuses it (I-XA-001).
- Cross-household ids return `NOT_FOUND`, never `FORBIDDEN`, so existence is not confirmed.
- Child rows (occurrences, comments, records, attachments, state events) have no independent scope: they are reached through their parent and checked by the same rule (`INVARIANTS.md` I-XA-002).
- `T-SEC-002` is a release-blocking sweep: one negative test per port, executed in `tests/integration/household/isolation.test.ts`. Adding a port without adding a row there fails review.
- Residual risk: a single missed `householdId` predicate in a hand-written aggregate query is the realistic failure. Mitigation: aggregate reads live in `src/domain/*/ports.ts` implementations only, are reviewed as such, and the isolation sweep asserts results rather than intent. RLS was considered and deferred (ADR-002) - it is a candidate if this project ever gains a second contributor writing SQL.

## 7. Cycles and dependency direction

`tests/unit/architecture.test.ts` asserts the graph is acyclic and that the layered import rules hold; `T-PLAT-006` enforces them in the editor and CI. As specified:

- `dashboard → {rooms, chores, trash, resources, maintenance, alerts}` with no reverse edge.
- `alerts` consumes condition snapshots as values, so it imports no module's repository - the one place a cycle would otherwise appear.
- `rooms → chores` (read-only evidence) is the only cross-domain read edge; there is no `chores → rooms`.
- `features/*` never import each other; `domain/**` imports nothing from above it; `src/shared` is a leaf.

## 8. Traceability

`docs/TRACEABILITY.md` is **generated** by `scripts/build-traceability.mjs` (dependency-free, deterministic, rerunnable) and fails CI through the T-PLAT-008 gate when it drifts. Current state:

- 204 requirement rows; **P0/P1 179/179 mapped**; P2 16/25 mapped.
- 252 tasks, each carrying requirement, ADR, slice, module, cases, security, tests, docs.
- 6 tasks legitimately cite no requirement (harness/process tasks T-PLAT-009/016/018, T-TIME-001, T-QA-001..003, T-DOC-005) and are listed as such rather than given a fake mapping.
- 0 domain modules without an owning task family.

## 9. "Can an agent implement one task without guessing?"

Test: take the first implementation task, `T-HH-001`, and follow AGENTS.md §3. Every question had a written answer:

| Question | Answered by |
|---|---|
| What exactly is in scope? | TASKS.md entry + its `Cases` list |
| Which requirements does it satisfy? | `Req` field → PRD row text |
| What are the rules and edge cases? | the PRD row + the relevant product doc |
| What shape is the data? | DATA_MODEL.md + `src/domain/*/types.ts` |
| Where does the code go? | `Module` field + MODULE-MAP.md + the existing skeleton file |
| What may it not do? | AGENTS.md forbidden-actions table + ARCHITECTURE.md constraints |
| What errors are possible? | docs/api/ERROR-CATALOG.md + `src/shared/errors/codes.ts` |
| Who may call it? | docs/security/AUTHZ-MATRIX.md |
| How will it be verified? | `Tests` field + the matching test skeleton file with named cases |
| How does a human sign it off? | QA.md scenario + the mirrored `tests/e2e` spec |

**Gaps found (all scheduled, none blocking):**

| # | Gap | Impact | Resolution | Status |
|---|---|---|---|---|
| 1 | P2 requirements are only 16/25 traceable to a task | Low: P2 is post-VS-16 | Map the remainder when P2 is scheduled | Open, accepted |
| 2 | ADR-017..020 are proposed, with no file yet | Low: they gate PWA, jobs-scale, email, and multi-household work that starts after VS-12 | Files are created at the slice that needs them (ROADMAP.md) | Open, accepted |
| 3 | `docs/design/INTERACTION-PATTERNS.md` fixes interaction behaviour but not pixel layout | Low: layout is a design pass inside each slice | Accepted: layout is deliberately not frozen before real screens exist | Open, accepted |
| 4 | Component-level a11y assertions are per-page (T-A11Y-001), not per-primitive | Low | Add primitive-level assertions with the first feature that owns the primitive | Open |
| 5 | ~~Traceability is maintained by hand~~ | - | Resolved: `docs/TRACEABILITY.md` is generated by `scripts/build-traceability.mjs` and gated in CI (T-PLAT-008); hand-editing is forbidden | **Closed 2026-09-26** |
| 6 | 15 E2E specs use Playwright's `test.fixme` rather than Vitest-style `describe.todo`, because Playwright has no `describe.todo` | Cosmetic | Documented in each spec header | Open, accepted |
| 7 | Newly discovered skeleton tasks were consolidated rather than expanded: `T-PLAT-015` narrows to token/contrast verification (wiring stays in `T-PLAT-002`), and the test harness/fixtures/seed/scripts work sits in `T-PLAT-016`, `T-PLAT-018`, and `T-PLAT-017` | Low | Deliberate: fewer tasks, each already cited from the skeleton and from `docs/testing/TEST-DATA.md` | Open, accepted |
| 8 | Alert-frequency target in §5 is an estimate | Medium if wrong: over-notifying is the top product risk | First real measurement is T-ALERT-032; the cap and digest are the safety net until then | Open, tracked |

## 10. Issues found and fixed during this review

| # | Issue | Fix |
|---|---|---|
| 1 | Requirement census undercounted because `[A-Z]+` regexes missed `NFR-A11Y-*` (196/171 reported vs. 204/179 true) | Fixed: `[A-Z0-9]+`, census re-derived, `T-RES-013` and `T-ALERT-028` patched |
| 2 | Module count differed across documents (12 vs 10) | Reconciled to 10 everywhere; MODULE-MAP.md is now the single list |
| 3 | Scheduler job shells returned zero-count placeholders (`{ created: 0 }`) | Replaced with `throw new Error('Not implemented: T-XXX-NNN')` - a placeholder is a fake implementation |
| 4 | `shop` was listed as a domain module in DOMAIN.md but has no folder | Corrected: shopping lives inside `resources` (DECISIONS.md) |
| 5 | `T-PLAT-019` was referenced by the tooling but defined nowhere | Repointed to `T-PLAT-008` (the docs gate); no third docs task created |
| 6 | A design-system table implied primitives that do not exist yet | Marked as planned; only `app-shell`, `status-badge`, `empty-state` exist in this phase |
| 7 | `T-RESOURCE-014` (legacy alias) leaked into DECISIONS.md and GLOSSARY.md | Normalised to `T-RES-014`; the alias is recorded once, in TASKS.md §"Legacy aliases" |
| 8 | `docs/api/ERROR-CATALOG.md` cited a non-existent task `T-MEM-010` | Repointed to `T-AUTH-004` |

## 11. Residual risks

| Risk | Likelihood | Impact | Mitigation | Revisit when |
|---|---|---|---|---|
| Over-notification damages trust (RISK-1) | Medium | High | Caps, digest, quiet hours, dedupe unique index, all-clear states | T-ALERT-032 measurement; any member asks to mute |
| Recurrence edge cases (DST, clamping, completion-anchored) produce wrong due dates (RISK-2) | Medium | High | 20+ named unit cases; anchor-based math; never advance from `now()` | Any recurrence bug report: add a case, then fix |
| A missed `householdId` predicate leaks data (RISK-3) | Low | Severe | Type-enforced port signature, isolation sweep, 404-not-403 | Any new port without a sweep row |
| Maintenance drifts toward CMMS (RISK-4) | Medium | Medium | Field-level "not in scope" table, review of every new maintenance field | A task proposes cost/vendor/depreciation fields |
| Skeleton and docs drift as implementation starts (RISK-5) | Medium | Medium | T-PLAT-008 gate, traceability regeneration, AGENTS.md forbidden-action table | First drift caught by CI |
| Single-VPS availability (RISK-6) | Low | Medium | Nightly dumps, weekly restore drill, RTO ≤ 2 h documented | Any incident exceeding RTO |

## 12. Verdict

The specification is **coherent, implementable, and honest about what it does not yet know**. Complexity is inside budget, the anti-ERP and anti-fatigue guards are concrete rather than aspirational, isolation is enforced by types and tested per port, there are no cycles by construction, and traceability is generated rather than asserted. The single largest product risk - notification fatigue - is designed against with six independent controls and has a scheduled measurement task.

**Recommended next action:** begin `T-HH-001` (create household end-to-end) as the first implementation task, following AGENTS.md §3. Do not start a second task until VS-0's remaining tooling tasks are done, because the gates are what keep this skeleton honest while code lands.
