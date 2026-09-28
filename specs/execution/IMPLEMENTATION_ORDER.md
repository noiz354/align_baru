# IMPLEMENTATION ORDER

## Rules

1. **Wave 0 clears before Wave 1 starts.** A team may run several Wave 0 features in parallel across
   projects. It may not start a Wave 1 feature in a project while that project has an open Wave 0.
2. **Every slice lands with its acceptance test.** `specs/SECURITY.md` §S-8.4. A slice without a test
   is not done; it is a smaller P0.
3. **One feature at a time per project.** See `OWNERSHIP.md` for which files are shared.
4. **No Wave 3 work while a Wave 0 boundary is open.** Specifically: no dashboard polish, no design
   system, no feature expansion, while an unauthenticated write is possible.
5. **Evidence is produced on the production stack** (`ADR-001`). A PGlite run is not proof.

---

## Wave 0 — safety blockers

Nothing ships in production before this wave is complete. Every item here is a measured defect.

| # | Feature | Project | Est. | Depends on | Why first |
|---|---|---|---:|---|---|
| 0.1 | **F-004** migration journal | homeops | 90 min | — | Cheapest fix in the plan. Without it every other homeops change is unprovable, and the deploy pipeline is silently broken today. |
| 0.2 | **F-001-S1** close the inverted guard | siomayops | 30 min | — | The highest value per line changed in the workspace. Ships on its own. |
| 0.3 | **F-005-S1** delete the header identity | majelishub | 45 min | — | Impersonation with a guessable id. **Before** anyone fixes the audit-chain `500` it trips. |
| 0.4 | **F-008** admin boundary | manga | 90 min | — | Must exist before the first admin write, not after. |
| 0.5 | **F-002** tenant context | homeops | 3.5 h | 0.1 | Cross-household disclosure. Four routes. |
| 0.6 | **F-006** public projection | majelishub | 3 h | 0.3 | Public pages leak in dev and are blank in production. |
| 0.7 | **F-003** row-level security | homeops | 2.5 h | 0.5 | The stated primary boundary does not exist in any layer. |

**Wave 0 total: ~12 hours.** Four of the seven items are independent and can run as four parallel
streams (homeops / siomayops / majelishub / manga).

**Wave 0 exit criterion** — run `specs/SECURITY.md` §9. Every line must pass:

```bash
# 1. anonymous access refused everywhere, on a production build
# 2. no unauthenticated write returns 2xx
# 3. homeops: pg_class shows RLS on every household_id table
# 4. majelishub: SELECT with no scope returns zero rows
# 5. manga: /admin is not 200 for an anonymous caller
```

---

## Wave 1 — foundations the product needs

Prerequisites for a real user completing a core job. **Wave 0 for the same project must be closed.**

| # | Feature | Project | Est. | Depends on |
|---|---|---|---:|---|
| 1.0 | **F-007** test harness isolation + driver parity | majelishub | 3 h | — *(parallel with Wave 0)* |
| 1.1 | **F-019** integration harness that fails instead of skipping | homeops | 2 h | 0.1 |
| 1.2 | **F-016** restore CI gates; extend the claim checker | workspace | 3 h | — |
| 1.3 | **F-001-S2** real session provider | siomayops | 90 min | 0.2 |
| 1.4 | **F-012** registration capability confidentiality + first tests | majelishub | 4 h | 1.0, 0.3 |
| 1.5 | **F-011** homeops sign-in and session wiring | homeops | 3 h | 0.5, 1.1 |
| 1.6 | **F-009** idempotency required | siomayops | 1.5 h | 1.3 |
| 1.7 | **F-013** durable safety records | strangerlink | 3 h | — |
| 1.8 | **F-014** operator UI | parking | 6–10 h | — |
| 1.9 | **F-015** one test runner | manga | 1.5 h | 0.4 |
| 1.10 | **F-010** durable money state | siomayops | 8–12 h | 1.3, 1.6 |
| 1.11 | **F-020** documentation canonicalisation | workspace | 3 h | 1.2 |

**Wave 1 total: ~40 hours.**

Two high-value items deserve attention for their shape rather than their cost:

- **1.8 `F-014` (parking operator UI)** is the single feature that turns a working domain into a
  product. Everything hard is done and tested: pricing, reconciliation, retention, audit, durability.
  Only the surface is missing, and the eight existing screenshots already specify it.
- **1.10 `F-010` (siomayops durable state)** is the largest item in the plan and the one that changes
  siomayops from `DEMO_ONLY` to `MVP_USABLE`. It is large because it is honest: every repository call
  becomes a query.

---

## Wave 2 — core journeys complete

| # | Feature | Project | Note |
|---|---|---|---|
| 2.1 | Organization dashboard, rebuilt against a real session | majelishub | `majelishub-client.tsx` is deleted in 0.3; this replaces it properly, with tokens and honest states |
| 2.2 | Registration → code → check-in → attendance, end to end | majelishub | Needs 1.4; the route code exists and is untested |
| 2.3 | Volunteer device binding (`T-CHECKIN-016`) | majelishub | The `VOLUNTEER` role is correctly denied until this exists |
| 2.4 | Issues, maintenance, trash, resources, alerts write paths | homeops | Pages render; no write path is proven |
| 2.5 | Admin moderation surface | strangerlink | The authorization layer already exists; the UI does not |
| 2.6 | Real E2E journeys | siomayops, parking, manga | The three synthetic/false E2E files go first |
| 2.7 | **F-017** durable user/session/progress | manga | After 1.9 |
| 2.8 | Migrate the two unprotected majelishub tables to RLS | majelishub | `drizzle/0005`; the rule is already written in `drizzle/0001` |
| 2.9 | Pre-migration check: a duplicate registration must not disclose | majelishub | Precedent for 1.4 |

---

## Wave 3 — operational usability

Only after a real user completes the core job and data survives a restart.

| # | Item | Project |
|---|---|---|
| 3.1 | **F-018** design system, token migration, lint clean, contrast gate | homeops |
| 3.2 | Design tokens for the four public majelishub pages and the demo-free dashboard | majelishub |
| 3.3 | Observability: metrics, dashboards, SLOs, alert routing | all |
| 3.4 | Backup, restore rehearsal, retention jobs | siomayops, homeops, majelishub |
| 3.5 | Health, readiness, graceful shutdown | all |
| 3.6 | `siomayops`: `package-lock.json`, migration run on deploy, schema-version check | siomayops |
| 3.7 | `parking`: implement `VehicleWatchlistService`, or mark the policy not-in-force in `VEHICLE.md` | parking |
| 3.8 | Standardise task ids (`TASK-nnn` → `T-XXX-NNN`) or document the exclusion | parking, workspace |
| 3.9 | Design system and accessibility conformance pass | manga, strangerlink |

---

## Wave 4 — explicitly deferred

Listed so nobody re-adds them mid-plan. Each was considered and rejected in
`AUDIT_2026-09-28/FEATURE_GAPS.md` §"Feature inflation explicitly rejected".

Audio upload and media processing · transcription and human review · notification delivery · push and
email · leaderboards and any popularity or authority scoring · parking heatmaps and overstay alerting ·
manga search and recommendations · a live LLM provider for rsi · a QRIS adapter without merchant
credentials.

**Each becomes eligible only when its prerequisite journey works and is durable.** For example, audio
becomes eligible when UJ-MAJ-006 (check-in) completes with durable attendance — which is Wave 2.2.

---

## Suggested first week

| Day | Work | Agent |
|---|---|---|
| 1 | **F-004** (90 min) then **F-001-S1** (30 min) — both ship alone, both are green-CI-verified | homeops stream + siomayops stream |
| 1 | **F-005-S1** (45 min), then **F-008** (90 min) | majelishub stream + manga stream |
| 2 | **F-002** slices 1–2 | homeops |
| 2 | **F-007** (test-only; unblocks every later majelishub claim) | majelishub |
| 3 | **F-002** slices 3–4, then **F-003** | homeops |
| 3 | **F-006** | majelishub |
| 4 | **F-001-S2**, then **F-009** | siomayops |
| 4 | **F-016** | workspace |
| 5 | **F-019**, **F-011** | homeops |
| 5 | **F-012** | majelishub |
| 5 | **F-014** start (largest single value) | parking |
| 5 | **F-013**, **F-015** | strangerlink + manga |

By the end of week 1, Wave 0 is closed and every P0 in the workspace is fixed.
