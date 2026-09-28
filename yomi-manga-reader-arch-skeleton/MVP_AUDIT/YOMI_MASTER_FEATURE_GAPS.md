# Yomi — Master Feature Gap Audit

**Date:** 2026-09-28 · **HEAD:** `7af4e6a` · **Baseline:** 605 tests, 605 pass, 0 fail

**Method:** read the current codebase. Not `TASKS.md`, not `README.md`, and not the
15 files in `MVP_AUDIT/` — 7 of which claim search, auth and admin are complete, and
none of which is true. Every "current state" below was verified against code, a test
run, or a database query. Where a document and the code disagreed, the code is
recorded and the document is named as wrong.

**This file is superseded by** [specs/yomi/execution/CHECKLIST.md](../specs/yomi/execution/CHECKLIST.md),
which is the operational source of status. It is kept as the *why* behind the plan.

## Feature state summary

| State | Features |
|---|---|
| **VERIFIED_WORKING** | `/discover`, `/manga/[slug]` metadata, `/media/[assetKey]`, `/library`, `/bookmarks`, `/history`, seed harness, login/logout API, boundary rules |
| **WORKING_WITH_GAPS** | reader page images, catalogue chapter list, session guard (works, bypasses its own port) |
| **PARTIAL** | chapter reader (reads; writes wrong, no chapter nav) |
| **BROKEN** | `queries/reader-state.ts` write path (erases `completed`) |
| **IMPLEMENTED_UNVERIFIED** | `mergeProgress` (complete, zero callers), `/api/v1` continue-reading logic (complete, unreachable) |
| **NOT_IMPLEMENTED** | search (3 layers), settings (orphaned table), registration, sign-in UI, route guard, 10 of 20 ports, all admin, all upload |
| **STALE_DOCUMENTATION** | 15 `MVP_AUDIT` files, 10 screenshot scripts, `docs/product/reader-behavior.md`, `manga/[slug]/page.tsx:41-44`, `settings/page.tsx` header |
| **OUT_OF_SCOPE** | resumable multi-part upload, admin viewers, audit sink, social, offline, recommendations |

## Gaps

| ID | User | Journey | Current state | Missing behaviour | Sev | Dependency | MVP? |
|---|---|---|---|---|---|---|---|
| **G-01** | reader | J-10 | **BROKEN** | Reading past the end of a completed chapter sets `completed = false`. `queries/reader-state.ts:248` plain-overwrites; the repository's sticky-OR at `progress.repository.ts:547` is bypassed. No error, no signal. | **P0** | F-006 | ✅ |
| **G-02** | reader | J-10 | **BROKEN** | `library_entry.last_read_at` is never written from the reader's save path, so the shelf's `last_read_desc` is NULL for anything read. | **P0** | F-006 | ✅ |
| **G-03** | reader | J-01 | **NOT_IMPLEMENTED** | No account can be created. `grep "insert(users)" src/` → 0 hits. No register route. `passwordHash` has no writer. Every member feature is complete and unreachable. | **P0** | F-002, F-003 | ✅ |
| **G-04** | any | J-19 | **BROKEN** | `middleware.ts:38` `matcher: ['/__t-auth-007-matcher-not-configured__']` — no page is route-protected. Today: page shell exposed (P2). **Becomes P0 the moment an admin route exists.** | **P0** | F-005 | ✅ |
| **G-05** | any | all | **BROKEN** | Up to **3** DB pools per members' request: two composition roots, plus `guard.ts` opening and closing one per call. | **P0** | F-001 | ✅ |
| **G-06** | reader | J-03 | **NOT_IMPLEMENTED** | **Search is the largest MVP gap with zero code.** Port exists, service throws, route throws, page is `NotYetBuilt`. Only the two GIN trigram indexes are live. | **P1** | none | ✅ |
| **G-07** | reader | J-07/J-08 | **NOT_IMPLEMENTED** | No chapter-to-chapter navigation and no `?page=N`. `pageList` already returns the neighbours (`chapters.repository.ts:31`); nothing surfaces them. The `/bookmarks` jump href builds `?page=N` and lands on page 1. | **P1** | none | ✅ |
| **G-08** | reader | J-09 | **IMPLEMENTED_UNVERIFIED** | `api/v1/_runtime.ts:33` `resolveCaller()` returns `null` forever, so `continueReading` never populates and "Continue Ch. 12 · p. 45" is dead code. The logic and the contract parse both exist. | **P1** | F-001 | ✅ |
| **G-09** | reader | J-11 | **NOT_IMPLEMENTED** | No mark-unread at any layer. `library.service.ts:189-200` `setReadStatus(false)` re-writes the current value (guaranteed no-op, SQ-LIB-7) **and has zero callers**. The port has no unset method. | **P1** | F-006, F-002 | ✅ |
| **G-10** | reader | J-15 | **NOT_IMPLEMENTED** | `reader_preference` exists (`schema.ts:539`, live in `0000`, typed at `shared/contracts/reader.ts:104`) with **no port, repository, service, route or reader**. The page header names `api/v1/preferences/route.ts`, which does not exist. | **P1** | F-002 | ✅ |
| **G-11** | operator | J-17/J-18 | **NOT_IMPLEMENTED** | 4 services + `PasswordHasher` + `AuditSink` have no implementation. All 7 admin pages are `NotYetBuilt`. All 4 upload routes throw. The only way to populate a catalogue is the CLI seed. | **P1** | F-005 for routes | ✅ (service layer) |
| **G-12** | reader | J-10 | **PARTIAL** | `mergeProgress` is fully implemented — three phases, own LWW rule, `{applied,dropped}` invariant — and has **zero callers**. An unwired capability, not a defect. | **P2** | F-002 | ➖ |
| **G-13** | any | J-19 | **PARTIAL** | `requireUser` throws a bare `Error`, not an `AppError`. `guard.ts:25` accepts an `x-session-token` header — a token in a place logs and proxies record. | **P2** | F-002 | ✅ |
| **G-14** | any | — | **STALE** | Three disagreeing session implementations: the port (throws, `T-AUTH-006`), `guard.ts` (real, bypasses the port), and the auth routes (bypass both, via `reader-state.ts`). | **P1** | F-002 | ✅ |
| **G-15** | any | — | **STALE** | 15 `MVP_AUDIT` markdown files, 7 falsely claiming search/auth/admin complete; they also cover unrelated projects (parking, chores). Plus 10 screenshot scripts. | **P2** | F-020 | ✅ |
| **G-16** | any | — | **STALE** | **13 test suites are skipped** — assertions that never run, invisible in the "605 pass" figure. | **P2** | F-023 | ✅ |
| **G-17** | any | — | **STALE** | `PLANNED_REPOSITORIES` covers repositories only, not the 4 services + `PasswordHasher` + `AuditSink`. The inventory understates what is missing. | **P2** | F-023 | ✅ |
| **G-18** | any | — | **STALE** | Stale comments assert false behaviour: `manga/[slug]/page.tsx:41-44` (claims `continueReading` is unparsed — it is parsed at `catalog-schema.ts:98`), `settings/page.tsx:9,18` (`autoNextChannel`), `docs/product/reader-behavior.md` (preferences described as live). | **P2** | F-024 | ✅ |
| **G-19** | any | — | **PARTIAL** | `chapter/[chapter]/page.tsx` and `reader-client.tsx` have **no header comment at all**; the reader's only task ID is `T-UPLOAD-004` at `:156`. AGENTS.md §4.2 traceability failure. | **P2** | F-024 | ✅ |
| **G-20** | any | — | **PARTIAL** | E2E never runs in CI. `vitest.config.ts` excludes `tests/e2e`; no Playwright job exists. 13 specs are `describe.todo`. | **P2** | F-021 | ✅ |
| **G-21** | any | — | **PARTIAL** | `vitest.config.ts` does not pin `NODE_ENV`. A shell with `NODE_ENV=production` produces **4 phantom media failures**, which were reported on 2026-09-28 as a production defect they are not. | **P3** | F-022 | ✅ |
| **G-22** | reader | J-06 | **WORKING_WITH_GAPS** | `api/v1/chapters/[id]/pages` and `api/chapters/[id]/progress` each build their own `Db` and call `reader-state.ts` directly — no composition root, no service, no ports. Its header calls itself a "Minimal wave2 implementation". | **P1** | F-006 | ✅ |
| **G-23** | reader | J-05 | **STALE** | The cover seed writes no cover art, so every discover card shows "NO COVER". Cosmetic, but visible. | **P3** | F-017 | ➖ |

## The four media tests — resolved, and it is not what it looked like

A previous entry in this audit reported **4 failing media tests** as a pre-existing
defect, reproducible on a clean worktree at `8ebc15f~1`. **That was wrong**, and the
error is worth recording because it nearly put a nonexistent remediation in the plan.

| | |
|---|---|
| **Expected behaviour** | `/media/{assetKey}` serves bytes for a published chapter's page; 404s a malformed or unknown key; never leaks vendor text; never materialises the object. |
| **Actual behaviour observed** | 500 on 4 tests. |
| **Responsible layer** | **G. test infrastructure** — my shell, not the product. |
| **Root cause** | I ran vitest with `NODE_ENV=production` and `http://` `APP_ORIGIN`/`S3_ENDPOINT`. `loadEnv()` **correctly** refuses that (NFR-SEC-009), and `media/[assetKey]/route.ts` turns the boot failure into a §6 500 **by design**. With `NODE_ENV=test`: **23 passed, 0 failed.** |
| **Why it reproduced at `8ebc15f~1`** | Because I reproduced my own bad harness, not the code. That "reproduction" was the tell, and I read it as confirmation. |
| **Was CI ever red?** | No. `.github/workflows/project-checks.yml:108` sets `NODE_ENV: test`. |
| **Is media delivery defective?** | **No.** 23/23 pass. It is the one lane with no open defect. |
| **Is there still a real defect?** | **Yes, P3:** `vitest.config.ts` does not pin `NODE_ENV`, so any developer in a production shell sees 4 phantom failures. → G-21 / F-022. |
| **Regression risk of "fixing" it** | **High, and the point.** Editing the route to return 200 without storage would have turned a loud, correct refusal into a quiet, wrong answer. The defect was in the measurement. |
| **Acceptance** | `NODE_ENV=production npx vitest run` → 605 pass / 0 fail. → F-022-S1 |

This is also the strongest argument for the standing rule in
[PRODUCT.md](../specs/yomi/PRODUCT.md): *refusal is honest.* The environment refused
to start; the route said so. That chain worked exactly as designed. The only broken
link was the person holding the shell.

## `setReadStatus(false)` — decided, not deferred

| | |
|---|---|
| **Current behaviour** | Reads `completed`, writes the same value back. Provably a no-op, self-documented (SQ-LIB-7), and has **zero callers**. |
| **Required behaviour** | A reader who finished a chapter can mark it unread to re-read it. A manga reader without this is a worse product. |
| **The tension** | `saveProgress` is sticky-OR **by design** — it stops a stale tab from clearing a flag. That is correct for *progress*. It is wrong for a reader's deliberate *intent to re-read*. These are different operations and the current code conflates them. |
| **Decision** | **Implement `unsetCompleted`** on the port and repository: its own transaction, its own LWW guard. Do **not** add a flag that `saveProgress` ignores — that would make `completed` mean two things depending on the caller. |
| **Rejected alternative** | Delete `setReadStatus`. Rejected: it would remove a needed capability rather than deliver it, and the honest gap is smaller than a deleted feature. |
| **Placement** | F-008-S1, after F-006-S1 — the repository F-006 routes through must be the one that gains the method. |
| **Verification** | Sticky-OR still holds for `saveProgress`; the two paths do not interfere; unsetting a non-existent row is a no-op; unsetting another reader's chapter changes nothing. |

## `_runtime.ts` second connection — decided

| | |
|---|---|
| **Why two connections exist** | Two transport seams (`/api/*` for members, `/api/v1/*` for the catalogue), each with its own composition root, each calling `createDb`. |
| **The third** | `server/auth/guard.ts:22` `getSessionUser` opens and closes **its own pool per call** — so one members' request can hold three. |
| **Lifecycle** | Per-call pools defeat connection pooling entirely; a page with three route calls opens three pools and tears them down three times. |
| **Transaction** | No cross-request transaction is possible or wanted. A request-local `Db` is the right *scope*; the pool should be process-wide. |
| **Test** | Suites that open their own throwaway databases are unaffected; a memoised process handle is what the app needs. |
| **Leak risk** | Low today, high under load. The real risk is exhaustion, not a true leak. |
| **Is T-AUTH-007 still applicable?** | **Yes, and it is broader than it reads.** Not "the guard is wrong" — *there is no single runtime owner at all.* |
| **Decision** | One `getOrCreateDb(env)` per process; the composition root builds it once; every repository and both seams receive it; `getSessionUser` takes the handle. → F-001-S1/S2. |

## P0 summary

| ID | Gap | Fix |
|---|---|---|
| G-01 | Reading erases completion | F-006-S1 |
| G-02 | `last_read_at` never maintained from the reader | F-006-S1 |
| G-03 | No account can ever be created | F-003 (deferred) |
| G-04 | No route protection; admin unguarded | F-005 (deferred) — and F-016/017 routes prohibited until it lands |
| G-05 | Up to 3 pools per request | F-001 |

Three of the five are in the active track and need no auth. **G-01 is the one that
matters most**: it is the only defect in this list that loses a reader's data without
telling anyone.
