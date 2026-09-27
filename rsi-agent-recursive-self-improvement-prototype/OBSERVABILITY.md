# OBSERVABILITY.md — Metrics, Audit History and Loop Health

> 2026-09-27 · Companion docs: SECURITY.md, EVALUATION.md, ROLLBACK.md.

Every run writes plain-text, diff-friendly artifacts into `runs/`. No secrets and
no unnecessary prompt content are logged; feedback free text is capped and
redacted before it can reach an audit record.

## 1. Artifacts

| File | Contents | Written by |
|---|---|---|
| `attempts.jsonl` | every exploration attempt, one JSON per line | `RSIOrchestrator` |
| `memory.json` | the frozen memory payload at the end of a run | `PersistentMemory.save` |
| `memory.prev.json` | the previous `memory.json`, kept for one generation | `PersistentMemory.save` |
| `baseline-mem-<rev>.json` | baseline snapshot taken before an apply — rollback material | `ImprovementLoop` |
| `audit.jsonl` | append-only, hash-chained event log | `AuditLog` |
| `cycles.json` | cumulative cycle history across processes | `ImprovementLoop` |
| `applied.json` | proposal ids already applied (duplicate-apply prevention) | `ImprovementLoop` |
| `benchmark-*.json` | per-arm benchmark snapshots with environment fingerprints | `rsi.benchmark` |
| `report.md` | human-readable run report with a self-improvement section | `RSIOrchestrator.report` |
| `dashboard.html` | self-contained static dashboard over all of the above | `rsi.dashboard` |

Read the state at any time with `python3 -m rsi.cli status`; verify the audit
chain with `python3 -m rsi.cli audit --verify`.

## 2. Audit events

`runs/audit.jsonl` is append-only and hash-chained: each record carries the hash
of its predecessor, so deleting or editing a record breaks `verify_chain()` and
names the offending index.

| Event | Emitted when | Key fields |
|---|---|---|
| `cycle-started` | a loop cycle begins | `baseline_revision`, `cycle`, `limits` |
| `proposal-created` | a proposal is generated | `hypothesis`, `target_component`, `risk_level`, `diff` |
| `proposal-rejected` | evaluation rejects a candidate | `reasons`, `metrics` |
| `proposal-escalated` | a change exceeds the auto-accept ceiling | `risk_level`, `approver` |
| `candidate-evaluated` | a candidate is evaluated | `workspace`, `checks`, `metrics`, `benchmark_version` |
| `improvement-applied` | a candidate is applied | `revision_before`, `revision_after`, `operations`, `rollback` |
| `rollback-executed` | a rollback completes | `restored_revision`, `archive`, `proposal_id` |
| `rao-applied` | RAO rewrites a skill file | `approver`, `files` |
| `rao-rollback` | RAO rollback | `restored` |
| `rao-escalated` | RAO change exceeds the ceiling | `risk_level` |

Redaction applies to every record: a credential-shaped value raises before the
record is written.

## 3. Loop health

`rsi.metrics.compute_loop_health(cycles, audit_counts)` produces
`LoopHealth.to_dict()`:

| Field | Meaning |
|---|---|
| `cycles` | cycles completed |
| `proposals` | proposals generated |
| `accepted` / `rejected` / `escalated` | decisions by outcome |
| `rolled_back` | applied improvements that were later rolled back |
| `acceptance_rate` | accepted ÷ proposals |
| `regression_rate` | rejected-for-regression ÷ proposals |
| `rollback_rate` | rolled back ÷ accepted |
| `mean_evaluation_duration_s` | mean candidate evaluation wall time |
| `median_improvement_delta` | median target-metric delta of accepted candidates |
| `stagnation_count` | consecutive cycles without meaningful improvement |
| `cycles_aborted` | cycles that hit a hard limit rather than a decision |

`render_health()` prints it as bullets in `report.md` and in the dashboard.

## 4. The operator questions every cycle must answer

Asserted end-to-end by `tests/test_manual_qa.py::test_full_cycle_is_auditable_end_to_end`:

| Question | Answered by |
|---|---|
| What changed? | `improvement-applied.operations`, `revision_after` |
| Why was it proposed? | `proposal-created.hypothesis`, `target_component` |
| What evidence was collected? | `cycle-started.evidence_count`, `candidate-evaluated.checks` |
| What was the baseline? | `cycle-started.baseline_revision` |
| What was the candidate? | `proposal-created.diff` |
| What metrics changed? | `candidate-evaluated.metrics[].delta` |
| Why accepted or rejected? | `improvement-applied.rollback` / `proposal-rejected.reasons` |
| Who approved it? | `proposal-escalated.approver`, `rao-applied.approver` |
| Can it be rolled back? | `improvement-applied.rollback.reversible` |

## 5. Stagnation detection

When `stagnation_count` reaches `ImprovementLimits.stagnation_window` (default 3),
the loop stops and records `stagnated` in `cycles.json` with the reason. A run
that yields no meaningful improvement therefore terminates with an explicit,
audited cause instead of looping forever.
