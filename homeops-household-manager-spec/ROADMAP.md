# ROADMAP.md — Vertical Slice Plan

> 2026-09-26 · Status: **VS-0 IMPLEMENTED (2026-09-27); VS-1 NOT STARTED** · Task-level detail: TASKS.md · Requirement mapping: docs/TRACEABILITY.md
> VS-0 (T-PLAT-001 … T-PLAT-028) is implemented: the app boots, connects, migrates, seeds, ticks the scheduler behind an advisory lock, and passes typecheck, lint, format, the unit tier, the docs gate, the contrast gate and a production build. The integration tier is written but skips locally where no scratch Postgres exists; it runs in CI against the `postgres:18` service.

## 1. Delivery philosophy

| Principle | Rule |
| --- | --- |
| Vertical slices, not layers | Every slice ends with something a household member can actually do in the real app. |
| Thin but complete | Each slice implements its domain rules *and* its UI *and* its tests *and* its telemetry for a narrow capability. |
| No slice without a user | If a slice cannot be demonstrated by a member doing something, it is not a slice. |
| Foundation is short | VS-0 is deliberately small (boot, DB, CI, time) — not a platform project. |
| Safety before breadth | Security/privacy/observability hardening (VS-14/VS-15) also happen continuously as exit criteria per slice; the dedicated slices exist to catch what slipped. |
| Reversibility | Every slice ships behind a working deploy with rollback available. |

## 2. Slice map

| Slice | Name | Outcome (a member can…) | Key requirements | Depends on |
| --- | --- | --- | --- | --- |
| **VS-0** | Foundation | (nobody yet — the app boots, connects to the DB, ticks, and passes CI) | NFR-MAINT-*, NFR-PERF-001 wiring | — |
| **VS-1** | Household + Members | create a household, invite someone, and see roles | FR-HH-*, FR-MEM-001..007, FR-AUTH-* | VS-0 |
| **VS-2** | Rooms | add rooms and see their state | FR-ROOM-001..008 | VS-1 |
| **VS-3** | Basic Chores | create one-off and simple recurring chores, complete and skip them | FR-CHORE-001..013, 019..020 | VS-2 |
| **VS-4** | Dashboard | open `/today` and act on what is due | FR-DASH-001..008 | VS-3 |
| **VS-5** | Recurrence | trust recurring schedules, including "after I last did it" | FR-CHORE-014..018 | VS-4 |
| **VS-6** | Trash | track bin state and record collections | FR-TRASH-001..010 | VS-4 |
| **VS-7** | Resources | track consumables and see what to buy | FR-RES-*, FR-SHOP-* | VS-4 |
| **VS-8** | Maintenance | register assets, schedule services, record what was done | FR-MNT-* | VS-4 |
| **VS-9** | Alerts | see deduplicated, actionable alerts; acknowledge and snooze them | FR-ALERT-001..014 | VS-5..VS-8 |
| **VS-10** | Notifications | get a push for what matters and nothing else | FR-NOTIF-* | VS-9 |
| **VS-11** | Issues | report a problem and follow it to closure | FR-ISSUE-* | VS-4 |
| **VS-12** | Activity | see what happened, per entity and across the household | FR-ACT-* | VS-3 (grows with each slice) |
| **VS-13** | PWA | install the app and use it from the home screen | FR-PWA-* | VS-4 |
| **VS-14** | Security + Privacy | (no new features; hardening is proven and documented) | NFR-SEC-*, NFR-PRIV-* | VS-1..VS-13 |
| **VS-15** | Observability | (operator can diagnose without guesswork) | NFR-OBS-* | VS-0, VS-9, VS-10 |
| **VS-16** | Production | (a household is using it daily; operations are routine) | NFR-REL-*, NFR-MAINT-* | all |

## 3. Slice detail

### VS-0 — Foundation
**Goal:** a deployable shell: Next.js boots with design tokens, Postgres connects, migrations run, the scheduler ticks (jobs no-op), CI is green, the docs gate enforces traceability.
**Contains:** repository tooling, dependency pinning, DB + migration harness, repository/unit-of-work conventions, import-boundary lint, time/clock utilities, scheduler skeleton + advisory lock, health endpoints, Docker + CI, seed script, test harness.
**Exit criteria:** `npm run verify` passes (docs gate, typecheck, lint, unit, integration); `docker compose up` serves a health endpoint; a job tick is observable; no product feature exists.
**Not in scope:** any member-facing screen beyond a placeholder.

### VS-1 — Household + Members
**Goal:** two people can share one home in the app.
**Contains:** auth wiring (sign-up/in/out, sessions, revocation), household creation/settings, membership + roles, invitations, tenant context, authorization enforcement, audit logging for auth/role events.
**Exit criteria:** QA-01, QA-02, QA-08 (isolation) pass; role negative tests pass; sessions are revoked on removal.

### VS-2 — Rooms
**Goal:** the house is modelled as rooms with meaningful states.
**Contains:** room CRUD-lite (create/rename/group/archive), derived status rule set (ADR-010) with an initial rule subset (rules 1, 5, 6), override entity + TTL, room list/detail pages.
**Exit criteria:** QA-03 passes; room status shows a reason; rooms with no chores are honestly `UNKNOWN`.

### VS-3 — Basic Chores
**Goal:** a member can be told what to do today and mark it done.
**Contains:** chore definitions (no recurrence yet, or simple daily/weekly), occurrences, completion/skip/reassign/snooze records, chore list + detail pages, room-scoped chores feeding room status rules 2–5.
**Exit criteria:** QA-04, QA-05 pass; idempotent completion verified; activity records present.

### VS-4 — Dashboard
**Goal:** one screen answers "what should I do now?".
**Contains:** `DashboardSnapshot` read model + composition, all nine sections, quick actions, empty/loading/error states, cache-tag revalidation on mutations, performance budget check.
**Exit criteria:** QA-13 passes; PB-S1 and PB-C1..C5 within budget on a throttled profile.

### VS-5 — Recurrence
**Goal:** recurring chores behave exactly as members expect, including completion-anchored.
**Contains:** full rule union, materialisation job, completion-anchored mode, month clamping, DST handling, horizon config, recurrence-edit reconciliation, describe-in-words formatter.
**Exit criteria:** the recurrence unit suite (including DST/month/leap cases) is green; scheduler creates exactly one open occurrence per definition.

### VS-6 — Trash
**Goal:** bins are never a surprise.
**Contains:** containers, the state graph with hysteresis, state events, collection assignment + records, collection schedule, trash alerts (via VS-9 for delivery; state-only in this slice), dashboard card.
**Exit criteria:** QA-06 passes; one alert per container condition; history ≥ 30 days visible.

### VS-7 — Resources
**Goal:** the household stops running out of things silently.
**Contains:** resources with three quantity modes, thresholds with defaults, quick updates, restock, grouped low/critical needs, shopping list + text export, dashboard card.
**Exit criteria:** QA-07 passes; grouped alert behaviour verified; no fake precision anywhere in the UI.

### VS-8 — Maintenance
**Goal:** AC services, filters and tank cleaning happen on time and leave a record.
**Contains:** assets, plans, frequencies, lead time, service records (≤3 fields), vendor notes, pause, due computation + dashboard card, consistency recompute job.
**Exit criteria:** QA-10 passes; `nextServiceAt` recomputable; history visible per asset.

### VS-9 — Alerts
**Goal:** everything that needs attention is in one trustworthy place — and only once.
**Contains:** alert records + transitions, `evaluateAlerts` engine with dedupe keys, grouping, priority model with reasons, acknowledge/snooze/resolve/expire, escalation, quiet hours, caps, alerts page + dashboard attention strip, scheduler jobs for evaluation, explain-why surface.
**Exit criteria:** QA-11 passes; dedupe/escalation unit tests green; zero duplicate open alerts for a condition under repeated ticks.

### VS-10 — Notifications
**Goal:** the right person is told, once, on a channel they chose.
**Contains:** preference matrix, quiet hours, caps/digest, recipient resolution, outbox drain, in-app channel semantics, Web Push (VAPID) with subscription lifecycle, optional email for invites/recovery, delivery records + metrics.
**Exit criteria:** QA-12 passes on a real device; suppressed/failed deliveries are explained; no broadcast paths exist.

### VS-11 — Issues
**Goal:** a problem reported once is visible until it is closed.
**Contains:** issue creation (≤20 s), severity, lifecycle transitions + audit, assignment, comments, photo attachments (per proposed ADR-017), follow-up chore/maintenance creation, issue list/detail, alert integration.
**Exit criteria:** QA-09 passes; lifecycle negative tests pass; photos are EXIF-stripped and access-controlled.

### VS-12 — Activity
**Goal:** the household can see what happened without asking each other.
**Contains:** activity projection for every fact type, entity history sections, `/activity` with filters and keyset pagination, retention pruning job + settings, privacy review of what is recorded.
**Exit criteria:** every mutating operation in API.md produces the documented activity; pruning verified; no surveillance-adjacent fields exist.

### VS-13 — PWA
**Goal:** HomeOps lives on the phone home screen.
**Contains:** manifest + icons, Serwist service worker (shell precache, network-first data), offline fallback, staleness banner, update prompt, install guidance (incl. iOS), push permission UX in settings.
**Exit criteria:** QA-14 passes on Android and iOS; Lighthouse installability; no stale-data-as-current path exists.

### VS-14 — Security + Privacy
**Goal:** close the gaps that inevitably accumulated.
**Contains:** full authorization matrix audit, isolation test sweep across every port, rate-limit verification for every abuse class, CSP/header verification in production, upload hardening review, log/PII audit, export + deletion procedures, threat-model review, dependency patch pass.
**Exit criteria:** every THREAT_MODEL row has a passing verification; PRIVACY.md §10 checklist signed per surface.

### VS-15 — Observability
**Goal:** the operator can diagnose scheduler, delivery, alert and auth failures from signals alone.
**Contains:** OTel instrumentation (spans/metrics) per OBSERVABILITY.md, logger allow-list enforcement + tests, health readiness depth, dashboards, threshold wiring, slow-query visibility, sampling config.
**Exit criteria:** each threshold in OBSERVABILITY.md §7 can be evaluated from emitted signals; a simulated scheduler stall and a simulated delivery failure are both diagnosable from telemetry.

### VS-16 — Production
**Goal:** a real household uses it daily and the operator's routine is boring.
**Contains:** deploy pipeline finalisation (image tags, migrations pre-deploy, rollback drill), backup + restore drill evidence, TLS/domain checklist, host hardening, retention verification, upgrade cadence, runbook dry-runs, release notes, first-month review against success signals (PRD §7).
**Exit criteria:** NFR-REL-001..005 satisfied with evidence; RUNBOOK scenarios rehearsed; performance budgets met on the production instance with real data.

## 4. Sequencing rules

1. **VS-5 before VS-9**: alerts depend on reliable due/overdue facts.
2. **VS-9 before VS-10**: delivery without alert truth would be spam.
3. **VS-12 (activity) grows continuously** — every slice adds its activity types; the slice exists to add the *browsing* surface and retention.
4. **VS-14/VS-15 are not a "hardening phase"** — each slice's exit criteria include its own security, privacy, a11y and telemetry items; the dedicated slices mop up and prove.
5. **VS-16 is not a launch party** — it is the first run of the operational routine with evidence.
6. Any slice can be paused; no slice may skip its exit criteria to start the next.
7. No slice may add a new stateful service without an ADR (ARCHITECTURE.md §3).

## 5. What is deliberately NOT on this roadmap

Multi-household organisations · native apps · offline write sync · chat/social features · gamification · vendor marketplace · expense tracking · smart-home integrations · iCal/CalDAV sync · public API · multi-language UI beyond centralised strings · AI/ML features. Each requires a PRD change plus an ADR (AGENTS.md §7).
