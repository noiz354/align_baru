# EVALUATION.md — Evaluation Engine, Acceptance Policy and Benchmark Integrity

> 2026-09-27 · Companion docs: SECURITY.md, ROLLBACK.md, OBSERVABILITY.md.

## 1. The question the engine answers

> Given a *candidate* memory and a *baseline* memory, run both over the **same**
> holdout tasks and decide, from metrics alone, whether the candidate is a genuine
> improvement.

The candidate never replaces the baseline implicitly: `EvaluationEngine.decide`
returns an explicit decision, and `ImprovementLoop` acts only on it.

## 2. Pipeline

```
candidate change set
   └─► mandatory structural checks  ── any failure ⇒ REJECT (regardless of metrics)
         ├─ change-set-valid      (LessonChangeSet.validate)
         ├─ tamper-scan           (TamperDetector R1–R8)
         ├─ benchmark-integrity   (holdout ids match the evaluation holdout)
         └─ candidate-isolated    (candidate holds ≤ max_changed_lessons)
   └─► metrics on identical holdout (baseline run, then candidate run)
         ├─ failed_task_recovery_rate   ← TARGET (critical)
         ├─ holdout_success_rate        ← critical
         ├─ avg_score                   ← critical
         ├─ escalation_rate             ← critical (must not increase)
         └─ targeted_coverage           ← supporting
   └─► AcceptancePolicy.decide
         all mandatory checks pass AND no tamper findings AND
         target metric improves ≥ min_target_delta AND
         no critical regression AND
         risk ≤ policy ceiling ⇒ ACCEPT
```

## 3. Metrics

Every metric records baseline, candidate and delta, so a report never shows a bare
number without its reference point.

| Metric | Critical | Meaning | Why it is the target |
|---|---|---|---|
| `failed_task_recovery_rate` | yes | Of the tasks the baseline failed, the fraction the candidate recovers | Directly measures "the agent learned from its mistakes"; a single flipped task is a large step, so it is sensitive enough to drive a real loop |
| `holdout_success_rate` | yes | Overall holdout success | Guards against a candidate that helps one task and breaks another |
| `avg_score` | yes | Mean verifier score | Guards against low-quality wins |
| `escalation_rate` | yes | Fraction escalated to a human | A candidate that makes the agent look better by *stopping asking for help* is a critical regression |
| `targeted_coverage` | supporting | Share of targeted keys now covered | Explains *why* the target metric moved |

`TARGET_METRIC = "failed_task_recovery_rate"` (`rsi/evaluator.py`).

## 4. Acceptance policy

```python
policy = AcceptancePolicy(
    min_target_delta=0.10,      # required target-metric improvement
    critical_regression=0.0,    # any critical regression blocks acceptance
)
```

Acceptance requires **all** of:

1. every mandatory check passed,
2. no tamper findings,
3. `target_metric.delta ≥ min_target_delta`,
4. no critical metric regressed,
5. risk ≤ `RiskPolicy.auto_accept_ceiling` (default **MEDIUM**) for an
   automatic decision; anything higher is **ESCALATED** to a human approver, and
   is **denied** when no approver is configured.

## 5. Tamper detection (anti-overfitting)

`TamperDetector.findings()` inspects baseline, candidate and the diff, and never
consults a confidence claim.

| Rule | Rejects |
|---|---|
| R1 | A lesson with no traceable provenance (`source_task_id`) |
| R2 | A lesson that self-certifies (`verified=True` without an observed attempt) |
| R3 | A candidate that changes *unrelated* lessons |
| R4 | A lesson that names a task id, a benchmark id, an expected output or the evaluator |
| R5 | A candidate that reads expected answers or hardcodes a fixture |
| R6 | Lessons carrying injection vocabulary |
| R7 | A candidate that pads memory to win by coverage |
| R8 | A candidate that edits the evaluator, sandbox or safety config |

Findings are written to the audit log and to `runs/cycles.json`, so a rejected
proposal always states *why*.

## 6. Benchmark integrity

* `BENCHMARK_SUITE_VERSION = "holdout-v1"` is stamped into every evaluation run
  and every snapshot.
* `BenchmarkConfig` pins the task template family, per-wave task count, DRS
  rounds, holdout size, holdout seed and improvement on/off; `fingerprint()` makes
  the configuration part of the artifact.
* `BenchmarkSnapshot` also records the environment (Python version, platform) so
  a snapshot from another machine is not compared to this one.
* `comparability()` returns a *blocking* reason when environments or configs
  differ, and `compare_snapshots()` refuses to produce a delta from an
  incomparable pair — no silently misleading improvement.
* Metrics are always produced by running the real pipeline
  (`RSIOrchestrator.evaluate_against`), never synthesised.

## 7. Reproducibility

Seeds are stable CRC32 hashes (`rsi/types.py::stable_seed`), and `MockJev` is a
pure function of `question.state`. `evaluate_against` uses a separate
`_eval_counter` so baseline and candidate runs assign the actor identically.
Two runs of the same seed produce the same metrics — which is what makes the
benchmark matrix meaningful.
