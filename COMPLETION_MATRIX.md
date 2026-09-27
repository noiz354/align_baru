# WORKSPACE COMPLETION MATRIX — audit in progress

**Measured:** 2026-09-27 (Asia/Jakarta) · base `42c4621` · branch `arena/01a0e0ef-align-baru` · Node 22.22.3 / Python 3.11.2. This file describes the **working tree of this audit**; see `git log -1` for its final committed SHA. No project is currently certified **VERIFIED 100%** across all requested gates.

The prior matrix treated executable-test pass rate and absence of `Not implemented` strings as completion. That is insufficient: several E2E specs are TODO or assert only constants; some source files render hardcoded data; "100%" against a narrower task register is not 100% against a broader PRD. Retain the combined-estimate formula (0.70 task + 0.15 test + 0.15 code) only as a *historical heuristic*, never as an authoritative completion status.

| Project | Declared scope | Task baseline (not verified DONE) | Tests rerun this audit | Source marker scan (non-shell/files) | Typecheck | Build | E2E | Gate status |
|---|---|---:|---|---:|---|---|---|---|
| StrangerLink | Full spec | 33/33 **claimed** | 85 passed | 52/52 | PASS | PASS (fixed invalid page export) | 20 `test.todo`; not executable as coverage | **UNVERIFIED**: E2E absent; TURN production secret missing |
| Parking | PRD §4.A MVP; §4.B later | 20/20 **register claimed**, not full PRD | **64 passed** (61 old + 3 QRIS/waiver regressions); demo passed | 31/32 (abstract OCR port) | n/a (Python) | n/a (Python) | CLI demo only, no UI | **PARTIAL**: PRD MVP UI and verified QRIS missing; watchlist stub |
| RSI agent | Explicit offline prototype | 7-item deliverable audit: 5 VERIFIED_DONE, 2 IMPLEMENTED_BUT_UNVERIFIED | **11 passed** (10 old + step-budget regression); demo ran | 12/12 | n/a (Python) | n/a (Python) | offline demo | **UNVERIFIED**: artifact schema and real-provider paths not fully checked; see `DELIVERABLES.md` |
| SiomayOps | Full spec | 68/70 **claimed**, not independently verified | **108 passed** (101 old + 7 HMAC/security cases) | 140/140 | PASS | PASS | 7 synthetic assertions across 3 Playwright specs; **not real E2E** | **PARTIAL**: QRIS adapter, real E2E, production configuration |
| Minimal manga | Full `TASKS.md` register (scope not yet reconciled) | historical ~7/26; **not VERIFIED_DONE** | 15 passed; 2 Playwright browser tests authored, not run; 2 progress `describe.todo` | 30/30 by string scan, but in-memory/fake data | PASS (`npx tsc --noEmit`) | PASS | browser download failed | **PARTIAL**: authorization, durable progress, upload and most register tasks |
| HomeOps | Full spec | historical 32/252 implemented, not all DoD-verified | 49 unit **passed**; 15 integration **passed on real PG18**; 11 product integration files are skeletons | 111/159 | PASS | PASS | skeleton specs | **PARTIAL**: VS-1…16 pending |
| Yomi | Full spec | 12/145 foundation, not all DoD-verified | **283 passed** on PG18 (previously 251 pass/32 skip); 14 product test files still empty | 45/104 | PASS | PASS | not run | **PARTIAL**: VS-1…11 pending |
| MajelisHub | Full spec | 10/169 delivered | 125 passed / **281 todo** (PGlite in-process integration included) | 51/185 | PASS | PASS | not run | **PARTIAL**: VS-1 onward pending |

**Task counts are historical estimates**, not verified-DONE totals. A sum of "done" would be misleading; 715 registered task IDs excluding RSI remain the historical denominator, and 182/715 was only a previous implementation *claim*. This audit has not completed the task-by-task requirement → code → test → integration → E2E → traceability mapping, so **TOTAL VERIFIED DONE: unknown, not 715**. The listed executable test passes total **755** (=85+64+11+108+15+64+283+125), with **281 known Vitest todos** in MajelisHub, plus TODO suites and unrun browser tests elsewhere. This is not a claim of 755 fully qualifying acceptance tests.

## Actual changes and reproducible evidence

- Parking: `python3 -m unittest discover -s tests` (64 pass); `python3 demo.py` (success). Unknown payment methods and QRIS cannot close a session as PAID without a verified provider callback. `IOcrEngine` is an abstract port, not a production OCR engine. Full PRD §4.A is not complete; see project README.
- SiomayOps: `npm run typecheck && npm test && npm run lint && npm run build` (pass; 108 Vitest). Removed a public fake-signature payment action and fail-closed on missing/invalid HMAC, currency, state or amount. **This does not implement a production provider**: provider-specific signature/merchant contract and credentials are outstanding. The present Playwright files assert made-up JS objects rather than operating the app; they do not count as E2E.
- StrangerLink: `npm run typecheck && npm test && npm run build` (pass; 85 Vitest). Next page's invalid `SAFETY_LIMITATIONS` export removed. `npm run lint` is **not runnable** because `eslint` is not in its manifest. 20 browser TODO calls remain, so the old 100% claim is withdrawn.
- RSI: `python3 -m unittest discover -s tests` (11 pass); `python3 demo.py --waves 1 --drs-rounds 1 --holdout 4` (ran, outputs under ignored `runs/`). Exhaustion of the step budget now fails checks closed rather than inheriting a planner's cached success. See `DELIVERABLES.md` for declared offline-prototype scope vs non-goals.
- Minimal manga: `npm ci --legacy-peer-deps && npm test && npm run typecheck && npm run build` (15 pass, type/build pass). Browser smoke specs now navigate to real routes; **not executed**. Two integration TODO suites remain. The in-memory database/sample manifest do not prove auth or production persistence.
- HomeOps: scratch **PostgreSQL 18.4** from the `embedded-postgres` npm package (under `/tmp`, never in git), isolated `homeops_test` with worker-specific DBs. `DATABASE_URL=postgres://test:test@127.0.0.1:55432/homeops_test npm run test:integration` → **15 pass, 0 failed** after repairing the `ANY` SQL bug and stale fixture assertions (FK order, session `token` column, JS date binding and tenancy-expiry count). `npm run typecheck`, `npm run lint`, `npm run verify:docs`, `npm run build` pass. Product suite skeletons remain.
- Yomi: separate `yomi_test` on the scratch PG18; `DATABASE_URL=postgres://test:test@127.0.0.1:55432/yomi_test npm test` → **283 pass**, 14 product feature test files without runnable tests. `npm run typecheck` and `npm run build` pass. README and task header corrected; product still pending.
- MajelisHub: `npm test` → **125 pass, 281 todo**; `npm run typecheck`, `npm run docs:lint`, `npm run build` pass. Integration harness defaults to PGlite PostgreSQL; external-Postgres path has not been rerun here.

## Environment and CI status

- `npx playwright install chromium` was attempted for SiomayOps and minimal manga, **failed ECONNRESET** to Playwright CDN. `sudo apt-get update && sudo apt-get install postgresql chromium` was also attempted; Debian mirrors were unreachable, and the packages had no local index. Browser execution therefore remains **not verified**. Browser binaries are not an external *product* blocker; implement real E2E and rerun on a host with browser access.
- Provisioned real PG18.4 from npm without Docker/apt. Separate scratch databases ran HomeOps and Yomi; no production database was touched. This removed the former blanket "Postgres absent" excuse. HomeOps now has 15 foundation integration passes; Yomi's 32 formerly skipped assertions now pass.
- Added root `.github/workflows/project-checks.yml` for install/typecheck/test/build smoke across eight projects. **Workflow has not run in GitHub yet**; it does not include Postgres/Playwright or security/production deployment gates. Per-project folder-local workflows remain inert; root smoke checks are not a substitute for production CI.
- Shell count above is deliberately only the original string-marker scan. Parking's returning-`None` watchlist, SiomayOps's synthetic E2E and fake provider, and manga's in-memory store demonstrate why this metric cannot imply completion.

## Priority continuation

1. Parking: map **every** PRD §4.A MVP requirement (including UI/search/QRIS/watchlist if required) to new/existing tasks; build and test missing flows; verify a real device/CLI journey. Keep §4.B clearly post-MVP.
2. SiomayOps: replace the seven synthetic Playwright assertions with true browser journeys, complete the provider-specific production adapter contract behind external merchant credentials, fix manifests and rerun all gates.
3. StrangerLink: implement the 20 E2E TODO scenarios and add the missing lint toolchain; audit live WebSocket/TURN cleanup before certifying.
4. RSI: add artifact schema regression checks and finish evidence-backed prototype traceability; avoid claiming production candidate isolation/rollback (not declared scope).
5. Minimal manga → HomeOps → Yomi → MajelisHub: proceed one ROADMAP slice at a time; convert task-owned TODO tests to meaningful assertions; keep all task IDs and original requirements. Avoid moving/deleting tasks to game percentages.

**Final verified completion of workspace: NOT 100%.** This audit improves testability, security and status accuracy but does not complete the hundreds of outstanding tasks.
