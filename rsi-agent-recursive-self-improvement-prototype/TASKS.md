# TASKS.md — Implementation Task Register

> 2026-09-27 · Status: **ALL ACTIONABLE TASKS IMPLEMENTED** · Slice plan: ROADMAP.md ·
> Requirement mapping: TRACEABILITY.md · Decisions: README.md §Catatan desain

This register covers every task that can be executed from the repository and the
available environment. The two remaining items are **externally blocked**: they
need credentials for third-party services that are intentionally absent from
this repository (see §4).

An agent picking up work here reads the entry, the module it names, and the test
file that proves it. IDs are permanent: never renumber, never reuse.

## 1. ID conventions

`T-<AREA>-<NNN>` where AREA ∈ {RSI, MEM, JEV, CURR, ACT, VER, TOOL, HARN, ORCH,
PROP, RISK, SBOX, PATCH, EVAL, IMP, AUD, MET, BENCH, DASH, SKILL, RAO, CLI, DOC}.

## 2. Task register

### 2.1 Core RSI loop (pre-existing, verified)

| ID | Task | Module | Status |
|---|---|---|---|
| T-RSI-001 | BRS broad exploration from a shared starting memory | `rsi/curriculum.py`, `rsi/orchestrator.py` | DONE |
| T-RSI-002 | DRS deep exploration targeting weak knowledge keys | `rsi/curriculum.py`, `rsi/orchestrator.py` | DONE |
| T-RSI-003 | Freeze memory at the exploration/test-time boundary | `rsi/memory.py` | DONE |
| T-RSI-004 | Test-time cold vs warm evaluation on an identical holdout | `rsi/orchestrator.py` | DONE |
| T-RSI-005 | Lesson extraction from verified execution outcomes | `rsi/verifier.py` | DONE |
| T-RSI-006 | ReAct harness with step budget and pluggable planner | `rsi/harness.py` | DONE |
| T-RSI-007 | Actor runs a task via harness + routing decision | `rsi/actor.py` | DONE |
| T-RSI-008 | Jev typed surface (Choice / Score / Noul) + deterministic mock | `rsi/jev.py` | DONE |
| T-RSI-009 | Guardrail + routing orchestration layer | `rsi/routing.py` | DONE |
| T-RSI-010 | Prompt-injection escalation to a human workflow | `rsi/routing.py`, `rsi/jev.py` | DONE |

### 2.2 Proposal engine

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-PROP-001 | `ImprovementProposal` model with hypothesis, benefit, risk, change set, evaluation plan, rollback plan, status | `rsi/proposals.py` | `test_improvement.ProposalTests` | DONE |
| T-PROP-002 | Evidence-based generator: only observed, uncovered, holdout-relevant keys | `rsi/proposals.py` | `test_improvement.ProposalTests` | DONE |
| T-PROP-003 | Deterministic proposal ids (idempotent re-runs) | `rsi/proposals.py` | `test_proposal_ids_are_deterministic` | DONE |
| T-PROP-004 | Reject vague, unmeasurable tasks ("make yourself smarter") | `rsi/proposals.py` | `test_vague_tasks_are_rejected_by_the_generator` | DONE |
| T-PROP-005 | Feedback ingestion with a DATA / INSTRUCTIONS split | `rsi/feedback.py` | `test_adversarial.PromptInjectionTests` | DONE |
| T-PROP-006 | Quarantine hazard-marked, secret-bearing and unknown-source feedback | `rsi/feedback.py` | `test_adversarial.PromptInjectionTests` | DONE |
| T-PROP-007 | A machine signal cannot mint human approval | `rsi/feedback.py` | `test_machine_signal_cannot_mint_human_approval` | DONE |

### 2.3 Risk model and human gates

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-RISK-001 | LOW / MEDIUM / HIGH / CRITICAL classification from change shape | `rsi/risk.py` | `test_improvement.RiskTests` | DONE |
| T-RISK-002 | Restricted scopes (evaluator, sandbox, audit, deployment, dependencies, credentials, permissions) | `rsi/risk.py` | `test_adversarial.RestrictedScopeTests` | DONE |
| T-RISK-003 | Protected-path classification (`rsi/`, `tests/`, `.github/`, `SECURITY.md`, `pyproject.toml`, …) | `rsi/risk.py` | `test_safety_config_is_protected` | DONE |
| T-RISK-004 | Self-editable allow-list (`SKILL.md`, `CLAUDE.md` only) | `rsi/risk.py` | `test_skill_files_are_self_editable` | DONE |
| T-RISK-005 | HIGH/CRITICAL never auto-accepted, even with passing benchmarks | `rsi/improvement.py` | `test_auto_approve_never_covers_high_risk` | DONE |
| T-RISK-006 | Configurable auto-accept ceiling (`RiskPolicy`) | `rsi/risk.py` | `test_risk_policy_auto_accept_ceiling` | DONE |
| T-RISK-007 | Human approver callback with approve/decline and approver identity | `rsi/improvement.py` | `test_human_approver_can_approve_and_decline` | DONE |

### 2.4 Candidate isolation and sandbox

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-SBOX-001 | `CandidateWorkspace` temporary, disposable, budgeted | `rsi/sandbox.py` | `test_improvement.SandboxTests` | DONE |
| T-SBOX-002 | Path containment: no absolute paths, no `..`, no NUL, no symlink escape | `rsi/sandbox.py` | `test_adversarial.SandboxEscapeTests` | DONE |
| T-SBOX-003 | File-count / per-file-byte / total-byte budgets | `rsi/sandbox.py` | `test_file_and_byte_budgets_are_enforced` | DONE |
| T-SBOX-004 | Diff-line budget | `rsi/sandbox.py`, `rsi/patches.py` | `test_diff_budget_is_enforced` | DONE |
| T-SBOX-005 | Secret scanning on every byte entering a candidate, a patch, a log, a benchmark, a skill file | `rsi/sandbox.py` | `test_secret_smuggling_is_refused`, `test_audit_records_refuse_secrets` | DONE |
| T-SBOX-006 | Secret detection must not fire on legitimate prose | `rsi/sandbox.py` | `test_prose_mentioning_tokens_is_allowed` | DONE |
| T-SBOX-007 | Baseline is never mutated to "see what happens" | `rsi/improvement.py` | `test_rejected_candidate_never_mutates_the_baseline` | DONE |

### 2.5 Patch model and revision checks

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-PATCH-001 | `LessonChangeSet` (add / replace / retire) with reason and proposal id | `rsi/patches.py` | `test_improvement.PatchTests` | DONE |
| T-PATCH-002 | `FilePatch` / `FileChangeSet` with unified diff | `rsi/patches.py` | `test_change_set_diff_is_inspectable` | DONE |
| T-PATCH-003 | Content-hash base revision; stale candidates refused | `rsi/patches.py`, `rsi/memory.py` | `test_stale_base_revision_is_refused` | DONE |
| T-PATCH-004 | Structural validation (verified, non-empty, keyed, in-range, deduped) | `rsi/patches.py` | `test_unverified_lesson_is_refused` | DONE |
| T-PATCH-005 | Operation and diff budgets | `rsi/patches.py` | `test_adversarial.ResourceLimitTests` | DONE |

### 2.6 Evaluation engine

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-EVAL-001 | Multi-metric evaluation: recovery rate, success rate, avg score, escalation rate, targeted coverage, memory size | `rsi/evaluator.py` | `test_improvement.ImprovementLoopTests` | DONE |
| T-EVAL-002 | Mandatory structural checks (change-set-valid, tamper-scan, benchmark pinning) | `rsi/evaluator.py` | `test_tamper_findings_block_acceptance` | DONE |
| T-EVAL-003 | Baseline vs candidate on identical holdout tasks with identical actor assignment | `rsi/orchestrator.py` | `test_steps_04_to_07_…` | DONE |
| T-EVAL-004 | Explicit acceptance policy (target improvement + no critical regression + risk ceiling) | `rsi/evaluator.py` | `test_tamper_findings_block_acceptance` | DONE |
| T-EVAL-005 | Tamper / overfitting detector (rules R1–R8) | `rsi/evaluator.py` | `test_adversarial.EvaluationTamperTests` | DONE |
| T-EVAL-006 | Post-apply verification independent of the candidate evaluation | `rsi/evaluator.py` | `test_post_apply_verification_failure_triggers_rollback` | DONE |
| T-EVAL-007 | Evaluation limits (wall clock, holdout size, lessons, diff) | `rsi/evaluator.py` | `test_wall_clock_budget_stops_the_loop` | DONE |

### 2.7 Improvement loop

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-IMP-001 | Bounded loop: OBSERVE → PROPOSE → ISOLATE → EVALUATE → DECIDE → APPLY → VERIFY → ROLLBACK → RECORD | `rsi/improvement.py` | `test_cycle_runs_the_full_state_sequence` | DONE |
| T-IMP-002 | Iteration limits (cycles, proposals, candidates, lessons, diff, wall clock, tool calls) | `rsi/improvement.py` | `test_iteration_limit_caps_proposals_per_cycle`, `test_max_cycles_is_respected` | DONE |
| T-IMP-003 | Stagnation detection and stop | `rsi/improvement.py` | `test_stagnation_stops_the_loop` | DONE |
| T-IMP-004 | Cross-process concurrency lock | `rsi/improvement.py` | `test_concurrency_lock_serialises_cycles` | DONE |
| T-IMP-005 | Idempotent proposal application (duplicate proposals blocked) | `rsi/improvement.py` | `test_duplicate_proposals_are_not_re_applied` | DONE |
| T-IMP-006 | Baseline archived before apply | `rsi/improvement.py` | `test_baseline_is_archived_before_apply` | DONE |
| T-IMP-007 | Automatic rollback on failed post-apply verification | `rsi/improvement.py` | `test_post_apply_verification_failure_triggers_rollback` | DONE |
| T-IMP-008 | Frozen memory blocks the loop | `rsi/improvement.py` | `test_frozen_memory_blocks_the_loop` | DONE |
| T-IMP-009 | Cumulative cycle history across processes | `rsi/improvement.py` | `test_artifacts.CliTests` | DONE |

### 2.8 Audit and observability

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-AUD-001 | Append-only, hash-chained audit log | `rsi/audit.py` | `test_adversarial.AuditTamperTests` | DONE |
| T-AUD-002 | Chain verification detects deletion and mutation | `rsi/audit.py` | `test_deleting_an_audit_record_breaks_the_chain` | DONE |
| T-AUD-003 | Secrets refused in audit records | `rsi/audit.py` | `test_audit_records_refuse_secrets` | DONE |
| T-AUD-004 | Corrupt lines flagged rather than silently dropped | `rsi/audit.py` | `test_unparseable_record_is_flagged` | DONE |
| T-MET-001 | Loop-health metrics (acceptance / regression / rollback / stagnation rates, durations, deltas) | `rsi/metrics.py` | `test_improvement.LoopHealthTests` | DONE |
| T-MET-002 | Loop-health section in the run report | `rsi/orchestrator.py` | `test_report_and_dashboard_render_after_a_cycle` | DONE |
| T-MET-003 | `rsi status` one-screen state | `rsi/cli.py` | `test_status_and_audit_after_a_run` | DONE |

### 2.9 Benchmark, dashboard, skills, RAO (README Roadmap 1–4)

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-BENCH-001 | `BenchmarkConfig` / `BenchmarkSnapshot` with environment fingerprint | `rsi/benchmark.py` | `test_snapshot_records_environment_and_config` | DONE |
| T-BENCH-002 | Reproducible runs per seed | `rsi/benchmark.py` | `test_same_seed_is_reproducible` | DONE |
| T-BENCH-003 | Cross-arm comparison, refusing incomparable environments | `rsi/benchmark.py` | `test_incomparable_environments_are_refused` | DONE |
| T-BENCH-004 | Experiment matrix command | `rsi/benchmark.py`, `rsi/cli.py` | `test_matrix_runs_every_arm_and_renders`, `test_benchmark_quick_matrix` | DONE |
| T-DASH-001 | Self-contained HTML dashboard over `runs/` | `rsi/dashboard.py` | `test_dashboard_is_self_contained_html` | DONE |
| T-DASH-002 | Baseline, loop health, proposals, evaluations, rollback, benchmarks, history, audit views | `rsi/dashboard.py` | `test_dashboard_data_reads_the_artifacts` | DONE |
| T-DASH-003 | Broken-chain and tamper findings surfaced | `rsi/dashboard.py` | `test_dashboard_flags_a_broken_audit_chain` | DONE |
| T-SKILL-001 | Memory → `SKILL.md` (front matter, grouped by knowledge key, confidence-ordered) | `rsi/skills.py` | `test_only_verified_active_lessons_are_exported` | DONE |
| T-SKILL-002 | Memory → `CLAUDE.md` fragment | `rsi/skills.py` | `test_claude_fragment_points_at_the_skill_file` | DONE |
| T-SKILL-003 | Deprecated lessons excluded from the export | `rsi/skills.py` | `test_deprecated_lessons_are_excluded` | DONE |
| T-SKILL-004 | Previous file archived; export is idempotent; secrets refused | `rsi/skills.py` | `test_export_archives_the_previous_file`, `test_export_refuses_a_secret_shaped_lesson` | DONE |
| T-RAO-001 | Self-assessment of the run report (Jev Score + Noul) | `rsi/rao.py` | `test_assessment_reports_a_real_delta` | DONE |
| T-RAO-002 | Skill-file rewrite proposal restricted to `SKILL.md` / `CLAUDE.md` | `rsi/rao.py` | `test_rao_cannot_target_project_code` | DONE |
| T-RAO-003 | Human gate for anything above the risk ceiling | `rsi/rao.py` | `test_high_risk_rewrite_is_escalated_not_applied` | DONE |
| T-RAO-004 | Post-write verification and rollback | `rsi/rao.py` | `test_rollback_restores_the_archived_files` | DONE |

### 2.10 CLI and integration

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-CLI-001 | `run`, `improve`, `benchmark`, `dashboard`, `skills`, `rao`, `audit`, `status` | `rsi/cli.py` | `test_parser_exposes_every_command` | DONE |
| T-CLI-002 | `demo.py` wires the improvement loop, audit check and dashboard | `demo.py` | `test_full_run_creates_every_artifact` | DONE |
| T-CLI-003 | `improve` resumes rather than discards the existing memory | `rsi/cli.py` | `test_improve_requires_an_existing_memory` | DONE |
| T-CLI-004 | `runs/attempts.jsonl` merged, not truncated, by a resumed run | `rsi/orchestrator.py` | `test_status_and_audit_after_a_run` | DONE |

### 2.11 Memory policy and versioning

| ID | Task | Module | Tests | Status |
|---|---|---|---|---|
| T-MEM-001 | Revision / snapshot / restore / clone | `rsi/memory.py` | `test_snapshot_survives_a_json_roundtrip` | DONE |
| T-MEM-002 | Lesson versioning, `superseded_by`, soft deprecation | `rsi/types.py`, `rsi/memory.py` | `test_apply_add_replace_retire_roundtrip` | DONE |
| T-MEM-003 | Deprecated lessons leave the read path | `rsi/memory.py` | `test_deprecated_lessons_leave_the_read_path` | DONE |
| T-MEM-004 | Freeze blocks writes, including patch application | `rsi/memory.py` | `test_frozen_memory_refuses_patches` | DONE |
| T-MEM-005 | `weak_keys` honours a `min_coverage` threshold above 1 | `rsi/memory.py` | `test_weak_keys_respects_min_coverage` | DONE |

## 3. Test inventory

`python3 -m unittest discover -s tests -v` — **137 tests, all offline, stdlib only.**

| File | Tests | Focus |
|---|---|---|
| `tests/test_rsi.py` | 10 | original loop: freeze, memory roundtrip, MockJev determinism, guardrail, routing, ReAct termination, warm-beats-cold, stale-memory archive |
| `tests/test_improvement.py` | 48 | proposals, sandbox, patches, risk, the loop, limits, stagnation, memory policy, loop health |
| `tests/test_adversarial.py` | 36 | test/benchmark/evaluator tampering, sandbox escape, secret smuggling, audit tampering, restricted scopes, prompt injection, resource limits |
| `tests/test_artifacts.py` | 34 | benchmark, skills, RAO, dashboard, CLI |
| `tests/test_manual_qa.py` | 9 | the full 14-step manual-QA walkthrough, end to end |

## 4. Externally blocked tasks

### T-EXT-001 — Real Jev (TypeSafe) decision semantics

* **Task ID:** T-RSI-008 (semantics), T-RAO-001 (production judge)
* **Reason:** `TypeSafeJev` is a complete HTTP adapter, but the TypeSafe decision
  API's published request/response shape is not available in this repository and
  no `TYPESAFE_API_KEY` exists in the environment.
* **External dependency:** TypeSafe API credentials + endpoint contract.
* **Current boundary:** the adapter raises a clear error when the key is absent;
  every offline path uses `MockJev`, which is a pure function of `question.state`.
* **Stub location:** `rsi/jev.py::TypeSafeJev._ask` (adapter, not a stub — it is
  a real HTTP call whose payload shape is marked illustrative).
* **Security implications:** the key is read from the environment only and never
  written to any artifact.
* **Evaluation implications:** acceptance decisions are reproducible offline.
* **Unblock action:** set `TYPESAFE_API_KEY` (and `TYPESAFE_API_URL` if needed),
  then align the `_ask` payload with the published contract and re-run
  `python3 -m unittest discover -s tests`.

### T-EXT-002 — Real LLM actor backend

* **Task ID:** T-RSI-007 (production executor)
* **Reason:** `OpenAICompatPlanner` is a complete OpenAI-compatible client, but
  no `OPENAI_API_KEY` is present in this environment, and a real backend would
  make runs non-deterministic and non-free.
* **External dependency:** an OpenAI-compatible endpoint and key.
* **Current boundary:** `MockPlanner` simulates the coding environment with an
  explicit, documented success model; `demo.py --backend openai` selects the real
  planner without any code change.
* **Stub location:** none — `rsi/planners.py::OpenAICompatPlanner` is real.
* **Security implications:** the key is read from the environment only; prompts
  never carry credentials.
* **Evaluation implications:** benchmarks remain reproducible because the mock
  is deterministic per seed.
* **Unblock action:** export `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`,
  `OPENAI_MODEL`) and run `python3 demo.py --backend openai`.

## 5. Explicitly out of scope (by design, not by omission)

* Training or fine-tuning model parameters — the prototype is training-free by
  design (README).
* Autonomous production deployment, permission escalation, credential handling.
* Distributed infrastructure (message buses, containers, service mesh) — the
  prototype is a single stdlib process.
