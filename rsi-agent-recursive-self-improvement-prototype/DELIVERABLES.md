# Prototype deliverable register (audited 2026-09-27)

This is a traceability register for the *declared offline prototype* in README.md and AGENTS.md, **not** a new product backlog. `DONE` refers to the simulation and its documented boundaries; it does not certify safe autonomous edits to arbitrary real repositories.

| ID | Declared deliverable | Implementation | Verification | State |
|---|---|---|---|---|
| P-01 | Broad exploration then weak-key deep exploration | `rsi/curriculum.py`, `rsi/orchestrator.py` | `tests/test_rsi.py::OrchestratorTests.test_warm_beats_cold_on_holdout` | VERIFIED_DONE |
| P-02 | Actor ReAct execution with bounded steps | `rsi/actor.py`, `rsi/harness.py` | `HarnessTests.test_react_loop_terminates_with_finish`, `test_exhausted_step_budget_cannot_report_success` | VERIFIED_DONE |
| P-03 | Independent verification from checks and typed Jev verdict | `rsi/verifier.py`, `rsi/jev.py` | `test_done_requires_all_checks` | VERIFIED_DONE (mock judge) |
| P-04 | Verified memory, freeze, archival on fresh run | `rsi/memory.py`, `rsi/orchestrator.py` | `test_freeze_blocks_writes`, `test_roundtrip_and_coverage`, `test_fresh_run_archives_stale_memory` | VERIFIED_DONE |
| P-05 | Identical holdout cold vs warm, no parameter change | `rsi/orchestrator.py` | `test_warm_beats_cold_on_holdout` | VERIFIED_DONE (offline simulation) |
| P-06 | Typed guardrail and human escalation | `rsi/routing.py`, `rsi/jev.py` | `test_guardrail_flags_prompt_injection`, `test_injection_task_escalates` | VERIFIED_DONE (mock judge) |
| P-07 | Reproducible run artifacts | `demo.py`, `rsi/orchestrator.py::report` | `python3 demo.py --waves 1 --drs-rounds 1 --holdout 4` | IMPLEMENTED_BUT_UNVERIFIED (artifact schema not separately tested) |

**Not declared as prototype deliverables:** isolated candidate repositories, a production baseline/candidate accept-and-apply pipeline, rollback of real code, or an OS sandbox. README.md explicitly describes the coding environment, planner and judge as **simulations**. Never extrapolate the mock cold/warm improvement to a real coding agent. Real provider credentials are optional environment configuration; tests exercise mocks only.
