# Yomi — Ownership and Conflict Resistance

**Status:** canonical. Which slice may touch which file, and what must not run
concurrently.

Purpose: let independent lanes work in parallel without three agents editing the
composition root, the schema, or `package.json` at the same time.

## The contended files

These are where parallel work collides. A slice touching one is **serial** with
every other slice touching it.

| Contended file | Touched by | Rule |
|---|---|---|
| `src/server/composition.ts` | F-001, F-002, F-006, F-013, F-016, F-017 | One slice at a time. F-001 owns it until F-001-S2 lands. |
| `src/server/db/client.ts` | F-001 | Serial. First. |
| `src/app/api/_runtime.ts` | F-001, F-002 | Serial, after F-001-S1. |
| `src/app/api/v1/_runtime.ts` | F-001, F-009 | Serial, after F-001-S1. |
| `src/server/db/queries/reader-state.ts` | F-006 | **Deleted** in F-006-S2. Touch nothing after. |
| `src/server/db/repositories/index.ts` | F-023, every new repository | F-023 owns the list; a new repository slice updates it in its own commit. |
| `src/shared/contracts/errors.ts` | F-011, F-016, F-017 | One slice at a time, and §6 updated in the same commit. |
| `API_CONTRACT.md` §6 | same as above | Same commit as the code. |
| `package.json` | F-003 (argon2), F-017 (image lib?) | F-003 is deferred. F-017 must not add a dependency without a research-registry row. |
| `src/middleware.ts` | F-005 only | Deferred. Nothing else touches it. |
| `src/features/*/…repository.ts` (port files) | F-008, F-010, F-013, F-016 | One port per slice. Adding a method to an existing port (F-008) is a breaking change for every implementor — do it alone. |
| `vitest.config.ts` | F-022, F-021 | F-022 first; F-021 adds the e2e exclusion awareness. |
| `.github/workflows/project-checks.yml` | F-021 | Alone. |
| Shared UI components, `src/app/_members/`, `src/app/_catalog/` | any page slice | One lane at a time. Do not create a second copy of the cover-URL rule — `one-rule-one-definition` applies; the third copy is recorded in the design handoff. |

## Per-slice ownership

| Slice | Primary files | Shared files | Migration | Parallel safe |
|---|---|---|---|---|
| F-022-S1 | `vitest.config.ts` | — | No | ✅ |
| F-023-S1 | `scripts/check-task-status.mjs`, `../scripts/check-claims.mjs`, `repositories/index.ts` | — | No | ❌ owns the inventory |
| F-020-S1 | `MVP_AUDIT/**` | — | No | ✅ |
| F-024-S1 | 5 reader/auth files (comments) | — | No | ✅ |
| F-001-S1 | `server/db/client.ts`, both `_runtime.ts`, `composition.ts` | composition root | No | ❌ **first, alone** |
| F-001-S2 | `server/auth/guard.ts`, `api/_runtime.ts` | composition root | No | ❌ after F-001-S1 |
| F-010-S1/S2 | `server/db/repositories/search.repository.ts` | `repositories/index.ts` | No | ✅ |
| F-011-S1 | `features/search/search.service.ts` | — | No | ✅ |
| F-011-S2 | `app/api/search/route.ts` | `errors.ts`, §6 | No | ⚠️ sole owner of those two |
| F-012-S1/S2 | `app/search/**` | app-lane schema module | No | ✅ |
| F-007-S1/S2 | `app/manga/[slug]/chapter/[chapter]/**` | — | No | ✅ |
| F-006-S1 | `app/api/chapters/[id]/progress/route.ts`, `reader-state.ts` | composition root | No | ❌ **P0, serial** |
| F-006-S2 | `reader-state.ts` (delete), `api/v1/chapters/[id]/pages` | composition root, `repositories/index.ts` | No | ❌ after F-006-S1 |
| F-008-S1 | `features/progress/reader-progress.repository.ts`, `progress.repository.ts`, `library.service.ts` | shared port — breaking | No | ❌ alone; after F-006-S1 |
| F-009-S1 | `api/v1/_runtime.ts`, `catalog.service.ts` | — | No | ⚠️ after F-001-S1 |
| F-016-S1/S2 | `features/admin/admin.service.ts`, `server/db/repositories/admin.repository.ts` | `composition.ts`, `errors.ts` | No | ⚠️ sole owner |
| F-017-S1 | `features/uploads/`, `server/storage/` | `composition.ts`, `package.json` | No | ⚠️ sole owner |
| F-013-S1/S2 | `features/settings/`, `api/preferences/` | `composition.ts` | No | ⚠️ sole owner |
| F-021-S1 | `.github/workflows/*`, `playwright.config.ts` | CI | No | ❌ alone |

✅ safe concurrently · ❌ serial, one lane · ⚠️ run alone but parallel to other lanes

## Rules

1. **Foundation before parallel feature work.** F-001 must land before any slice
   that touches `composition.ts` or a seam.
2. **A newly discovered problem gets a checklist ID.** It does not get fixed inside
   an unrelated slice. Add it to `CHECKLIST.md`, place it in
   [DEPENDENCY_GRAPH.md](DEPENDENCY_GRAPH.md), then fix it — in its own commit.
3. **One port per slice.** Adding a method to an existing port breaks every
   implementor of that port. Do it alone (F-008).
4. **A new code means its §6 row, in the same commit.** Not the next one.
5. **No new dependency without a research-registry row or an ADR note** in the same
   change (AGENTS.md §4.4). F-017 is the likely case: an image library.
6. **No route without its guard.** F-016/F-017 build service layers only. This is
   the one rule that exists to stop this plan from creating the P0 it is fixing.
7. **No migration in the active track.** Every active slice is migration-free by
   design. A slice proposing one is signalling a design change — raise it.

## Lane layout

Four lanes may run concurrently. Each lane is internally serial.

```
lane 1  runtime & correctness    F-001 → F-006 → F-008        owns: composition, seams, client, progress port
lane 2  search                   F-010 → F-011 → F-012        owns: search repo/service/route/page
lane 3  reader nav               F-007                        owns: app/manga/[slug]/chapter/[chapter]
lane 4  gate truth               F-022, F-023, F-020, F-024  owns: config, scripts, docs, comments
```

Later, once lane 1's foundation is stable:

```
lane 5  content services         F-016 → F-017 → F-013        owns: admin, uploads, settings
lane 6  assurance                F-021                        owns: CI
```

Lane 4 finishes first (four small slices, no product code) and must not be batched
with lane 1 — its whole point is that the gate is trustworthy before the next gate
number is believed.
