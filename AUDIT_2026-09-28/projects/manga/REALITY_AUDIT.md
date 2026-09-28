# REALITY AUDIT — manga-reader-spec-skeleton-minimal

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `MVP_BLOCKED`**

## 1. Documentation vs. reality

| Claim | Source | Reality |
|---|---|---|
| "**No slice is executed in this phase**" | `ROADMAP.md:3` | VS-1 (catalog) and VS-2 (reader) run; VS-5 (auth + progress) partially |
| "durable progress … remain unfinished" | `README.md:6` | `MVP_MATRIX_WAVE3.md` claims *"Authenticated per-user reading progress … logout/login and restart restore"* with 8 screenshots |
| "authorization is not enforced on admin routes" | `README.md:6` | **true and unfixed** — see §3 |
| "Do not mistake a passing **15-test** subset" | `README.md:6` | 15 is correct for what `npm test` runs, but misleading: `tests/integration/progress.test.ts` (2 × `describe.todo`) is **never executed** |
| "The task register has not yet been reconciled" | `README.md:6` | correct and the most useful sentence in the file |

`README.md` §"Phase boundary and current gaps" is the most honest README in the workspace. The
contradiction is not in its tone — it is that wave-3 evidence was layered on top of it without
correcting it, so the authoritative-sounding document and the evidence directory disagree.

## 2. Gate status (measured)

| Gate | Command | Exit | Note |
|---|---|---:|---|
| install | `npm ci` | 0 | |
| typecheck | `npm run typecheck` | 0 | |
| lint | — | n/a | **no `lint` script in `package.json`** — the project has no static gate |
| build | `npm run build` | 0 | |
| test | `npm test` | 0 | **15 passed**, 0 failed, 1.44 s — runs only `tests/unit/reader.test.ts` + `tests/integration/api.test.ts` |
| e2e | `npm run test:e2e` | not run | `tests/e2e/reader.spec.ts`; no browser in this environment |
| progress tests | — | **never run** | `tests/integration/progress.test.ts` imports `{ describe } from "vitest"` while `npm test` uses `node --experimental-strip-types --test`; `vitest ^3.1.1` is declared but unused by any executed script |

Two test runners are declared, one file targets the runner that never executes. That is the whole
`durable progress` evidence gap in one sentence.

## 3. Security reality

### GAP-P0-MAN-01 — the entire admin surface is unauthenticated

Five pages under `src/app/admin/**`: `page.tsx` (dashboard), `manga/page.tsx`, `manga/[id]/page.tsx`,
`manga/[id]/chapters/page.tsx`, `uploads/page.tsx`. `grep -rln "auth\|session\|role" src/app/admin/`
matches exactly one file, and only for the word "role" in unrelated copy.

**Verified** on a production build:

```
GET /admin          (no cookie)  → 200, body contains "Admin Portal" / "Catalog Management"
GET /admin/manga    (no cookie)  → 200
```

Severity is currently **P1, not P0**, for one reason worth stating precisely: there is no admin
*mutation* endpoint yet. `find src/app -path '*admin*' -name 'route.ts'` returns nothing. The exposure
is an unauthenticated view of editorial structure. The moment `T-ADMIN-*` lands a write route without
an auth check, this becomes a P0 content-integrity incident. It is listed as P0 in
[../SECURITY_GAPS.md](../../SECURITY_GAPS.md) §8 with that scope note, because the correct engineering
response is to fix the boundary *before* the feature that depends on it, not after.

### Correct

- `src/app/api/v1/progress/route.ts` — real session resolution via `getSessionUser`, correct 401, and
  explicit *"tenant isolation: ignore any userId param"* in both GET and PUT. This is the right shape
  and should be the reference for the rest of the project.
- `/api/v1/catalog` filters to `PUBLISHED` only (asserted in `tests/integration/api.test.ts`).
- Session tokens are `httpOnly` + `sameSite=lax`.

## 4. Persistence reality

`LOCAL_FILE` + `IN_MEMORY`. `src/server/db/store.ts` is a class holding `Map`s, hydrated at boot from
a JSON file:

```ts
progress: Map<string, ProgressRecord> = new Map();
…
this.progress = new Map(data.progress || []);
```

`src/server/db/store.ts:18-20` describes this as *"Enables durable progress"*. "Durable" here means
*survives a process restart on one machine*. `ARCHITECTURE.md` specifies PostgreSQL; `stack direction`
in `README.md` names PostgreSQL + Drizzle + S3. None is present. A user who reads on a phone and
resumes on a laptop loses their position, and the product has no multi-device story at all.

Loss classes:

| State | Class | Lost on restart? |
|---|---|---|
| catalog / chapters / pages | `LOCAL_FILE` | no |
| reading progress | `LOCAL_FILE` | no (single machine only) |
| users, sessions | `IN_MEMORY` | **yes** — everyone is logged out on deploy |
| page image files | `LOCAL_FILE` | no |
| moderation / admin state | none | n/a |

## 5. Runtime

Production build on `:3110`. `/admin` and `/admin/manga` return `200` unauthenticated (see §3).
Reader, catalog and progress routes serve real data from the JSON store.

## 6. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-MAN-001…004.

| Journey | Reality |
|---|---|
| UJ-MAN-001 discover and open a published chapter | works |
| UJ-MAN-002 read with page modes and RTL/LTR | works, unit-tested (the only genuinely tested part) |
| UJ-MAN-003 sign in and resume where you left off | works on one machine; `progress.test.ts` never runs |
| UJ-MAN-004 admin curates the catalog | **blocked** — surface exists, no auth, no write API |

## 7. What is needed for real users

1. Close the `/admin/**` boundary before any admin write lands.
2. Consolidate the test runner: one command, one runner, and make `progress.test.ts` execute.
3. Move users, sessions and progress to the declared PostgreSQL so resume works across devices.
4. Then the reader is genuinely usable and the project's own `README.md` gap list can shrink honestly.
