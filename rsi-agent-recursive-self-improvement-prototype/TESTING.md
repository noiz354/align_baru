# TESTING.md — Test Strategy and Inventory

> 2026-09-27 · Run: `python3 -m unittest discover -s tests -v`

137 tests, fully offline, Python stdlib only. No network, no credentials, no
fixtures on disk — every test builds its own `TemporaryDirectory` and removes it
afterwards, so the suite leaves no residue in `runs/`.

## 1. Strategy

| Layer | What is proven | Files |
|---|---|---|
| Unit | Risk classification, change-set validation, patch application, audit chaining, memory policy, secret detection, feedback ingestion | `test_improvement.py`, `test_adversarial.py` |
| Integration | The improvement loop end to end: proposal → sandbox → evaluation → decision → apply → verify → rollback | `test_improvement.py` |
| Artifact | Benchmarks, skills export, RAO, dashboard and CLI produce the documented artifacts and refuse what they should refuse | `test_artifacts.py` |
| Manual QA | The full 14-step operator walkthrough, executed as assertions | `test_manual_qa.py` |
| Adversarial | Every threat in SECURITY.md has a test that tries to exploit it | `test_adversarial.py` |

## 2. Coverage against the required minimum

| Required case | Test |
|---|---|
| Proposal creation | `test_proposal_is_evidence_backed_and_measurable` |
| Candidate generation | `test_step_03_generate_proposals` |
| Candidate isolation | `test_steps_04_to_07_isolate_inspect_evaluate_compare` |
| Baseline preservation | `test_rejected_candidate_never_mutates_the_baseline`, `test_baseline_is_archived_before_apply` |
| Evaluation | `test_acceptance_requires_a_real_improvement` |
| Acceptance | `test_steps_09_to_12_accept_apply_verify` |
| Rejection | `test_step_08_reject_a_failing_candidate` |
| Rollback | `test_steps_13_to_14_rollback_restores_the_baseline` |
| Stale-revision rejection | `test_stale_base_revision_is_refused` |
| Duplicate-apply prevention | `test_duplicate_proposals_are_not_re_applied` |
| Iteration limits | `test_iteration_limit_caps_proposals_per_cycle`, `test_max_cycles_is_respected` |
| Resource limits | `test_wall_clock_budget_stops_the_loop`, `test_diff_budget_rejects_a_huge_change_set`, `test_file_and_byte_budgets_are_enforced` |
| Test-tampering protection | `test_candidate_cannot_delete_a_failing_test`, `test_candidate_cannot_skip_an_assertion` |
| Benchmark-tampering protection | `test_candidate_cannot_change_the_benchmark`, `test_incomparable_environments_are_refused` |
| Memory write policy | `test_candidate_cannot_self_certify_an_unverified_lesson`, `test_deprecated_lessons_leave_the_read_path` |
| Stagnation stop | `test_stagnation_stops_the_loop` |
| Recursion / loop limits | `test_max_cycles_is_respected`, `test_iteration_limit_caps_proposals_per_cycle`, `test_lesson_budget_rejects_oversized_change` |
| Audit history | `test_full_cycle_is_auditable_end_to_end`, `test_deleting_an_audit_record_breaks_the_chain` |
| Adversarial | the whole of `test_adversarial.py` (36 tests) |

## 3. Determinism and hygiene

* Seeds come from `stable_seed` (CRC32), so a seed always produces the same
  curriculum, plans and Jev decisions.
* Tests never write outside their own temp directory; `runs/` is left untouched.
* One test is skipped when a seed happens to produce no acceptable candidate:
  `test_duplicate_proposals_are_not_re_applied`. It is skipped rather than
  weakened because the behaviour it asserts (no re-apply of an already-applied
  id) is directly asserted by `test_applied_ledger_blocks_replay`.

## 4. What is deliberately not tested

* Real Jev (TypeSafe) and real LLM backends — externally blocked (TASKS.md §4);
  the adapters are exercised for configuration errors only.
* Browser rendering of `dashboard.html` — the test asserts the file is
  self-contained HTML with the required sections.
