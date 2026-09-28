# RSI Agent — CHANGES (RUNNABLE_DEMO → MVP_PARTIAL)

**Scope:** Bounded provider boundary, mandatory human gate for real provider, provider-aware audit. All changes are narrow, reversible, offline-safe.

## New file

- `rsi/providers.py` (412 lines): `ProviderError` (stable codes `missing_credentials`, `auth_failed`, `network_error`, `provider_error`, `rate_limited`, `config_error`), `ProviderRequest` (prompt/system/temperature/task_id/metadata), `ProviderResponse` (provider/model/content/usage/latency_ms/raw), `MockProvider` (deterministic, `usage` fake, `latency_ms`, `describe()`), `RealLLMProvider` (stdlib `urllib` POST `{base_url}/chat/completions`, `Authorization: Bearer` redacted in `__repr__`, maps HTTP 401/403→`auth_failed`, 429→`rate_limited` retryable, 5xx→`provider_error`, `URLError`→`network_error`, normalizes `usage` prompt/completion/total, never logs key), `get_provider(provider,model,api_key,base_url)` (aliases `mock=openai-compatible`, reads `RSI_PROVIDER`→`RSI_MODEL`→`RSI_BASE_URL`→`RSI_API_KEY` with fallback to `OPENAI_*`, default `mock`, `missing_credentials` fail-closed, never commits secret), `resolve_provider_config()` (no secret).

## Modified files

- `rsi/planners.py`: Import `providers`, `OpenAICompatPlanner.__init__` now resolves `RSI_MODEL/RSI_API_KEY/RSI_BASE_URL` (wins, fallback), accepts `provider` param, builds `RealLLMProvider` when key present (validates `missing_credentials` → `RuntimeError` for compat), `_chat()` delegates to `provider.complete(ProviderRequest)` (stable errors, usage metadata), fallback raw `urllib` only if provider absent; `openai_planner_factory` now respects `RSI_MODEL` override and lazy provider, `provider_planner_factory(provider_name)` unified entry.
- `rsi/improvement.py`: Import `providers`/`canonical_json`; `ApprovalPolicy` now `provider`/`require_human_for_real_provider`, `is_real_provider()` via `provider.is_mock()` or `RSI_PROVIDER` env, `request()` disables `auto_approve` for real unless `approver` injected (mandatory human gate, audit `AWAITING_HUMAN_APPROVAL`); `ImprovementLoop.__init__(provider)` resolves `provider` via `get_provider()` (mock default) or `RSI_PROVIDER` env, stores `self.provider`, patches `approval.provider`, handles `_provider_error` fail-closed; new helpers `_provider_info()`, `_proposal_hash()`, `_emit_state(proposal_id, state, cycle, extra)` (emits `improvement-state` with `provider/model/proposal_hash`); `_run_cycle_locked` enriched: `cycle-started` now `cycle,attempt_id,provider,model,proposal_hash`; `proposal-created` + `PROPOSED`; `candidate-evaluated` + `VERIFIED/REJECTED` with `verifier_result`, `jev_guard`; `GUARD_PASSED`; `AWAITING_HUMAN_APPROVAL` before every `approval.request`; `APPROVED` + `proposal-approved` audit; `improvement-applied` now `provider/model/proposal_hash/verifier_result/jev_guard/approval_state/apply_state/operations/revision_before/after/archive/verification/rollback`; `VERIFIED_AFTER_APPLY`; blocked `auto_approve` path emits `proposal-escalated` with `approval_state=AWAITING_HUMAN_APPROVAL`.
- `rsi/orchestrator.py`: `improve()` now `provider` param, resolves via `get_provider()` (fail-closed `provider-config-error` audit, safe return `[]`, no patch), wires `ApprovalPolicy(provider)`, passes `provider` to `ImprovementLoop`, logs `PROVIDER: ...`.
- `demo.py`: New `_resolve_planner_factory(args)` (precedence `--provider` > `RSI_PROVIDER` > `--backend`), `get_provider` fail-closed with `exit 2` for explicit real without key, `PROVIDER: ...` log, `--provider` flag added, `ApprovalPolicy(provider)` for both `explore` and `improve`, auto-approve note for real.
- `rsi/cli.py`: New `RSI_PROVIDER` precedence (`_resolve_provider_name`, `_resolve_provider`), `--provider` flag, `PROVIDER: ...` log in `_orchestrator`, `_approval(args, provider)` respects real gate, `cmd_run`/`cmd_improve` pass `provider` to `orchestrator.improve`, `build_parser` updated with provider help.
- `rsi/memory.py`: imported `canonical_json` for proposal hash (already existed, just imported).

## Audit & evidence now includes

- Every `audit.jsonl` event carries `provider`, `model`, `proposal_hash` (sha256 of `change_set.to_dict()`), plus `verifier_result`, `jev_guard`, `approval_state`, `apply_state`, `verification`, `revision_before/after`, `archive`, `rollback` where applicable.
- Explicit states `PROPOSED→VERIFIED→GUARD_PASSED→AWAITING_HUMAN_APPROVAL→APPROVED→APPLIED→VERIFIED_AFTER_APPLY` and `REJECTED` as `improvement-state` events (hash-chained).

## Tests & runtime

- Tests: `142 OK (skipped=1)` preserved; new manual checks for `missing_credentials` via audit, `auto_approve` blocked for real, `human gate APPLIED` via `mock_planner + real provider` path.
- Runtime: Mock offline `runs-evidence-mock` (applied safety), missing secret `runs-prov-missing` (fail-closed 2× `provider-config-error`, no leak, exit 0), real `runs-evidence-real` (14 events chain intact, `APPLIED` with human, rollback `restore True`, no secret).

## Limits & rollback still enforced

- `ImprovementLimits` unchanged, `CandidateWorkspace`, `SandboxLimits`, `verify_applied` rollback, `applied.json` ledger, `LoopLock`, `canonical_json` hash chain all preserved.
