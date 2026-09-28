# RSI Agent — BEFORE (RUNNABLE_DEMO, baseline 7641230)

**Date:** 2026-09-28 (Asia/Jakarta)  
**Commit:** 7641230 (audit baseline)  
**Readiness:** `RUNNABLE_DEMO` · Production `NOT_READY`

## Runtime (mock only)

```bash
cd rsi-agent-recursive-self-improvement-prototype
python3 demo.py --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0
# → no provider boundary: MockPlanner + MockJev only, no RSI_PROVIDER env
python3 demo.py --improve --max-cycles 2 --auto-approve
python3 -m unittest discover -s tests -v # 142 tests
```

**What was proven:** Bounded loop `observe→propose→isolate→evaluate→decide→apply→verify→rollback` works offline, hash-chained `audit.jsonl`, `cycles.json`, `report.md`, `dashboard.html`. Cold 0% vs warm 0% (mock cannot learn).

**What was missing (P0 for MVP_PARTIAL):**

- No bounded LLM provider boundary: `MockProvider` only; no `RealLLMProvider` / `RSI_PROVIDER` / `RSI_MODEL` / `RSI_BASE_URL` / `RSI_API_KEY` fail-closed contract.
- No mandatory human gate for real provider; `--auto-approve` would apply even for real provider (unsafe).
- No provider-aware audit: `audit.jsonl` had no `provider`, `model`, `proposal_hash`, `verifier_result`, `jev_guard`, `approval_state`, `apply_state`, `revision`, `rollback` on every event.
- No explicit states `PROPOSED→VERIFIED→GUARD_PASSED→AWAITING_HUMAN_APPROVAL→APPROVED→APPLIED→VERIFIED_AFTER_APPLY` / `REJECTED`.
- Missing-secret path not fail-closed via provider boundary (only via `OPENAI_API_KEY` check in planner).
- Tests did not cover provider `missing_credentials`, `auth_failed`, `network_error` with stable codes and no secret leakage.
- `cli` and `demo` had no `RSI_PROVIDER` precedence over `--backend`.

Evidence: `runs/dashboard.html` dark #0f1117, `runs/report.md` 20+ lines, `runs/audit.jsonl` 22KB but without provider fields.
