# TRACEABILITY.md — Requirement → Task → Implementation → Test → Evidence

> 2026-09-27 · Every high-priority requirement of the RSI prototype is traced to
> code, to a test, and to the artifact that proves it at runtime.

Requirement IDs are defined here (the repository's specs are `AGENTS.md` and
`README.md`; this file is the traceability surface they imply).

## 1. Safety requirements (the RSI safety position)

| Requirement | Task | Implementation | Test | Runtime evidence |
|---|---|---|---|---|
| **SR-01** Improvement is BOUNDED — every cycle has explicit limits | T-IMP-002 | `rsi/improvement.py::ImprovementLimits` | `test_iteration_limit_caps_proposals_per_cycle`, `test_max_cycles_is_respected`, `test_wall_clock_budget_stops_the_loop` | `runs/cycles.json` → `limits` |
| **SR-02** Improvement is AUDITABLE | T-AUD-001/002 | `rsi/audit.py` | `test_deleting_an_audit_record_breaks_the_chain` | `runs/audit.jsonl`, `rsi.cli audit --verify` |
| **SR-03** Improvement is REVERSIBLE | T-IMP-006/007 | `rsi/improvement.py`, `rsi/memory.py::snapshot/restore` | `test_post_apply_verification_failure_triggers_rollback` | `runs/baseline-mem-*.json` |
| **SR-04** Improvement is TESTED | T-EVAL-001…007 | `rsi/evaluator.py` | `test_adversarial.EvaluationTamperTests` | `runs/cycles.json` → `evaluations` |
| **SR-05** Improvement is HUMAN-CONTROLLED | T-RISK-005/007 | `rsi/improvement.py::ApprovalPolicy` | `test_auto_approve_never_covers_high_risk` | `runs/audit.jsonl` → `proposal-escalated` |
| **SR-06** No modification of arbitrary host files | T-SBOX-002 | `rsi/sandbox.py` | `test_absolute_and_traversal_paths_are_refused` | — |
| **SR-07** No silent rewrite of safety constraints | T-RISK-003 | `rsi/risk.py` | `test_safety_config_is_protected` | — |
| **SR-08** No silent permission expansion or self-granted tools | T-RISK-002 | `rsi/risk.py::CRITICAL_AREAS` | `test_restricted_scope_is_critical` | — |
| **SR-09** No silent deployment | T-RISK-002 | `rsi/risk.py` | `test_production_deployment_is_never_auto_approved` | — |
| **SR-10** No silent credential change | T-SBOX-005 | `rsi/sandbox.py::assert_no_secrets` | `test_secret_smuggling_is_refused` | — |
| **SR-11** No hidden modifications | T-AUD-001 | `rsi/audit.py` (hash chain) | `test_editing_an_audit_record_breaks_the_chain` | — |
| **SR-12** Audit logs cannot be disabled | T-RISK-003 | `rsi/risk.py` (`rsi/audit.py` is CRITICAL) | `test_safety_config_is_protected` | — |
| **SR-13** Rollback paths are never removed | T-PATCH-001 | every change set requires `rollback_plan` | `test_proposal_is_evidence_backed_and_measurable` | — |
| **SR-14** No modification of production systems without approval | T-RISK-005 | `rsi/improvement.py` | `test_high_risk_requires_human_approval` | — |

## 2. Loop requirements

| Requirement | Task | Implementation | Test | Evidence |
|---|---|---|---|---|
| **LR-01** Observe current behaviour | T-IMP-001 | `ImprovementLoop.evidence_from_attempts` | `test_step_02_observe_failures` | `runs/attempts.jsonl` |
| **LR-02** Collect evidence | T-PROP-005 | `rsi/feedback.py` | `test_adversarial.PromptInjectionTests` | `runs/cycles.json` → `evidence_count` |
| **LR-03** Identify weakness | T-RSI-002 | `rsi/curriculum.py`, `memory.weak_keys` | `test_weak_keys_respects_min_coverage` | `runs/report.md` |
| **LR-04** Generate an improvement proposal | T-PROP-001/002 | `rsi/proposals.py` | `test_step_03_generate_proposals` | `runs/cycles.json` → `proposals` |
| **LR-05** Estimate risk | T-RISK-001 | `rsi/risk.py` | `test_risk_is_computed_from_the_change_not_the_claim` | `runs/audit.jsonl` → `proposal-created.risk_level` |
| **LR-06** Create an isolated candidate | T-SBOX-001 | `rsi/sandbox.py` | `test_steps_04_to_07_…` | `runs/audit.jsonl` → `candidate-evaluated.workspace` |
| **LR-07** Run evaluation | T-EVAL-001 | `rsi/evaluator.py` | `test_steps_04_to_07_…` | `runs/cycles.json` → `evaluations` |
| **LR-08** Compare baseline vs candidate | T-EVAL-003 | `rsi/orchestrator.py::evaluate_against` | `test_steps_04_to_07_…` | `runs/dashboard.html` |
| **LR-09** Accept / reject | T-EVAL-004 | `rsi/evaluator.py::decide` | `test_step_08_reject_a_failing_candidate` | `runs/audit.jsonl` → `proposal-rejected` |
| **LR-10** Apply if approved | T-IMP-006 | `rsi/improvement.py` | `test_steps_09_to_12_…` | `runs/audit.jsonl` → `improvement-applied` |
| **LR-11** Record outcome | T-AUD-001 | `rsi/audit.py` | `test_full_cycle_is_auditable_end_to_end` | `runs/audit.jsonl` |
| **LR-12** Rollback on regression | T-IMP-007 | `rsi/improvement.py` | `test_steps_13_to_14_…` | `runs/audit.jsonl` → `rollback-executed` |

## 3. Evidence requirements

| Requirement | Task | Implementation | Test |
|---|---|---|---|
| **ER-01** Improvement is backed by measurable evidence, not an LLM claim | T-PROP-002, T-EVAL-004 | `rsi/proposals.py`, `rsi/evaluator.py` | `test_proposal_is_evidence_backed_and_measurable` |
| **ER-02** No fake success | — | no code path returns a synthetic pass | `test_tamper_findings_block_acceptance` |
| **ER-03** Baseline vs candidate are explicitly distinguished | T-EVAL-003 | `rsi/evaluator.py::_metrics` | `test_steps_04_to_07_…` |
| **ER-04** A candidate never replaces baseline without passing acceptance | T-EVAL-004 | `rsi/evaluator.py::decide` | `test_step_08_reject_a_failing_candidate` |
| **ER-05** Multi-metric evaluation; no one-score optimisation | T-EVAL-001 | five metrics, four critical | `test_steps_04_to_07_…` |
| **ER-06** Benchmark definitions are versioned | T-BENCH-001 | `BENCHMARK_SUITE_VERSION`, `benchmark_version` per run | `test_snapshot_records_environment_and_config` |
| **ER-07** Incomparable environments are not read as a delta | T-BENCH-003 | `rsi/benchmark.py::comparability` | `test_incomparable_environments_are_refused` |

## 4. Anti-tampering requirements

| Requirement | Task | Implementation | Test |
|---|---|---|---|
| **TR-01** Candidate cannot delete a failing test | T-PATCH-004 | change ops are add/replace/retire lessons only | `test_candidate_cannot_delete_a_failing_test` |
| **TR-02** Candidate cannot change an evaluator threshold | T-RISK-003 | `rsi/evaluator.py` is a protected path | `test_candidate_cannot_change_the_evaluator` |
| **TR-03** Candidate cannot read expected answers | T-EVAL-005 (R5) | `TamperDetector` | `test_candidate_cannot_read_expected_answers` |
| **TR-04** Candidate cannot special-case benchmark ids | T-EVAL-005 (R4) | `TamperDetector` | `test_candidate_cannot_special_case_a_benchmark_id` |
| **TR-05** Candidate cannot fabricate an untraceable lesson | T-EVAL-005 (R1) | `TamperDetector` | `test_candidate_cannot_fabricate_an_untraceable_lesson` |
| **TR-06** Candidate cannot self-certify | T-EVAL-005 (R2) | `TamperDetector` | `test_candidate_cannot_self_certify_an_unverified_lesson` |
| **TR-07** Candidate cannot win by padding memory | T-EVAL-005 (R3, R7) | `TamperDetector` | `test_irrelevant_lessons_are_rejected` |
| **TR-08** Candidate cannot edit the audit log | T-AUD-002 | hash chain | `test_editing_an_audit_record_breaks_the_chain` |
| **TR-09** Candidate cannot attempt a sandbox escape | T-SBOX-002 | path containment | `test_traversal_and_absolute_writes_are_refused` |
| **TR-10** Candidate cannot exceed the diff limit | T-PATCH-005 | diff budget | `test_diff_budget_rejects_a_huge_change_set` |
| **TR-11** Candidate cannot modify safety config | T-RISK-003 | protected paths | `test_safety_config_is_protected` |
| **TR-12** Candidate cannot propose production deployment without approval | T-RISK-005 | `CRITICAL_AREAS` | `test_production_deployment_is_never_auto_approved` |
| **TR-13** Candidate cannot inject instructions via repository content | T-PROP-006 | `FeedbackIngestor`, `TamperDetector` (R6) | `test_feedback_with_injection_is_quarantined` |
| **TR-14** Candidate cannot smuggle a secret | T-SBOX-005 | secret scan | `test_secret_smuggling_is_refused` |

## 5. Concurrency, idempotency, memory

| Requirement | Task | Implementation | Test |
|---|---|---|---|
| **CR-01** Two cycles never race on the same baseline | T-IMP-004 | `LoopLock` | `test_concurrency_lock_serialises_cycles` |
| **CR-02** Candidate evaluated against a stale revision is refused | T-PATCH-003 | `RevisionMismatch` | `test_stale_base_revision_is_refused` |
| **CR-03** Duplicate proposal execution is prevented | T-IMP-005 | deterministic ids + `applied.json` | `test_duplicate_proposals_are_not_re_applied` |
| **MR-01** Permanent memory writes need stronger evidence than runtime observations | T-PROP-002 | verified lessons from observed attempts only | `test_candidate_cannot_self_certify_an_unverified_lesson` |
| **MR-02** Memory entries are versioned and deprecatable | T-MEM-002 | `version`, `superseded_by`, `deprecated` | `test_apply_add_replace_retire_roundtrip` |
| **MR-03** A failed experiment does not become permanent memory | T-IMP-007 | rollback restores the exact payload | `test_steps_13_to_14_…` |
| **MR-04** The last known-good baseline is never deleted | T-IMP-006 | `runs/baseline-mem-*.json` | `test_baseline_is_archived_before_apply` |
| **MR-05** Frozen memory refuses all writes | T-MEM-004 | `MemoryFrozenError` | `test_frozen_memory_refuses_patches` |

## 6. Observability requirements

Every cycle must be able to answer the operator's questions. Each question maps
to a field in `runs/audit.jsonl` (asserted by
`test_full_cycle_is_auditable_end_to_end`):

| Question | Audit event | Field |
|---|---|---|
| What changed? | `improvement-applied` | `operations`, `revision_after` |
| Why was it proposed? | `proposal-created` | `hypothesis`, `target_component` |
| What evidence was collected? | `candidate-evaluated` | `metrics`, `checks` |
| What was the baseline? | `cycle-started` | `baseline_revision` |
| What was the candidate? | `proposal-created` | `diff` |
| What metrics changed? | `candidate-evaluated` | `metrics[].delta` |
| Why accepted or rejected? | `improvement-applied` / `proposal-rejected` | `rollback` / `reasons` |
| Who approved it? | `proposal-escalated`, `rao-applied` | `approver` |
| Can it be rolled back? | `improvement-applied` | `rollback.reversible` |

## 7. How to re-verify

```bash
cd rsi-agent-recursive-self-improvement-prototype
python3 -m unittest discover -s tests -v     # 137 tests, offline
python3 demo.py --improve --max-cycles 2     # full run + improvement loop
python3 -m rsi.cli status                    # one-screen state
python3 -m rsi.cli audit --verify            # audit chain
python3 -m rsi.cli dashboard                 # runs/dashboard.html
```
