# AUDIT_2026-09-28

Ground truth for seven of the eight projects, measured on commit `8ebc15f`.
`yomi-manga-reader-arch-skeleton` is excluded — another agent is working there.

**Start here:** [`REAL_AUDIT_SUMMARY.md`](REAL_AUDIT_SUMMARY.md).
**Then plan from:** [`../specs/`](../specs/).

| File | Contents |
|---|---|
| [`REAL_AUDIT_SUMMARY.md`](REAL_AUDIT_SUMMARY.md) | status criteria, the scoreboard, the five dominant findings, and 12 falsifiable claims each with the command that settles it |
| [`projects/siomayops/REALITY_AUDIT.md`](projects/siomayops/REALITY_AUDIT.md) | 37 routes and 13 pages work; identity does not exist; nothing survives a restart |
| [`projects/homeops/REALITY_AUDIT.md`](projects/homeops/REALITY_AUDIT.md) | 32 real pages behind no tenant boundary; the deploy migration creates half the schema |
| [`projects/majelishub/REALITY_AUDIT.md`](projects/majelishub/REALITY_AUDIT.md) | the strongest data layer in the workspace, bypassed by four pages and three handlers |
| [`projects/strangerlink/REALITY_AUDIT.md`](projects/strangerlink/REALITY_AUDIT.md) | a real working product, held back only by non-durable safety records |
| [`projects/manga/REALITY_AUDIT.md`](projects/manga/REALITY_AUDIT.md) | a working reader with an open admin surface and a test file that never runs |
| [`projects/parking/REALITY_AUDIT.md`](projects/parking/REALITY_AUDIT.md) | a complete, durable, tested domain with no product, and evidence for code that was never committed |
| [`projects/rsi/REALITY_AUDIT.md`](projects/rsi/REALITY_AUDIT.md) | meets its declared scope and says so honestly; one stale number |
| [`FEATURE_REALITY_MATRIX.md`](FEATURE_REALITY_MATRIX.md) | capability by capability, derived from the module tree |
| [`USER_JOURNEYS.md`](USER_JOURNEYS.md) | 31 journeys as `UJ-XXX`, with the current truth for each |
| [`FEATURE_GAPS.md`](FEATURE_GAPS.md) | GAP-P0…P3 mapped to features; and what was rejected |
| [`SECURITY_GAPS.md`](SECURITY_GAPS.md) | every item pointing to running code or a captured request |
| [`PERSISTENCE_REALITY.md`](PERSISTENCE_REALITY.md) | create → read → update → restart → read, measured per project |
| [`TEST_EXECUTION.md`](TEST_EXECUTION.md) | real runner output, exit codes, counts, durations |
| [`DOCUMENTATION_RECONCILIATION.md`](DOCUMENTATION_RECONCILIATION.md) | KEEP / UPDATE / ARCHIVE / DELETE for every contradictory document |
| [`evidence/`](evidence/) | raw command captures and runner logs |

## Method

Nothing was taken from a README, a `TASKS.md` status column, a screenshot, a commit message, a
completion matrix, or a test count written in prose. Ground truth came from:

1. `npm ci`, `typecheck`, `lint`, `test`, `build` — recorded exit codes and durations.
2. A real **PostgreSQL 18.4** server (`embedded-postgres`) rather than PGlite, so that engine-specific
   behaviour could not be mistaken for database behaviour.
3. Each app started in **production mode** and probed with `curl` and no credential.
4. Direct SQL to establish what the database layer actually enforces.

No production code was modified. The only file added to the repository by this audit is this
directory and `specs/`, on branch `feat/hapus_kebohongan_document`.
