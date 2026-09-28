# REALITY AUDIT — rsi-agent-recursive-self-improvement-prototype

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `MVP_USABLE` (as a declared offline
prototype)**

## 1. Scope

This project declares itself an **offline prototype** with a mock LLM and a mock judge, and it is
scoped honestly. It is the only project in the workspace whose status document disclaims its own
reach. There is no product backlog here to audit; there is a research artefact.

## 2. Gate status (measured)

| Gate | Command | Exit | Result |
|---|---|---:|---|
| tests | `python3 -m unittest discover -s tests -v` | 0 | **Ran 147 tests in 6.36 s — OK** |
| demo | `python3 demo.py` | 0 | offline run completes |
| CI | `project-checks.yml` `python` matrix | — | correctly wired |

The suite prints its own `[rao] ESCALATED prop-…: risk MEDIUM requires a human approver; none is
configured, so the skill-file rewrite was NOT applied` — the human-gate path is genuinely exercised,
not just described.

## 3. The only documentation defect here: a stale number

| Document | Claim | Measured |
|---|---|---|
| `README.md:48` | "141 test" | **147** |
| `README.md:229` | "141 test, semuanya offline" | **147** |
| `AGENTS.md:60` | "141 test, semua offline" | **147** |
| `COMPLETION_MATRIX.md:14` | "**11 passed** (10 old + step-budget regression)" | **147** |
| `MVP_MATRIX_WAVE3.md` | "**147 passed, 1 skipped**" | 147 |

Four documents, three different numbers, and only the most recent one matches a run. This is the same
class of defect as the other six projects, just harmless because nothing depends on the number.

`TASKS.md:3` claims "**ALL ACTIONABLE TASKS IMPLEMENTED**" — unverifiable from the file, since no row
carries a status column, but also harmless for the same reason.

## 4. The part to protect

`DELIVERABLES.md` is the template the rest of the workspace should copy. It is a seven-row traceability
register that, for every deliverable, states the implementation, the test that proves it, **and the
limit**:

> *"it does not certify safe autonomous edits to arbitrary real repositories"*
> *"P-07 … `IMPLEMENTED_BUT_UNVERIFIED` (artifact schema not separately tested)"*
> *"Never extrapolate the mock cold/warm improvement to a real coding agent."*
> *"Real provider credentials are optional environment configuration; tests exercise mocks only."*

That is exactly the shape of claim this audit needed and did not find elsewhere. Two of seven rows are
`VERIFIED_DONE`, one is `IMPLEMENTED_BUT_UNVERIFIED`, and the file says so out loud.

## 5. Security reality

Appropriate to the scope, with real controls:

- Protected paths (`rsi/`, `tests/`, `SECURITY.md`, …) marked CRITICAL; proposals touching them are
  gated and escalated, not applied.
- The improvement loop is bounded by limits, hash-chained in `audit.jsonl`, reversible via
  `baseline-*.json`, and requires a human approver for HIGH/CRITICAL risk. `tests/test_adversarial.py`
  and `tests/test_repo_workflow.py` cover the guard paths.
- Step-budget exhaustion now fails checks closed rather than inheriting a planner's cached success —
  a real bug that was found and fixed, and the test that proves it is named in `DELIVERABLES.md`.

No P0. No P1. Persistence is deliberately `runs/` (regenerable, git-ignored), which is the correct
choice for this artefact.

## 6. Core journeys

| Journey | Reality |
|---|---|
| UJ-RSI-001 run exploration → freeze → test-time on a holdout | works, 147 tests |
| UJ-RSI-002 propose → evaluate → human-gate → apply → verify → roll back | works; medium/high risk escalates by design |

## 7. What is needed

1. Correct 141 → 147 in three files, and drop the `11 passed` row in `COMPLETION_MATRIX.md`.
2. Nothing else. This project is done for its declared scope.

The one substantive open item is `DELIVERABLES.md` P-07 (*"artifact schema not separately tested"*) —
`tests/test_artifacts.py` exists, so the row may simply be out of date. Verify and close or re-state it;
do not leave a row that is neither verified nor explained.
