# ROADMAP.md — Vertical Slice Plan

> 2026-09-27 · Status: **VS-0 … VS-6 IMPLEMENTED** · Task detail: TASKS.md ·
> Requirement mapping: TRACEABILITY.md

## 1. Delivery philosophy

| Principle | Rule |
|---|---|
| Vertical slices, not layers | Every slice ends with something an operator can actually do. |
| Thin but complete | Each slice implements its rules **and** its tests **and** its artifacts. |
| No slice without an operator | If nobody can run it and read the result, it is not a slice. |
| Safety before breadth | Risk classification, human gates, audit and rollback ship with the first slice that mutates anything. |
| Reversibility | Every applied improvement keeps a recoverable accepted baseline. |
| Stdlib only | No dependency is added to make a slice easier. |

## 2. Slice map

| Slice | Name | Outcome (an operator can…) | Key tasks | Status |
|---|---|---|---|---|
| **VS-0** | RSI loop | run `python3 demo.py` and see cold vs warm on an identical holdout | T-RSI-001…010 | DONE |
| **VS-1** | Proposal engine | see *why* the agent wants to change itself, with evidence | T-PROP-001…007 | DONE |
| **VS-2** | Safety model | know the risk level of any change and who may approve it | T-RISK-001…007 | DONE |
| **VS-3** | Isolation + patches | inspect the exact diff of a candidate and see it applied in a sandbox | T-SBOX-001…007, T-PATCH-001…005 | DONE |
| **VS-4** | Evaluation + loop | run bounded cycles and read accept/reject/rollback decisions | T-EVAL-001…007, T-IMP-001…009 | DONE |
| **VS-5** | Audit + observability | verify the audit chain and read loop health | T-AUD-001…004, T-MET-001…003 | DONE |
| **VS-6** | Artifacts | benchmark arms, open a dashboard, export skills, run RAO | T-BENCH-001…004, T-DASH-001…003, T-SKILL-001…004, T-RAO-001…004, T-CLI-001…004 | DONE |

## 3. Slice detail

### VS-0 — RSI loop (pre-existing, verified)

`Curriculum → Actor (ReAct) → Verifier` over persistent memory, with Jev
deciding guardrail / routing / grading / done. BRS writes broad experience, DRS
targets weak keys, freeze ends exploration, test-time measures cold vs warm.

Exit criteria: `python3 demo.py` runs offline; `tests/test_rsi.py` passes; warm
beats cold on the identical holdout.

### VS-1 — Proposal engine

Raw signals (execution failures, test failures, tool failures, benchmark
regressions, human corrections, review comments) become `Evidence`, and
`ProposalGenerator` turns evidence into `ImprovementProposal`s whose hypothesis
and expected benefit are measurable. Feedback text is quarantined data, never an
instruction.

Exit criteria: no proposal without evidence; no proposal for an already-covered
key; hazard-marked feedback quarantined.

### VS-2 — Safety model

`classify_risk()` is a pure function of the change shape — never of a confidence
claim. HIGH and CRITICAL changes require a human approver; without one they are
recorded as ESCALATED and left unapplied.

Exit criteria: a candidate that touches `rsi/`, `tests/`, `SECURITY.md`,
`pyproject.toml` or the evaluator can never be auto-applied.

### VS-3 — Isolation + patches

`CandidateWorkspace` materialises each candidate in a disposable temp directory
with path containment, byte/file/diff budgets and secret scanning.
`LessonChangeSet` / `FilePatch` carry proposal id, base revision and reason, and
`apply()` refuses a stale base revision.

Exit criteria: no absolute or traversing write; no secret-shaped byte enters a
candidate; a stale candidate cannot be applied.

### VS-4 — Evaluation + loop

`EvaluationEngine` compares baseline and candidate on identical holdout tasks
across five metrics, runs mandatory structural checks and tamper detection, and
applies an explicit acceptance policy. `ImprovementLoop` drives the cycle with
hard budgets, a concurrency lock, idempotent application, post-apply
verification and automatic rollback.

Exit criteria: a candidate that does not move the target metric is rejected; a
failing post-apply verification rolls back and restores the exact baseline
payload; stagnation stops the loop.

### VS-5 — Audit + observability

`AuditLog` is append-only and hash-chained; deleting or editing a record breaks
the chain and `verify_chain()` says where. `LoopHealth` reports acceptance,
regression, rollback and stagnation rates, evaluation duration and improvement
deltas.

Exit criteria: `python3 -m rsi.cli audit --verify` reports INTACT after a clean
run and BROKEN after tampering.

### VS-6 — Artifacts

`rsi.benchmark` snapshots per-arm metrics with an environment fingerprint and
refuses to compare across environments. `rsi.dashboard` renders one
self-contained HTML file. `rsi.skills` exports verified memory as `SKILL.md` /
`CLAUDE.md`. `rsi.rao` self-assesses a run and rewrites only those two files,
behind a human gate, with rollback.

Exit criteria: `python3 -m rsi.cli run --improve` produces `report.md`,
`memory.json`, `attempts.jsonl`, `audit.jsonl`, `cycles.json` and
`dashboard.html`.

## 4. Remaining roadmap (post-implementation)

| Item | Why it is not in this slice |
|---|---|
| Real TypeSafe Jev semantics | Externally blocked (T-EXT-001) |
| Real LLM actor backend | Externally blocked (T-EXT-002) |
| Benchmark arms beyond the documented matrix | The documented matrix (seed × formula × DRS count × improvement on/off) is implemented; more arms are configuration, not code |
| Dashboard interactivity (filtering, drill-down) | Explicitly out of scope: "do not turn it into a giant MLOps platform" |
