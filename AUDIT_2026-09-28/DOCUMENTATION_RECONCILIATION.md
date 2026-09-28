# DOCUMENTATION RECONCILIATION

Rule applied: **contradictory status documentation is not preserved.** For each document:
`KEEP` (accurate), `UPDATE` (fix in place), `ARCHIVE` (superseded, keep for history, remove from the
reading path), `DELETE` (evidence for code that does not exist).

After this pass there must be exactly **one** canonical source for each of:

| Question | Canonical source |
|---|---|
| What is the product? | `specs/PRODUCT.md` |
| What is true today? | `AUDIT_2026-09-28/REAL_AUDIT_SUMMARY.md` + `projects/*/REALITY_AUDIT.md` |
| What is allowed / forbidden? | `specs/SECURITY.md` |
| What must be true to ship? | `specs/features/*/ACCEPTANCE.md` |
| What is being worked on, in what order? | `specs/execution/IMPLEMENTATION_ORDER.md` |
| What do the gates actually do? | `TEST_EXECUTION.md` (regenerated, never hand-edited) |

---

## 1. Root documents

| Document | Verdict | Action | Detail |
|---|---|---|---|
| `README.md` | **DELETE content** | Replace | It is one line: `# align_baru`. It is the front door of the repository and gives a reader nothing. Replace with a 20-line map: what these eight projects are, the four status words, and where the audit and specs live. |
| `AGENTS.md` §Projects table | **UPDATE** | Fix now | Status column says "Spec only, no implementation" for six projects. siomayops has 37 routes, strangerlink has a working product, majelishub has 6 migrations, homeops has 32 pages, manga has 13. The table is pre-wave-1. Add an `as of <commit>` line so it cannot silently rot again. |
| `AGENTS.md` rule 2 | **UPDATE** | Fix now | *"The six `*-spec` folders intentionally contain throwing stubs / `null` shells / todo tests."* No longer true for any of them. Also instructs agents not to implement stubs "unprompted" — which is how a partially-waved repository ended up with a 30-route product and a Phase-0 README. |
| `AGENTS.md` rule 3 | **UPDATE** | Fix | *"Working prototype: `rsi-agent-*` is runnable"* — siomayops also builds, lints, tests and runs. It is not a prototype; it is a product with a broken auth guard. |
| `COMPLETION_MATRIX.md` | **ARCHIVE** | Replace with a pointer | Its own header admits it *"has not completed the task-by-task mapping"* and concludes *"TOTAL VERIFIED DONE: unknown, not 715"*. A document that says "unknown" should not sit in the root as a matrix. Retain the one genuinely useful contribution — the note that test counts and `Not implemented` scans cannot imply completion — and move it into `HARNESS.md`. |
| `COMPLETION_MATRIX.md` "715 task IDs" | **DELETE** | — | Re-measured across the seven projects: **514** (majelishub 107, homeops 250, strangerlink 26, siomayops 72, manga 39, parking 20). |
| `COMPLETION_MATRIX.md` "755 tests" | **DELETE** | — | No run produces it. This audit executed **470**. The number is a sum of eight documents that disagree with each other (parking 64 vs 66, rsi 11 vs 141 vs 147). |
| `HARNESS.md` | **KEEP + EXTEND** | Add to | The best-written root document, and the only one that describes its own limits. Add the two rules this audit had to reconstruct by hand: (a) a status claim is a claim until a command settles it; (b) evidence must be reproducible from the commit. |
| `scripts/check-claims.mjs` | **KEEP + EXTEND** | Add to | It runs in CI and passes — while three of the four P0s sat in `main`. It only checks package presence and file landmarks. Extend it to check *status* claims and *test-count* claims: for any README asserting "N tests passing", run the project's test command and compare; for any doc asserting a migration count, count the files. |
| `.github/workflows/project-checks.yml` | **UPDATE** | Fix now | Three defects: (1) `lint` runs for `yomi` only, so five projects have no static gate; (2) no PostgreSQL job for majelishub or homeops, so their integration tiers skip and CI is green without proving persistence; (3) no `check-claims` for status. See `specs/execution/OWNERSHIP.md` for the per-project change. |

## 2. siomayops

| Document | Verdict | Action |
|---|---|---|
| `README.md:14-22` — "**no working product**… no payment integration, no database query, no authentication implementation, no loyalty maths, no settlement maths, no stock deduction, no dashboard implementation" | **UPDATE** — replace the whole block | Every clause is false. `grep -rn "Not implemented" src` → 0. Delete the PHASE 0 banner entirely; it is the single most misleading statement in the workspace. |
| `TASKS.md:3-4` — "**no task may be implemented yet**… the skeleton throws `Not implemented`" | **UPDATE** | Same. Add a status column, because the register currently cannot express progress. |
| `ROADMAP.md:3` — "Phase 0 (plan; **do not execute**)" | **UPDATE** | Wrong by 19 slices. |
| `SECURITY.md:4` — "no auth, no crypto, no hardening implemented"; `:49` "**no authentication code exists**" | **UPDATE** | `AuthPort`, `ROLE_PERMISSIONS` (8 roles), CSP/HSTS wiring and the payment webhook verifier all exist. More importantly, `SECURITY.md:4` currently reassures a reader that there is no auth — when in fact there is auth-shaped code that grants everything. |
| `IMPLEMENTATION_STATUS.md:38` — "VS-0..VS-18 **fully**" | **UPDATE** | Retract. The same file at line 13 retracts its own 68/70 claim and then asserts "fully" anyway. Replace with the measured table from this audit, including that state is in-memory and `withTransaction` is a no-op. |
| `IMPLEMENTATION_STATUS.md:16` — "auth port (fake guarded, **no production default**)" | **UPDATE — highest priority** | The code does the opposite. This sentence is why nobody looked. |
| `tests/e2e/*.spec.ts` | **DELETE or rewrite** | Three spec files that never navigate the app, in a directory named `e2e`, advertised by `npm run test:e2e`. |
| `tools/check-stubs.mjs`, `tools/census.mjs` | **UPDATE** | Both are the project's own gates and both exit 1. Either fix them to describe the current state or delete them; do not leave a red gate in a script list. |

**KEEP:** `PAYMENTS.md`, `OFFLINE.md`, `INVENTORY.md`, `MENU.md` — the domain documents are the
strongest product thinking in the repository and match the code.

## 3. homeops

| Document | Verdict | Action |
|---|---|---|
| `README.md:3` — "implementation has not started", "every page and component shell returns `null`", "every test is a declared todo", "175 files (128 src, 44 tests)", "252 tasks" | **UPDATE** — replace the status paragraph | 32 real pages, 0 shells, 8 test files with assertions, 330 files, 248 task ids. |
| `AGENTS.md:9` — "**No product feature is implemented**" | **UPDATE** | False. |
| `AGENTS.md:15,18` — "**Forbidden:** Real SQL queries", "**Forbidden:** Functional authentication" | **UPDATE** | Both forbidden things exist and are load-bearing. This instruction is actively harmful: it tells the next agent to remove working code. |
| `ROADMAP.md:3` — "**VS-1 NOT STARTED**" | **UPDATE** | VS-2…VS-11 exist. |
| `SECURITY.md:12` P-1 — "**No unscoped query helper exists**" | **UPDATE — highest priority** | False, and dangerous. A reader trusting it would not add RLS. |
| `SECURITY.md:12` P-2 — "Every operation checks the caller's membership + role server-side" | **UPDATE** | No route calls `authorize`. |
| `TASKS.md` | **UPDATE** | Zero status markers. Add a column; VS-0 is claimed implemented in `ROADMAP.md` and recorded nowhere in the register. |
| `migrations/meta/_journal.json` | **UPDATE** | Not prose, but the *cause*: `0001` is unregistered, so the deploy path is broken while every document reports success. |

**KEEP:** `DESIGN.md`, `ARCHITECTURE.md` §9, `TESTING.md` §1 (the "a test that passes with a stub of
the thing being tested is worse than no test" principle, which this project then violated).

## 4. majelishub

| Document | Verdict | Action |
|---|---|---|
| `README.md:41` — `npm run verify:vs0` | **UPDATE** | No such script. Either add it to `package.json` or stop documenting it. A documented gate that does not exist is worse than no gate. |
| `README.md:41` — `npm run lint` → exit 0 | **UPDATE** | Exit 1 with 8 errors, all from the project's own rule. |
| `README.md:27,55` — "49 page shells + 26 API route shells" | **UPDATE** | 44 shells + 5 real pages, 30 routes. |
| `README.md:29` — "four reviewed SQL migrations" | **UPDATE** | Six. `0004`/`0005` are undocumented. |
| `README.md:35` — "the lint rule checks all 53 [stub task ids]" | **KEEP** | Verified correct. 53 unique `T-XXX-NNN` ids appear in `Not implemented:` across `src/`, at 80 throw sites. 52 of the 53 are thrown; one is referenced only in a `TODO(...)` marker. This audit initially recorded this claim as false and was wrong. |
| `README.md:30` — "125 passing (10 integration suites on a real PostgreSQL 18)" | **UPDATE** | 67/58/281 on PGlite; 52 + 1 failure on real PG, run one suite at a time. |
| `README.md:12` — "exactly ten tasks are implemented" | **UPDATE** | Wave2/wave3 added five more without touching the register. |
| `README.md:12` — "Still prohibited everywhere: … production UI" | **UPDATE** | `majelishub-client.tsx` is a production UI. Either the rule or the file goes. |
| `TASKS.md` status column | **UPDATE** | `T-ORG-002`, `T-MOSQUE-001`, `T-EVENT-003`, `T-REG-001`, `T-CHECKIN-001` all have code and are all `Planned`. |
| `MVP_AUDIT/progress/…/AFTER.md` | **ARCHIVE** | The 13-step flow and all 7 "after" screenshots predate `5f52802`, which put a session gate on `GET /api/majelishub/organizations`. Verified `401` today. Add a header: *"Evidence as of 59f4dd4. Superseded by 5f52802 — the organization listing is now session-gated; see RUNTIME_PROOF.md."* |
| `MVP_AUDIT/wave3/…/RUNTIME_PROOF.md` | **KEEP** | *"This is not a logged-in route proof."* The most honest sentence in the project's audit trail. |
| `MVP_AUDIT/wave3/…/IMPLEMENTATION.md` "Seeded identities" | **UPDATE** | Contains a half-finished sentence with the author talking to themselves (*"…? Actually …"*) and two different UUIDs for two mosques. |
| `majelishub-client.tsx` "RLS proof" panel | **DELETE** | A green panel asserting a proof that the runtime does not produce. `withScopedTransaction` skips RLS under PGlite and `pglite-migrate.mjs` skips the policies. |

**KEEP:** `PRD.md`, `ARCHITECTURE.md`, `SECURITY.md`, `THREAT_MODEL.md`, `docs/security/AUTHZ-MATRIX.md`,
`docs/adr/*`, `ops/eslint/*`, `ops/verify-vs0.mjs`, `src/shared/contracts/scope.ts`. This is the
highest-quality specification in the workspace and the only project whose database boundary is real.

## 5. strangerlink

| Document | Verdict | Action |
|---|---|---|
| `README.md` (whole file) | **ARCHIVE, then DELETE** | *"ARCHITECTURE PHASE — NOT DEPLOYABLE. No random-chat feature is implemented."* is false in every verifiable respect: matchmaking, reports, the realtime server, the TURN credential service, and 85 passing tests all exist. Keeping a file called `README.md` that denies the product is the harm. Move it to `docs/archive/README-phase0.md` and let `README_IMPLEMENTATION.md` become `README.md`. |
| `README_IMPLEMENTATION.md` | **PROMOTE to `README.md`** | Accurate, with the right caveats ("native synthetic audio", "browser microphone/public TURN traversal … unverified"). |
| `README.md:26-27,39` forbidden table | covered by the archive above |
| `README.md:183` "every test file contains only describe.todo" | covered by the archive above |
| `src/**` `createNotImplementedX = createX` aliases (18) | **DELETE** | Names that say "not implemented" pointing at real code. Rename to the real thing; a future reader will otherwise avoid working code. |
| `package.json:15` `"lint": "eslint ."` | **UPDATE** | Add `eslint` to devDependencies. It is the reason six projects lost their lint gate. |
| `src/server/db/in-memory.ts` for safety records | **UPDATE** (comment) | Its comment is honest about ephemeral state and vague about safety state. Say plainly that bans and reports are lost on restart. |

## 6. manga

| Document | Verdict | Action |
|---|---|---|
| `ROADMAP.md:3` "**No slice is executed in this phase**" | **UPDATE** | VS-1 and VS-2 are running. |
| `README.md:6` "durable progress … unfinished" | **UPDATE** | Contradicts `MVP_MATRIX_WAVE3.md` and 8 screenshots. Choose one. Given `store.ts` is a `Map` over a JSON file, the README is closer to right — say *"single-machine durable, not cross-device"*. |
| `README.md:6` "authorization is not enforced on admin routes" | **KEEP** | True, accurate, and the reason it matters. This sentence is doing its job. |
| `src/server/db/store.ts:18-20` "**Enables durable progress**" | **UPDATE** | The comment overstates what a `Map` provides. |
| `package.json` two test runners | **UPDATE** | Consolidate; make `progress.test.ts` run. |
| `src/app/admin/**` (5 pages) | **UPDATE** (add a marker) | Until the boundary is built, add a file-level comment stating that these pages are intentionally unauthenticated and must not be linked from public navigation. |

## 7. parking

| Document | Verdict | Action |
|---|---|---|
| `MVP_AUDIT/progress/…/AFTER.md` | **ARCHIVE + mark NON_REPRODUCIBLE** | Claims `python3 server.py` and eight screenshots. `server.py` and `static/` are absent from every branch of every commit. Add a header: *"NON_REPRODUCIBLE_EVIDENCE: the operator UI described here (`server.py`, `static/index.html`) was never committed. The screenshots cannot be regenerated. See AUDIT_2026-09-28/projects/parking/REALITY_AUDIT.md §1."* |
| `MVP_AUDIT/projects/…/AUDIT.md` | **UPDATE** | Two verdicts in one file: `:3` `MVP_READY`, `:109` `MVP_PARTIAL` with "operator UI is not wired". Keep the `:109` text — it is correct. |
| `COMPLETION_MATRIX.md:14` `MVP_READY` | **UPDATE** | Overrules the project's own accurate self-assessment. The README says "report this as domain MVP partial"; the matrix says ready. |
| `README.md:36` "61 tests" / `:51` "64 unit tests" | **UPDATE** | Both wrong; 66. |
| `README.md` §"Completion boundary" | **KEEP — PROMOTE** | The best status-writing in the workspace. Use it as the template for `specs/PRODUCT.md` §Status. |
| `TASKS.md` id format `TASK-101` | **UPDATE** | Either standardise to `T-XXX-NNN` or state the exception; today it is silently excluded from every workspace-wide count and rule. |
| `VEHICLE.md §4` watchlist | **UPDATE** | States policy as if in force; `check_watchlist` returns `None` for everything. Mark it not-in-force. |

## 8. rsi

| Document | Verdict | Action |
|---|---|---|
| `README.md:48,229`, `AGENTS.md:60` "141 test" | **UPDATE** | 147. |
| `COMPLETION_MATRIX.md:14` "11 passed" | **UPDATE** | 147. |
| `DELIVERABLES.md` P-07 `IMPLEMENTED_BUT_UNVERIFIED` | **UPDATE** | `tests/test_artifacts.py` exists; the row is stale. Verify and close, or re-state. |
| `DELIVERABLES.md` preamble and caveats | **KEEP — PROMOTE** | The template. Its opening sentence — *"DONE refers to the simulation and its documented boundaries; it does not certify safe autonomous edits to arbitrary real repositories"* — is precisely the discipline the other seven lack. |
| `README.md` "141 test, semuanya offline" | **KEEP after correction** | The scope claim is correct. |

## 9. Evidence directories

| Path | Verdict | Action |
|---|---|---|
| `MVP_AUDIT/screenshots/` (8 projects) | **ARCHIVE with provenance** | Keep as history, but every file needs a sibling `.md` naming the commit, the command, and whether it is reproducible. Today none has one. |
| `MVP_AUDIT/progress/*/screenshots/**` | mixed | Same rule. The parking set is `NON_REPRODUCIBLE_EVIDENCE` and must say so. |
| `MVP_AUDIT/wave3/majelishub/…/RUNTIME_PROOF.md` "no actual browser screenshots were captured" vs the presence of `MVP_AUDIT/screenshots/` | **RESOLVE** | One of the two is wrong. Determine which, then correct the other. |
| `scripts/screenshot*.mjs` | **UPDATE** | They are the provenance record for the screenshots above and are not referenced from any evidence file. |

## 10. What is not being deleted

For the record, because "delete contradictory documentation" is a blunt instrument and these are the
assets that make the repository worth having:

- **102 markdown files in majelishub.** The PRD, the threat model, the authorization matrix, 27 ADRs and
  the traceability map are the highest-quality work in this workspace, and GAP-P0-MAJ-01 exists
  *despite* them, not because of anything missing from them. The problem is that the code stopped
  consulting them.
- **`DELIVERABLES.md` in rsi.**
- **The `homeops/boundaries`, `majelishub/module-boundaries`, `majelishub/no-fake-implementation` and
  `majelishub/no-token-logging` lint rules.** All four currently fail on their own project's code and
  none runs in CI. They are the right rules, unexecuted. Fixing the violations and re-enabling the
  gates is worth more than writing any new documentation.
- **`ops/verify-vs0.mjs` and `scripts/check-claims.mjs`.** Both need to be wired and extended, not
  retired.
