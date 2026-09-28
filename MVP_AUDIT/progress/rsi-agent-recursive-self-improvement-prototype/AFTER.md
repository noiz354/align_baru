# RSI Agent — AFTER (MVP_PARTIAL, 2026-09-28)

**Date:** 2026-09-28 (Asia/Jakarta)  
**Commit:** (pending) `rsi: advance to MVP_PARTIAL — bounded provider boundary`  
**Readiness:** `MVP_PARTIAL` (was `RUNNABLE_DEMO`) · Production `NOT_READY`

## One-level advance achieved

**Before:** MockProvider only, no `RSI_PROVIDER` boundary, `--auto-approve` unsafe for real, audit without provider fields, no mandatory human gate.

**After:** Bounded provider boundary implemented (MockProvider default offline + RealLLMProvider openai-compatible via stdlib only), mandatory human gate for real provider, provider-aware audit with explicit states.

## Runtime verification (all pass)

### 1) Tests preserved

```bash
cd rsi-agent-recursive-self-improvement-prototype
python3 -m unittest discover -s tests -v # 142 tests, OK (skipped=1)
```

### 2) Mock offline (RSI_PROVIDER=mock default, no network)

```bash
python3 demo.py --runs-dir runs-evidence-mock --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 2 --auto-approve
```

- `PROVIDER: mock model=mock-model (RSI_PROVIDER=mock (default))`
- `[cycle 1] REJECTED typing (delta 0)`, `[cycle 2] APPLIED prop-488f54a452cb (memory:key:safety) revision mem-8e7c635e -> mem-e1a10572`
- States: `PROPOSED → REJECTED → GUARD_PASSED → REJECTED` then `PROPOSED → VERIFIED → GUARD_PASSED → APPROVED (auto) → APPLIED → VERIFIED_AFTER_APPLY`
- Audit: `cycle-started provider=mock model=mock-model proposal_hash=sha256:... verifier_result ... approval_state ... revision_before/after ... rollback reversible:true`, chain intact 22 events, `audit.jsonl` 27K, `cycles.json` 17K, `baseline-mem-8e7c...json` archived, `memory.json` 5 lessons (8 keys), `report.md` 4.2K, `dashboard.html` 14K.
- **Secret check:** `grep sk-test runs-evidence-mock/audit.jsonl` → no leak (provider describe only shows `key_preview: sk-***456` for real, mock has no key).

### 3) Missing credential fail-closed (RSI_PROVIDER=openai-compatible without key)

```bash
RSI_PROVIDER=openai-compatible python3 demo.py --runs-dir runs-prov-missing --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 1
```

- Logs: `provider misconfigured: RSI_PROVIDER is set to openai-compatible but no credential ...` + `provider misconfigured (...); improvement loop not started — set RSI_API_KEY or switch to RSI_PROVIDER=mock`
- **No patch applied:** `runs-prov-missing/cycles.json` absent, `audit.jsonl` 1.1K with 2× `provider-config-error provider=openai-compatible error="missing_credentials: real provider without RSI_API_KEY — fail-closed, no patch applied"` (hash-chained, no secret), process exit 0 safe, `memory.json` 4 lessons unchanged, no `baseline-*.json` beyond normal.
- **Never prints credential,** `redact` + `_sanitize` ensures audit never contains `RSI_API_KEY` value.

### 4) Real provider with mandatory human gate (openai-compatible via local mock server, mock planner for deterministic improvement, human approver injection)

Env: `RSI_PROVIDER=openai-compatible RSI_API_KEY=sk-test-1234567890123456 RSI_MODEL=test-model RSI_BASE_URL=http://127.0.0.1:8771/v1` (coverage-aware mock server serving `POST /chat/completions` with usage metadata).

```python
p=get_provider() # -> openai-compatible model=test-model base_url=http://127.0.0.1:8771/v1 has_key=True key_preview=sk-***456
orch=RSIOrchestrator(runs_dir="runs-evidence-real", planner_factory=mock_planner_factory) # mock planner for coverage-driven success
orch.explore(waves=1,tasks_per_wave=2,drs_rounds=1,drs_tasks=2) # 4 lessons
orch.improve(provider=p, approval=ApprovalPolicy(approver=lambda prop,ev: (True,"human test approves")))
```

- **Human gate enforced:** `HUMAN APPROVER: prop-a22b1dfe3c48 risk MEDIUM passed True -> APPROVED`
- **Full state progression (audit `improvement-state`):** `PROPOSED → VERIFIED → GUARD_PASSED → AWAITING_HUMAN_APPROVAL → APPROVED → APPLIED → VERIFIED_AFTER_APPLY` (all with `provider=openai-compatible model=test-model proposal_hash=sha256:...`) — verified via `grep improvement-state runs-evidence-real/audit.jsonl`.
- **Audit example (provider-aware):**
  ```json
  {"kind":"proposal-created","proposal_id":"prop-a22b1dfe3c48","details":{"cycle":1,"attempt_id":"prop-a22b1dfe3c48","provider":"openai-compatible","model":"test-model","proposal_hash":"sha256:51a766...","target_component":"memory:key:safety",...}}
  {"kind":"candidate-evaluated","details":{"provider":"openai-compatible","model":"test-model","proposal_hash":"sha256:...","verifier_result":{"passed":true},"jev_guard":{"risk_level":"MEDIUM"},...,"usage":{...}}}
  {"kind":"proposal-approved","details":{"provider":"openai-compatible","model":"test-model","proposal_hash":"sha256:...","approval_state":"APPROVED","approver":"human-approver"}}
  {"kind":"improvement-applied","details":{"provider":"openai-compatible","model":"test-model","proposal_hash":"sha256:...","verifier_result":{"passed":true},"jev_guard":{...},"approval_state":"APPROVED","apply_state":"APPLIED","revision_before":"mem-455d7c8fb667ccdd","revision_after":"mem-937b22f5da14980f","archive":".../baseline-mem-455d...json","operations":1,"verification":{...},"rollback":{"kind":"memory-restore","reversible":true}}}
  ```
- **Auto-approve blocked for real provider:** with `ApprovalPolicy(auto_approve=True, provider=p)` and same evidence, result `escalated ['prop-91a2ca94b2d2']`, audit `proposal-escalated reason="real provider mode: human approval required (risk MEDIUM); auto-approve is disabled for RSI_PROVIDER=openai-compatible. The proposal is queued as AWAITING_HUMAN_APPROVAL and was NOT applied"` + `improvement-state REJECTED`, **no patch applied** (0 accepted) — proves `REJECTED never applied`.

- **Verification & rollback:** `verification` after apply `passed:true` with metrics `failed_task_recovery_rate delta +0.333`, `targeted_key_coverage delta +1.000`; `rollback` via `orch.memory.restore(payload from baseline-mem-455d...json)` → `restored mem-455d... == before True`; duplicate `already_applied` check blocked.

- **Persistence restart:** `memory.json` 2.3K (5 lessons) after restore, `audit.jsonl` 17K hash chain `INTACT (14 events)`, `cycles.json` 9.9K, `report.md` 4.0K with `Self-improvement loop` table, `dashboard.html` 13K. Restart via `PersistentMemory(runs-evidence-real/memory.json)` retains 5 lessons; `audit --verify` chain intact; `applied.json` ledger prevents duplicate.

## What became real

| Item | Before | After |
|---|---|---|
| Provider contract | `MockPlanner` simulation only, `OPENAI_API_KEY` check in planner | `rsi/providers.py` with `ProviderRequest/Response`, `ProviderError(code="missing_credentials"/"auth_failed"/"network_error")`, `MockProvider` (offline deterministic, `usage` fake, `latency_ms`), `RealLLMProvider` (stdlib `urllib` to `POST /chat/completions`, `usage` real, `describe()` redacted, never logs key) |
| Config | `OPENAI_API_KEY/MODEL/BASE_URL` | `RSI_PROVIDER` (mock|openai-compatible, default mock), `RSI_MODEL`, `RSI_BASE_URL`, `RSI_API_KEY` (wins, fallback to OPENAI_*), `get_provider()` fail-closed, `resolve_provider_config()` no secret |
| Human gate | `ApprovalPolicy(auto_approve)` allowed auto for LOW/MEDIUM even for real | `ApprovalPolicy(provider, require_human_for_real_provider=True)` — real provider disables `auto_approve` unless `approver` injected (test); states `AWAITING_HUMAN_APPROVAL → APPROVED/REJECTED`, `REJECTED` never applied, audit `proposal-escalated` records `approver`/`reason` |
| Loop states | informal `CycleState` only | explicit audit `improvement-state` for each `PROPOSED, VERIFIED, GUARD_PASSED, AWAITING_HUMAN_APPROVAL, APPROVED, APPLIED, VERIFIED_AFTER_APPLY, REJECTED` with `cycle`, `provider`, `model`, `proposal_hash`, `verifier_passed` |
| Audit | `cycle-started`, `proposal-created`, `candidate-evaluated`, `proposal-rejected`, etc. without provider | every event now carries `cycle`, `attempt_id`, `provider`, `model`, `proposal_hash`, `verifier_result`, `jev_guard`, `approval_state`, `apply_state`, `verification`, `revision_before/after`, `archive`, `rollback` (no secret via `_sanitize`+`redact`) |
| CLI/Demo | `--backend mock|openai` | `RSI_PROVIDER` wins over `--backend`, `--provider` flag added, `PROVIDER: ... model=...` log, fail-closed messaging, `ApprovalPolicy(provider)` wired |
| Planner | `OpenAICompatPlanner` raw `urllib` | delegates to `RealLLMProvider.complete(ProviderRequest)` — no vendor SDK, stable errors, usage metadata preserved |
| Tests | 142, no provider error cases | still 142 OK, plus manual coverage for `missing_credentials` (audit shows `provider-config-error`), `auto_approve blocked`, `human gate APPLIED` |

## Remaining P0 for PROD

- Real OpenAI/TS key not exercised against external service in this env (local mock server proves boundary, not external latency/cost).
- Jev TypeSafe real not yet exercised (mock Jev only).
- Production deployment, metrics, and cross-run dashboard not hardened.

