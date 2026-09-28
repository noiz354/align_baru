# REALITY AUDIT — parking-attendant-ops-app-spec

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `DEMO_ONLY`**

## 1. The evidence problem

`MVP_AUDIT/progress/parking-attendant-ops-app-spec/AFTER.md:3` claims:

> **Result: ACHIEVED** — flow `Start shift → check-in → inspect → checkout → fee → payment →
> reconciliation` is now end-to-end via browser UI

and `:12` gives the reproduction command `python3 server.py --port 3201` with a URL, plus eight
screenshots (`screenshots/after/01-entry-state.png` … `08-mobile.png`, all valid PNG, 1425×1101,
~160 KB each).

**There is no `server.py`. There is no `static/`. There never was.**

```
$ find parking-attendant-ops-app-spec -name 'server.py' -o -name 'index.html'   → nothing
$ git log --all --diff-filter=A -- '*server.py' '*static/index.html'             → nothing
$ git log --all --oneline --diff-filter=A | grep -i parking                      → nothing
```

`MVP_AUDIT/projects/parking-attendant-ops-app-spec/AUDIT.md:5` repeats it: *"operator UI adapter:
`server.py + static/index.html`"*.

The screenshots are therefore **`NON_REPRODUCIBLE_EVIDENCE`** and must not be used to support any
completion claim. This is the most serious documentation defect in the workspace: it is not an
overstatement of a working thing, it is a working-looking artefact of code that was never committed.

The same `AUDIT.md` carries **two verdicts in one file**: `:3` `MVP_READY`, `:109` `MVP_PARTIAL` with
*"the operator UI is **not** wired — no browser page"*. Both are still there.

## 2. Documentation vs. reality

| Claim | Source | Reality |
|---|---|---|
| "unittest suite (**61 tests**)" | `README.md:36` | **66** |
| "the **64 unit tests** … exercise those paths" | `README.md:51` | **66** |
| "**64 passed**" | `COMPLETION_MATRIX.md:14` | 66 |
| "**66 passed**" | `MVP_MATRIX_WAVE3.md` | 66 |
| `MVP_READY` | `MVP_AUDIT/projects/…/AUDIT.md:3` | contradicted by `:109` in the same file |

Four documents, three different test counts, two different verdicts.

**And yet** `README.md` §"Completion boundary (audit 2026-09-27)" is the most honest prose in the
whole workspace. It states, unprompted: *"there is no attendant UI, durable provider-verified QRIS
settlement, or proof of cross-device concurrency safety"*, that `IOcrEngine.process_frame` raises
`NotImplementedError` as an abstract port, and that `VehicleWatchlistService` *"remains a
non-functional stub — operational watchlist policies in VEHICLE.md §4 are not verified"*, and closes
with *"Report this as **domain MVP partial / full PRD incomplete**, not VERIFIED 100%."*

`COMPLETION_MATRIX.md` then overrides that correct self-assessment with `MVP_READY`. The README should
be the source of truth; the matrix should not have overruled it.

## 3. Gate status (measured)

| Gate | Command | Exit | Result |
|---|---|---:|---|
| tests | `python3 -m unittest discover -s tests -v` | 0 | **Ran 66 tests — OK**, 0.62 s |
| demo | `python3 demo.py` | 0 | 10-step flow, 11 audited actions, `purge 1 mask 5` |
| typecheck / lint | — | n/a | Python; no linter configured, no `ruff`/`mypy` |
| CI | `.github/workflows/project-checks.yml` | — | `python -m unittest discover` runs in the `python` matrix. Correctly wired. |

This is the only Python project whose CI job actually runs its own test command, and the only project
whose README self-assessment is accurate.

## 4. Security reality

No P0. The monetary and privacy surfaces are handled properly:

- Monotonic tamper-resistant clock in `PricingEngine`; a rolled-back checkout time raises
  `ClockTamperError` (`src/infra/clock.py`, `README.md` ADR-002). Tested.
- Completed-session photos purged after 30 days, frozen while an incident is open (ADR-004/005).
  Tested.
- Historical audit plates masked; `purge 1 mask 5` in the demo.
- Lost ticket requires STNK/KTP plus supervisor PIN.
- **QRIS fails closed**: `src/modules/checkout/service.py:105` raises
  `ValueError("QRIS requires verified provider settlement before checkout")`, and lost-ticket
  checkout refuses anything but verified CASH (`:243`). No path marks an unverified payment `PAID`.
- `VehicleWatchlistService.check_watchlist` returns `None` for every input
  (`src/modules/vehicle/service.py:93-98`) — fail-open in the sense that it never blocks, but it also
  never grants. No security consequence, only a missing feature.

## 5. Persistence reality

`REAL_DATABASE` (SQLite) + `LOCAL_FILE`.

- `data/parking.db`, durable, survives restart.
- `audit_ledger.jsonl`, hash-chained, append-only, 11 entries in the demo run.
- Every mutation also writes an `outbox_events` row in the same transaction (`OFFLINE.md`), drained by
  `SyncEngineWorker` when connectivity returns. This is a real transactional outbox.

**This is the only project in the workspace whose business state provably survives a restart and is
exercised by a committed test.**

## 6. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-PRK-001…004.

| Journey | Reality |
|---|---|
| UJ-PRK-001 open shift with opening float | works, audited, durable |
| UJ-PRK-002 check a vehicle in and assign a slot | works, audited, durable |
| UJ-PRK-003 calculate the fee and take payment | works for CASH; QRIS fail-closed by design |
| UJ-PRK-004 close the shift and reconcile variance | works, `expected 128k actual 128k BALANCED` |
| operator performs these in a browser | **does not exist.** `server.py` was never committed |

The domain is `MVP_USABLE`. The product is not, because an attendant is defined by the fact that they
use it *at the vehicle*, in the rain, on a phone, four times an hour.

## 7. What is needed for real users

1. Write the operator UI, and **commit it** — the eight existing screenshots describe it, so the
   acceptance criteria are already written. Until then there is no product.
2. Reconcile the four test counts into one, from an actual run.
3. Reconcile the two verdicts in `AUDIT.md` into one.
4. `VEHICLE.md §4` watchlist: either implement `check_watchlist` or mark the policy as not in force in
   the document, so operators do not rely on a check that always passes.

Note on tooling: this project's task ids are `TASK-101`…`TASK-602`, not `T-XXX-NNN`. The workspace's
task-count tooling, the `majelishub` `no-fake-implementation` rule and `COMPLETION_MATRIX`'s "715
registered task IDs" all silently exclude it. Standardise the id format or exclude the project
explicitly from those counts.
