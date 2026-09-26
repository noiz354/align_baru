# DECISIONS.md — Decision Log

> Chronological log of decisions that are *not* large enough for an ADR, but matter enough to record. Newest first.
> Format: date · decision · context · consequence · related task/ADR.

## Format & rules

- Log a decision when it (a) constrains future work, (b) resolves an ambiguity, or (c) documents a deliberate omission.
- Every entry states its **reversal cost** (cheap / moderate / expensive).
- ADR-level decisions are **not** duplicated here; cross-reference them instead.

---

### 2026-09-26 — Repository is a specification artifact, not a working app
**Context:** Architecture phase. **Decision:** ship docs + contracts + `throw new Error("Not implemented: <TASK>")` skeletons; install nothing; run no product logic. **Consequence:** the tree looks unusual (functions that cannot run) by design; auditing rule "no fake implementation" is enforced in `scripts/verify-docs.mjs`. **Reversal cost:** cheap (VS-0 begins implementation). **Related:** AGENTS.md §1, docs/architecture/FINAL-REVIEW.md.

### 2026-09-26 — Task ID prefixes use short module codes
**Context:** Early drafts used both `T-RES-014` (long form) and module directory `resources`. **Decision:** canonical prefixes are short codes — `T-HH`, `T-MEM`, `T-AUTH`, `T-ROOM`, `T-CHORE`, `T-TRASH`, `T-RES`, `T-SHOP`, `T-MNT`, `T-ISSUE`, `T-ALERT`, `T-NOTIF`, `T-DASH`, `T-ACT`, `T-SET`, `T-TIME`, `T-PLAT`, `T-OBS`, `T-SEC`, `T-PRIV`, `T-A11Y`, `T-PERF`, `T-PWA`, `T-QA`, `T-DOC`. Long-form aliases (`T-RESOURCE-*` → `T-RES-*`, `T-MAINTENANCE-*` → `T-MNT-*`) map 1:1. **Consequence:** stable, greppable IDs; TASKS.md documents the alias table. **Reversal cost:** expensive (IDs appear in comments, docs, tests). **Related:** TASKS.md#id-conventions.

### 2026-09-26 — Activity is a domain module, not a feature-only concern
**Context:** The reference tree listed no `domain/activity`. **Decision:** `src/domain/activity/` exists because retention, append-only-ness and household scoping are invariants with owners (NFR-PRIV-004, FR-ACT-005). **Consequence:** one extra domain module, justified in ARCHITECTURE.md §9. **Reversal cost:** moderate. **Related:** ARCHITECTURE.md §9, DOMAIN.md §4.12.

### 2026-09-26 — No `domain/notifications`
**Context:** Notification delivery could have been modelled as a domain module. **Decision:** delivery stays a feature + server concern; only `alerts` carries domain rules (FR-NOTIF-001). **Consequence:** policy logic lives in `features/notifications/policy.ts` and is pure/testable without being a domain aggregate. **Reversal cost:** moderate. **Related:** ADR-009.

### 2026-09-26 — Repository ports are mandatory even though the app is small
**Context:** A solo developer could query the database directly from features. **Decision:** all persistence flows through ports taking a `HouseholdContext` (ADR-003, ADR-005). **Consequence:** more files; tenancy is structural and testable; the query layer is replaceable. **Reversal cost:** expensive (touches every module). **Related:** ADR-003, ADR-005.

### 2026-09-26 — Postgres-only, no Redis, no broker in v1
**Context:** Queueing/caching temptations. **Decision:** Postgres serves data, locks and the outbox (ARCHITECTURE.md §3). **Consequence:** one stateful service to operate; pg-boss is the named upgrade path. **Reversal cost:** cheap to add later, expensive to justify adding early. **Related:** ADR-013.

### 2026-09-26 — Room status is derived, never scored
**Context:** "Cleanliness score" designs are easy and dishonest. **Decision:** five discrete states from a fixed rule set plus an expiring manual override (ADR-010). **Consequence:** some rooms are `UNKNOWN` — accepted as honesty. **Reversal cost:** moderate. **Related:** ADR-010, PRD FR-ROOM-002.

### 2026-09-26 — Resource inventory supports three quantity modes
**Context:** Uniform numeric inventory would be fake precision; uniform ordinal would be under-specified for countable goods. **Decision:** `EXACT` / `APPROXIMATE` / `AVAILABLE_UNAVAILABLE` with defaults (ADR-011). **Consequence:** three code paths in update/display logic. **Reversal cost:** moderate. **Related:** ADR-011.

### 2026-09-26 — No expiry-date tracking or consumption forecasting in v1
**Context:** Frequently requested in inventory apps. **Decision:** excluded; documented as a non-goal. **Consequence:** no prediction claims, minimal data entry. **Reversal cost:** moderate (would need a new ADR + data source). **Related:** ADR-011.

### 2026-09-26 — Maintenance is explicitly not a CMMS
**Context:** Pull toward work orders, approvals, cost rollups. **Decision:** assets + plans + records only; cost is a note; vendors are free text (ADR-012, PRD NG-6). **Consequence:** no vendor directory, no spend analytics. **Reversal cost:** moderate. **Related:** ADR-012.

### 2026-09-26 — Alerts never fan out to all members
**Context:** Broadcast is the default failure mode of reminder apps. **Decision:** recipient resolution order (assigned → role → owner fallback) with away-member skipping; caps and grouping at delivery (FR-NOTIF-010, FR-ALERT-013). **Consequence:** some members may not be told about things they do not own — intended. **Reversal cost:** cheap (policy is pure and centralised). **Related:** ADR-008, ADR-009.

### 2026-09-26 — Offline is read-only with explicit staleness
**Context:** Offline-first sync is a large commitment with correctness risk. **Decision:** shell caching + honest staleness banner; mutations require connectivity (ADR-014). **Consequence:** poor-connectivity actions fail visibly; users retry. **Reversal cost:** expensive (a sync engine is a project). **Related:** ADR-014, PRD NG-9.

### 2026-09-26 — Secrets, logs and metrics carry no household content
**Context:** Observability usually leaks PII. **Decision:** typed logger allow-list; metrics with no household/member labels; no client analytics (ADR-015, NFR-PRIV-003). **Consequence:** harder per-household debugging; acceptable. **Reversal cost:** moderate. **Related:** ADR-015, PRIVACY.md.

### 2026-09-26 — Language: English v1, strings centralised
**Context:** The initial household is in Indonesia (Asia/Jakarta) but the maintainer's documentation language is English. **Decision:** ship English copy with all user-visible strings in one module; Bahasa Indonesia is a translation task. **Consequence:** no i18n framework in v1. **Reversal cost:** cheap (module boundary exists from day one). **Related:** PRD §2, DESIGN T-7.

### 2026-09-26 — Docs gate script lives in the repo
**Context:** Traceability tables rot. **Decision:** `scripts/verify-docs.mjs` validates requirement/task/ADR references and the no-fake-implementation rule; CI runs it from VS-0. **Consequence:** one more script to maintain; documentation drift becomes a build failure. **Reversal cost:** cheap. **Related:** NFR-MAINT-003, ARCHITECTURE.md §9.

### 2026-09-26 — Version pinning deferred to VS-0
**Context:** Research found conflicting claims about current Drizzle and Better Auth version lines. **Decision:** do not guess; pin exact versions at VS-0 and record them here. **Consequence:** package.json ranges are indicative only. **Reversal cost:** cheap. **Related:** docs/research/STACK-2026.md#11, T-PLAT-001.
