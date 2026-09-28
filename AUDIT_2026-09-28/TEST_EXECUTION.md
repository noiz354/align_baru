# TEST EXECUTION

Every row is a command actually run in this session against commit `8ebc15f`, with the exit code the
runner returned. **No number here is copied from documentation.** Documentation claims are quoted only
in the "documentation says" column, for comparison.

**Environment**

| | |
|---|---|
| OS | Linux 5.x, x86_64, 4 vCPU, 15 GB RAM |
| Node | v24.21.0 (installed via `fnm`; the workspace `engines` for homeops/majelishub/yomi require `>=24`) |
| npm | 11.19.0 |
| Python | 3.12.3 |
| PostgreSQL | **18.4**, real server from `embedded-postgres` on `127.0.0.1:55440` — not PGlite, not a mock |
| Chrome | available but not used (no e2e executed; see §6) |

Raw runner logs: [`evidence/`](evidence/).

---

## 1. Install

| Project | Command | Exit | Note |
|---|---|---:|---|
| majelishub | `npm ci` | 0 | |
| homeops | `npm ci` | 0 | |
| manga | `npm ci` | 0 | |
| strangerlink | `npm ci` | 0 | |
| siomayops | `npm install --legacy-peer-deps` | 0 | `git ls-files package-lock.json` → empty. **No lockfile is committed**, so the install is not reproducible. A bare `npm install` (no flag) fails `ERESOLVE` on a peer conflict. The file this install generated was deleted afterwards so the tree stays unmodified. |
| parking | — | n/a | stdlib only |
| rsi | — | n/a | stdlib only |

## 2. Typecheck

| Project | Command | Exit |
|---|---|---:|
| majelishub | `npm run typecheck` | 0 |
| homeops | `npm run typecheck` | 0 |
| manga | `npm run typecheck` | 0 |
| strangerlink | `npm run typecheck` | 0 |
| siomayops | `npm run typecheck` | 0 |
| parking / rsi | — | n/a |

## 3. Lint

| Project | Command | Exit | Result |
|---|---|---:|---|
| majelishub | `npm run lint` | **1** | **8 errors**, all `majelishub/module-boundaries`: *"`app/**` may not import `@/server/db/schema`"* — `kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]`, `masjid/[slug]`, `checkin/validate`, `checkin/summary`, `registrations` |
| homeops | `npm run lint` | **1** | **30 errors**, incl. `homeops/boundaries`: *"`app/**` must never import `server`"* ×4, plus 26 `no-explicit-any` violations from the same wave |
| strangerlink | `npm run lint` | **127** | `sh: 1: eslint: not found` — the script exists, the binary does not |
| manga | — | n/a | **no `lint` script in `package.json`** |
| siomayops | `npm run lint` | 0 | the only green lint in the workspace |

## 4. Build

| Project | Command | Exit |
|---|---|---:|
| majelishub | `npm run build` | 0 |
| homeops | `npm run build` | 0 |
| manga | `npm run build` | 0 |
| strangerlink | `npm run build` | 0 |
| siomayops | `npm run build` | 0 |

## 5. Tests

| Project | Command | Exit | Files | Passed | Failed | Skipped | Todo | Duration |
|---|---|---:|---:|---:|---:|---:|---:|---|
| siomayops | `npm test` | 0 | 20 | **108** | 0 | 0 | 0 | 6.24 s |
| strangerlink | `npm test` | 0 | 10 | **85** | 0 | 0 | 0 | 9.02 s |
| homeops | `npm test` (unit) | 0 | 6 pass / 11 skip | **49** | 0 | 0 | 0 | 8.94 s |
| homeops | `npm run test:integration` | 0 | 13 | **0** | 0 | **15** | 0 | 9.41 s |
| manga | `npm test` | 0 | 2 | **15** | 0 | 0 | 0 | 1.44 s |
| parking | `python3 -m unittest discover -s tests -v` | 0 | — | **66** | 0 | 0 | 0 | 0.62 s |
| rsi | `python3 -m unittest discover -s tests -v` | 0 | — | **147** | 0 | 0 | 0 | 6.36 s |
| majelishub | `npm test` (PGlite default) | **1** | 9 fail / 11 pass / 77 skip | **67** | 0 | **58** | **281** | 72.23 s |

**Workspace totals actually executed: 470 passing, 1 test-file batch failure, 73 skipped, 281 todo.**
No single run produces 755; the `COMPLETION_MATRIX.md` figure is a sum of eight mutually inconsistent
documents.

### 5a. majelishub against real PostgreSQL 18.4

The default `npm test` uses PGlite. Run against the real server:

| Invocation | Exit | Result |
|---|---:|---|
| `INTEGRATION_DATABASE_URL=… npx vitest run --project integration` (as a batch) | **1** | 6 files fail: `relation "users" already exists`. The harness applies every migration per suite and there is no schema-per-suite isolation. **The "10 integration suites on a real PostgreSQL 18" claim cannot be reproduced.** |
| same, **one suite at a time with `DROP SCHEMA public CASCADE` between suites** | 0 / 1 | 8 suites pass (**52 tests**): `audit/chain` 6, `auth/rate-limit-durable` 10, `auth/session-repository` 8, `security/isolation` 5, `security/permissions` 6, `security/rate-limits` 4, `security/session-revocation` 4, `security/session-scope` 9. **`audit/coverage` 1 failed / 3 passed.** 46 suites are pure `todo`. |

The one real failure, which PGlite hides:

```
× writes an entry for every reason-required permission
AssertionError: expected [ '1', '2', '3', '4', '5', '6', …(4) ] to deeply equal [ 1, 2, …, 10 ]
```

`chain_position` comes back as a string from `node-postgres` and as a number from PGlite. A real
driver divergence in the audit chain.

### 5b. Project-internal gates

| Project | Command | Exit | Result |
|---|---|---:|---|
| siomayops | `npm run check:docs` | 0 | OK — 105 markdown files, 38 ADRs |
| siomayops | `npm run check:stubs` | **1** | red: it requires `NotImplemented` stubs and PHASE 0 markers that wave-2 deleted |
| siomayops | `npm run census` | **1** | red: `IMPLEMENTATION_STATUS.md -> NFR-SEC-021` is not in `PRD.md` |
| workspace | `node scripts/check-claims.mjs` | 0 | OK — but it only checks package presence and file landmarks |

## 6. Runtime verification (production builds, real PostgreSQL 18.4)

| # | Project | Probe | Result |
|---|---|---|---|
| R1 | siomayops | `GET /api/v1/sales` , no cookie | **200** |
| R2 | siomayops | `GET /api/v1/audit` , no cookie | **200**, returns audit rows |
| R3 | siomayops | `POST /api/v1/incidents` , no cookie, no `Idempotency-Key` | **201** `{"incidentId":"c92872d7-…"}` |
| R4 | homeops | `GET /api/homeops/rooms?householdId=<B>` , no cookie | **200**, household B's room returned |
| R5 | homeops | after `npm run db:migrate` on a fresh DB, `GET /api/homeops/today` | **500** `relation "chore_occurrence" does not exist` |
| R6 | homeops | `select relname from pg_class where relkind='r' and relrowsecurity` | **`[]`** — 0 of 17 tables |
| R7 | majelishub | `POST …/events` with no header | 404 (correct) |
| R8 | majelishub | `POST …/events` with `x-majelishub-user: organizer-1` | **passes authn and the `event.write` authz check**, reaches the audit write |
| R9 | majelishub | `GET /kajian` with 2 seeded organizations | renders **both** orgs' events |
| R10 | majelishub | `SELECT … FROM kajian_events` as `majelishub_app`, no scope | **`[]`** (fail closed) |
| R11 | majelishub | same, `app.organization_id` = Org A | Org A's row only — RLS layer 3 works |
| R12 | manga | `GET /admin`, no cookie | **200**, "Admin Portal" |
| R13 | manga | `GET /admin/manga`, no cookie | **200** |
| R14 | strangerlink | `/`, `/start`, `/queue`, `/chat/x`, `/safety` | 200 (requires `npm run realtime` for the socket) |
| R15 | parking | `python3 demo.py` | exit 0 — 10 steps, 11 audited actions, `purge 1 mask 5` |

Raw captures: [`evidence/siomayops-unauth.txt`](evidence/siomayops-unauth.txt),
[`evidence/homeops-crosshouse.txt`](evidence/homeops-crosshouse.txt),
[`evidence/majelishub-spoof.txt`](evidence/majelishub-spoof.txt).

## 7. Not executed, and why

| What | Why |
|---|---|
| Browser / e2e journeys (all projects) | No Playwright browser was installed in this environment; not attempted. Consequently **no** UI claim in this audit is browser-verified — every UI statement comes from source plus an HTTP status code. |
| `npm run test:e2e` (siomayops) | Its 3 spec files never navigate the app; they assert locally-declared constants. Running them would produce a green result with no information. |
| `tests/e2e/reader.spec.ts` (manga) | Same environment limitation. |
| siomayops against a real PostgreSQL | `drizzle-orm` and `pg` are declared but no database code path exists (§ PERSISTENCE_REALITY). |
| homeops integration on a real server | The harness locates no server and **skips**; supplying `INTEGRATION_DATABASE_URL` did not make it run. Needs investigation as part of GAP-P1-HOM-07. |
| majelishub `verify:vs0` | The script is not in `package.json`; it was invoked directly instead. |
| strangerlink `lint` | `eslint` is not installed (exit 127). |

## 8. Documentation vs. measurement

| Documented claim | Source | Measured |
|---|---|---|
| siomayops 108 passed | `COMPLETION_MATRIX.md` | **correct** (108) |
| strangerlink 85 passed | `COMPLETION_MATRIX.md` | **correct** (85) |
| parking 64 / 66 | `README.md:51` / `MVP_MATRIX_WAVE3.md` | **66** |
| rsi 11 / 141 / 147 | `COMPLETION_MATRIX.md` / `README.md` / `MVP_MATRIX_WAVE3.md` | **147** |
| manga 15 passed | `README.md:6` | 15 — but one test file is excluded from the run |
| homeops 49 unit + 15 integration | `COMPLETION_MATRIX.md` | 49 unit, **15 integration all skipped** |
| majelishub 125 passed, 10 integration suites on real PostgreSQL 18 | `README.md:30` | 67 pass / 58 skip / 281 todo on PGlite; 52 pass + 1 failure on real PG, and the suite cannot run as a batch at all |
| workspace total 755 | `COMPLETION_MATRIX.md` | 470 executed in this audit |

## 9. The one test that would have caught most of this

No project in the workspace contains a test that asserts an **unauthenticated request is refused**.
That single missing assertion class explains GAP-P0-SIO-01, GAP-P0-HOM-01 and GAP-P0-MAJ-01 surviving
to `main`, and it is the first thing `F-001`/`F-002`/`F-005` add.
