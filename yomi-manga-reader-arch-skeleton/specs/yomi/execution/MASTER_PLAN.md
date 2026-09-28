# Yomi — Master Execution Plan

**Status:** canonical. Every remaining unit of work, and why it is in this order.

**Status lives in [CHECKLIST.md](CHECKLIST.md), not here.** This file is the plan;
the checklist is the queue. Do not add a checkbox anywhere else.

Derived from [MVP.md](../MVP.md) and the findings in [ARCHITECTURE.md](../ARCHITECTURE.md),
[DATA_MODEL.md](../DATA_MODEL.md) and [SECURITY.md](../SECURITY.md). Authored against
HEAD `7af4e6a` after a full read of the codebase — not from `TASKS.md`, and not from
the 15 archived `MVP_AUDIT` documents, 7 of which claim search/auth/admin are complete
when they are not.

## Authority: auth is deferred

A standing decision from 2026-09-28: **defer all auth; focus on non-auth function.**

Consequence: `F-002` (session store), `F-003` (registration), `F-004` (sign-in UI),
`F-005` (route guard) and everything downstream of them are **deferred**, not
cancelled. They resume unchanged when auth work restarts.

Two consequences shape the whole plan:

**1. No admin or upload route may be exposed.** `F-005` is deferred, so nothing
checks that a caller is an admin. `F-016` and `F-017` therefore build **service and
repository layers only**. Their route and page halves are deferred. Shipping an
unguarded admin route to "finish" a feature would be a security regression introduced
by this plan ([SECURITY.md §3](../SECURITY.md)).

**2. Verification is not limited.** An earlier reading held that deferring auth meant
no session could be obtained, so member journeys could not be browser-verified. **That
was wrong.** The seed creates two real accounts with argon2 hashes and
`POST /api/auth/login` works; only *registration* is missing. So any change can be
verified end to end by signing in as a seeded account. The deferral limits shipped
scope, not verification.

## Scope decisions taken

| Decision | Rationale | Reversible |
|---|---|---|
| F-017 replaces the resumable multi-part `upload_job` pipeline with single-part ingest | An operator uploading a chapter needs a working retry, not resume. The CLI seed already covers bulk. | Yes — `upload_job` untouched |
| F-008 **implements** mark-unread | A manga reader needs it. Sticky-OR protects *progress*, not a reader's intent to re-read. Doing it properly via `unsetCompleted`, not by smuggling a flag through `saveProgress`. | n/a |
| F-018 (admin viewers) and F-019 (audit sink) are post-MVP | Useful after the catalogue is real, not before. F-019 moves to Wave 5 if audit is a hard compliance requirement. | Yes |
| `queries/reader-state.ts` is deleted, not patched | It is the source of both the completion-erasure defect and the architecture bypass. | n/a |
| Search is the flagship of the active track | It is the largest MVP gap with zero code, its DB indexes are already live, and it is anonymous — so it is the one major journey not blocked by the auth deferral. | n/a |

## Waves

### Wave 0 — Gate truth

Nothing else is trustworthy until the gate and the record stop lying.

| Slice | Work |
|---|---|
| F-022-S1 | Pin `NODE_ENV=test` in `vitest.config.ts`. Retire the phantom-failure class at its source. |
| F-023-S1 | Extend the checker to the 4 unimplemented services + `PasswordHasher` + `AuditSink`; give each of the 13 skipped suites a task ID or delete it. |
| F-020-S1 | Archive the 15 stale `MVP_AUDIT` files. |
| F-024-S1 | Traceability headers on the reader and auth routes. |

### Wave 1 — Runtime

| Slice | Work |
|---|---|
| F-001-S1 | One `getOrCreateDb` per process; both seams share it. |
| F-001-S2 | `getSessionUser` takes the shared handle — no pool per call. |

A single members' request currently opens up to **three** pools.

### Wave 2 — Search ★ flagship

| Slice | Work |
|---|---|
| F-010-S1 | `createSearchRepository`: 4 ranking bands, trigram contains, keyset cursor. |
| F-010-S2 | Creator/tag related band; CJK 1–2 char prefix-only path. |
| F-011-S1 | `createSearchService`: validation 1..120, cursor codec. |
| F-011-S2 | `GET /api/search` — anonymous allowed, `no-store`. |
| F-012-S1 | `/search`: results, states, pagination. |
| F-012-S2 | Deep-linkable query in the URL. |

### Wave 3 — Reader navigation

| Slice | Work |
|---|---|
| F-007-S1 | Surface the prev/next published neighbours `pageList` already returns. |
| F-007-S2 | `?page=N` deep link, clamped to `[1, pageCount]`. |

Reading is anonymous-capable, so this is shippable *and* browser-verifiable today.

### Wave 4 — Reader correctness

| Slice | Work |
|---|---|
| F-006-S1 | `POST /api/chapters/{id}/progress` → `ReaderProgressRepository.saveProgress`. |
| F-006-S2 | Delete `queries/reader-state.ts`; move `pageList` behind the `/api` seam. |
| F-008-S1 | `unsetCompleted` on port + repository: own transaction, own LWW guard. |
| F-009-S1 | `/api/v1/_runtime.ts` real resolver; prove `continueReading` populates. |

**This wave carries the P0.** The completion-erasure defect is the worst bug in the
product: it loses a reader's record silently.

### Wave 5 — Content services (layered only)

| Slice | Work |
|---|---|
| F-016-S1/S2 | `AdminService`: manga CRUD + publish; chapter CRUD + publish/reorder. **No routes.** |
| F-017-S1 | Single-part upload service. **No routes.** |
| F-013-S1/S2 | `reader_preference` port, repository, service, `GET`/`PUT /api/preferences`. Self-scoped route only; never admin-gated. |

### Wave 6 — Assurance

| Slice | Work |
|---|---|
| F-021-S1 | Add the 5 non-todo e2e specs to CI. |

## Deferred

`F-002` `F-003` `F-004` `F-005` `F-008-S2` `F-014` `F-015` `F-018` `F-019`, and every
route/page half of `F-006` `F-008` `F-013` `F-016` `F-017`.

When auth restarts, the order is: **F-001 → F-002 → F-003 → F-004 → F-005**, then
F-008-S2, F-014, F-015, then the route/page halves, then F-018/F-019.

## Execution order

`CHECKLIST.md` is the queue. Select the first unchecked slice whose dependencies are
satisfied. Commit per slice, named by slice ID. Do not bundle a newly discovered
problem into an unrelated slice — give it a checklist ID and place it by dependency.

## Definition of final MVP completion

Per [MVP.md](../MVP.md): all nineteen MVP journeys demonstrable in a browser by
someone who did not write the code, against a real database and real object storage;
zero unexplained test failures; zero silently skipped suites; one runtime
connection; one session authority; zero `NotYetBuilt` pages in the reader journey; no
write path bypassing the repository that owns the invariant; E2E running in CI.

**Target gate: 0 unexplained failures.**

While auth is deferred, "one session authority" and the guard cannot be claimed.
Everything else can.
