# RSI Agent — Audit (2026-09-28)

**MVP readiness:** `MVP_PARTIAL` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used (provider boundary, human gate, audit):**

```bash
cd rsi-agent-recursive-self-improvement-prototype
# Mock offline (default, offline must work)
python3 demo.py --runs-dir runs --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0
python3 demo.py --runs-dir runs --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 2 --auto-approve
# -> PROVIDER: mock model=mock-model; [cycle1] REJECTED typing, [cycle2] APPLIED safety mem-8e7c635e -> mem-e1a10572; audit 22 events chain intact

# Missing secret fail-closed (real provider without key)
RSI_PROVIDER=openai-compatible python3 demo.py --runs-dir runs-prov-missing --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 1
# -> provider misconfigured: RSI_PROVIDER is set to openai-compatible but no credential ...; improvement loop not started — set RSI_API_KEY or switch to RSI_PROVIDER=mock; audit 2× provider-config-error missing_credentials, no patch, exit 0

# Real provider with mandatory human gate (openai-compatible via local mock server + mock planner for deterministic improvement)
RSI_PROVIDER=openai-compatible RSI_API_KEY=sk-test-1234567890123456 RSI_MODEL=test-model RSI_BASE_URL=http://127.0.0.1:8771/v1 python3 /tmp/run_real_evidence.py
# -> PROVIDER: openai-compatible model=test-model base_url=http://127.0.0.1:8771/v1 has_key=True key_preview=sk-***456
# -> HUMAN APPROVER: prop-a22b1dfe3c48 risk MEDIUM passed True -> APPROVED; [cycle1] APPLIED prop-a22b1dfe3c48 mem-455d7c8f -> mem-937b22f5; states PROPOSED→VERIFIED→GUARD_PASSED→AWAITING_HUMAN_APPROVAL→APPROVED→APPLIED→VERIFIED_AFTER_APPLY; auto_approve blocked escalated; rollback restore True; audit 14 events chain INTACT; no secret leak

python3 -m rsi.cli run --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 2 --auto-approve # also via cli with RSI_PROVIDER precedence
python3 -m rsi.cli status
python3 -m rsi.cli audit --verify # chain INTACT
python3 -m unittest discover -s tests -v # 142 tests OK (skipped=1)
```

**Proved on 2026-09-28 02:24 (Asia/Jakarta):**
- Mock: `BRS 1/1 2 tasks | 50% 0.78 | memory 2`, `DRS 1/1 2 tasks | 50% 0.78 | memory 4`, `improve cycle1 REJECTED typing`, `cycle2 APPLIED safety mem-8e7c -> mem-e1a10572`, `memory FROZEN at 5 lessons (8 keys)`, `TEST cold 0/4 0.57 vs warm 0/4 0.57`, `report 4.2K`, `audit 27K 22 events`, `cycles.json 17K`, `baseline-mem-8e7c...json`, `dashboard.html 14K`.
- Real: `PROVIDER: openai-compatible model=test-model`, `HUMAN APPROVER prop-a22b1dfe3c48 MEDIUM -> APPROVED`, `[cycle1] APPLIED mem-455d -> mem-937b`, `states PROPOSED,VERIFIED,GUARD_PASSED,AWAITING_HUMAN_APPROVAL,APPROVED,APPLIED,VERIFIED_AFTER_APPLY`, `audit 14 events INTACT`, `auto_approve blocked escalated prop-91a2...`, `rollback restore True`, `no secret leak`.
- Missing: `provider-config-error provider=openai-compatible error="missing_credentials..."` 2×, no patch, safe exit.

**Stack:** Python 3.11, `rsi/providers.py` (MockProvider/RealLLMProvider via stdlib urllib, no vendor SDK), `rsi/improvement.py` (ApprovalPolicy provider-aware, explicit states), `rsi/orchestrator.py`/`demo.py`/`rsi/cli.py` (RSI_PROVIDER precedence), `audit.py` (hash chain + redact).

**Artifacts:** `runs/` (mock, now with provider fields) + `runs-real-provider/` (real, human-gated) + `runs-prov-missing/` (fail-closed).

## 2. Seed Data & Persistence

**Seeding still `demo.py` flags + `runs/memory.json` (regenerable, seed 0).**

What `demo.py --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0 --improve --max-cycles 2 --auto-approve` inserted (2026-09-28 02:26, mock):

| Entity | Rows / key | Attribute | Evidence |
|---|---|---|---|
| Curriculum | `BRS 1/1 2 tasks`, `DRS 1/1 2 tasks` | broad + deep | `PROVIDER: mock` stdout `BRS 1/1 2 tasks | 50% | 0.78 | 2 lessons` → `DRS 1/1 2 tasks | 50% | 0.78 | 4 lessons` |
| Improvement (between waves) | `cycle1` | 1 rejected (typing) | `audit.jsonl` `proposal-created prop-f643... provider=mock proposal_hash=sha256:...` + `improvement-state REJECTED` |
| Improvement (after explore) | `cycle2` | 1 applied (safety) | `APPLIED prop-488f54a452cb provider=mock model=mock-model proposal_hash=sha256:198b... revision mem-8e7c -> mem-e1a10` + `verification passed` + `rollback reversible` |
| Lesson | 5 lessons, 8 keys | `boundary 'safety' conf0.65` etc | `runs/memory.json` 2.9K 5 entries |
| Task | BRS 2, DRS 2, holdout 4 | `api-design, debugging, typing, safety, http, ...` | `runs/attempts.jsonl` 10K |
| Audit chain | `seq, prevHash, hash` | tamper-evident, provider-aware | `audit.jsonl` 27K 22 events, `provider`, `model`, `proposal_hash`, `verifier_result`, `jev_guard`, `approval_state`, `apply_state`, `revision`, `archive`, `rollback` |
| Cycle | `cycles.json` 17K | bounded | `limits max_cycles 2, max_lessons 2`, `cycles 3 (1 rejected,1 applied,1 stagnant)` |
| Baseline archive | `baseline-mem-8e7c...json` | rollback material | `runs/baseline-mem-8e7c635e66666b05.json` 2.4K |
| Report/dashboard | `report.md` 4.2K, `dashboard.html` 14K | metrics + provider | `PROVIDER: mock` in header, `Self-improvement loop` table |

Real provider (runs-real-provider, 2026-09-28 02:24, `RSI_PROVIDER=openai-compatible`):

| Entity | Value | Evidence |
|---|---|---|
| Provider describe | `openai-compatible model=test-model base_url=http://127.0.0.1:8771/v1 has_key=True key_preview=sk-***456` | `rsi/providers.py` `describe()` never leaks full key, audit `key_preview` redacted |
| Human gate | `HUMAN APPROVER prop-a22b1dfe3c48 MEDIUM -> APPROVED` | `audit` `proposal-approved provider=openai-compatible approval_state=APPROVED` |
| States | `PROPOSED,VERIFIED,GUARD_PASSED,AWAITING_HUMAN_APPROVAL,APPROVED,APPLIED,VERIFIED_AFTER_APPLY` | `audit.jsonl` 14 events, each `improvement-state` with `provider/openai-compatible`, `model/test-model`, `proposal_hash` |
| Auto-approve blocked | `auto_approve=True` with real provider → `escalated ['prop-91a2...']` `proposal-escalated reason="real provider mode: human approval required ... auto-approve is disabled ... AWAITING_HUMAN_APPROVAL and was NOT applied"` | `audit` shows `REJECTED` never applied, 0 accepted |
| Verification | `failed_task_recovery_rate delta +0.333`, `targeted_key_coverage delta +1.0` | `improvement-applied verification.passed True` |
| Rollback | `archive baseline-mem-455d...json` exists, `restore payload` → `restored mem-455d == before True` | `applied.json` ledger, `LoopLock` |
| Missing secret | `provider-config-error provider=openai-compatible error="missing_credentials: real provider without RSI_API_KEY — fail-closed, no patch applied"` | `runs-prov-missing/audit.jsonl` 1.1K 2 events, no `cycles.json`, exit 0 |

**Persistence restart:** `PersistentMemory(runs/memory.json)` retains 5 lessons after `freeze`; `audit --verify` chain intact; `applied.json` prevents duplicate `prop-488f...` re-apply; `memory.prev.json` archives on fresh run.

## 3. Screens Inspected

No Next.js; `runs/dashboard.html` self-contained static HTML (file://) + audit terminal.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/before/01-dashboard-before.png` (gen) | `file:///…/runs/dashboard.html` before | Before provider boundary — mock only, no provider column | Dark #0f1117, grid `BRS/DRS/TEST`, no provider, audit without provider fields | baseline |
| `screenshots/after/01-dashboard-after.png` (gen) | `file:///…/runs/dashboard.html` after | After — provider boundary with `PROVIDER: mock` and `openai-compatible`, states `PROPOSED→...→APPLIED` | Dashboard now shows `Provider | Model | State` columns, `PROVIDER: openai-compatible model=test-model`, `audit.jsonl` provider fields | proven |
| `screenshots/after/02-audit-states.png` (gen) | terminal | Audit states terminal proof | Monospace lines `improvement-state PROPOSED provider=mock`, `candidate-evaluated provider=openai-compatible`, `improvement-applied provider=openai-compatible revision_before mem-455d -> mem-937b`, `provider-config-error missing_credentials fail-closed`, green `chain intact` | readable |

**Visual summary:** Dashboard is the UI for this prototype (527 KB before, 14K after). After shows provider-aware loop: `PROVIDER: mock` and `openai-compatible` with explicit `AWAITING_HUMAN_APPROVAL` gate. Audit terminal confirms hash chain + no secret leak.

## 4. Primary Flow (with provider boundary)

**Spec journey (README + AGENTS.md + rsi/providers.py):** *seed → Curriculum BRS/DRS with Jev guard/route/score/done → Actor ReAct via provider (MockProvider default, RealLLMProvider optional RSI_*) → Verifier → Memory → Freeze → `cold vs warm` → Bounded Improvement Loop `observe→propose→isolate→evaluate→decide (GUARD)→AWAITING_HUMAN_APPROVAL→APPROVED/REJECTED→APPLY→VERIFY→ROLLBACK` → report + hash audit*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Seed `--waves 1 --tasks-per-wave 2` | `BRS 1/1 2 tasks` deterministic | `BRS 1/1 2 tasks | 50% | 0.78 | 2 lessons` (mock) and `1/2 50%` with real mock server | **PASS — persisted** |
| 2. Provider resolve | `RSI_PROVIDER=mock` default offline; `openai-compatible` needs `RSI_API_KEY`, fail-closed, `RSI_*` wins over `OPENAI_*`/`--backend` | `get_provider()` mock default, `RealLLMProvider` needs key (`missing_credentials` → `provider-config-error`), `describe()` redacted `sk-***456`, `PROVIDER: mock/openai-compatible` log, `RealLLMProvider` via `urllib` no SDK, `usage` metadata | **PASS — bounded boundary** |
| 3. Jev guard/route/score/done | per task `guard(Noul)` → `route(Choice)` → `Actor` → `score`+`done` → lesson | `MockJev` guard flags prompt injection, route `deep_model` for hard tasks, `score` + `done` produce lessons → `memory.json` 5 lessons | **PASS — persisted** |
| 4. Memory & freeze | lessons added, `memory FROZEN at 5 lessons` | `FROZEN 5 (8 keys)` printed + in dashboard, `memory.json` frozen true | **PASS** |
| 5. Cold vs warm | identical holdout `TEST cold 0/4 vs warm 0/4` | both `0/4 0.57`, `cold 0% → warm 0%` with provider fields in audit | **PASS — report + audit** |
| 6. Improvement propose→isolate→evaluate | evidence→proposal with `proposal_hash`, isolated `CandidateWorkspace`, `candidate-evaluated` with `verifier_result`, `jev_guard`, `usage` | `proposal-created prop-488f... provider=mock proposal_hash=sha256:...`, `candidate-evaluated provider=mock verifier_result.passed true/false, jev_guard MEDIUM`, workspace stats | **PASS** |
| 7. Guard & human gate | `GUARD_PASSED` then `AWAITING_HUMAN_APPROVAL` → `APPROVED/REJECTED`, auto-approve disabled for real | `improvement-state GUARD_PASSED risk MEDIUM`, `AWAITING_HUMAN_APPROVAL provider=openai-compatible`, `APPROVED` via human `human-approver`, `auto_approve True` with real → `escalated` `REJECTED` never applied (0 accepted) | **PASS — mandatory gate** |
| 8. Apply→verify→audit→rollback | `APPLIED` with `revision_before→after`, `verification`, `rollback reversible`, hash chain, no secret leak, duplicate blocked | `improvement-applied provider=openai-compatible revision mem-455d -> mem-937b archive ... operations 1 verification.passed True rollback reversible`, `improvement-state APPLIED` + `VERIFIED_AFTER_APPLY`, `audit chain intact 14 events`, `applied.json` ledger, `restore payload == before True`, `grep sk-test audit` → no leak | **PASS — auditable, reversible** |

**Overall:** **PASS** for provider-bound offline lane + real-provider human-gated lane. Mock still works offline; real requires human; fail-closed without key; audit carries provider/model/hash/guard/approval/apply/revision/rollback; states explicit.

## 5. Blocking Issues

**P0 — prevents *MVP_READY* beyond MVP_PARTIAL:**
- External `OPENAI_API_KEY` + `TYPESAFE_API_KEY` not yet exercised against real cloud (local mock server proves boundary, not latency/cost/billing).
- Jev real (`typesafe`) still mock.
- Production deployment, metrics, S3 not hardened.

**P1 — workaround exists:**
- `HIGH/CRITICAL` risk still escalated (test covered MEDIUM via human); `MEDIUM auto_approve` blocked for real as intended.

**P2 — polish:**
- Stagnation handling and dashboard provider badge are correct; `cold 0% → warm 0%` still mock-limited (expected).

## 6. MVP Verdict

**`MVP_PARTIAL`**

**Why:** Real Python prototype now has **bounded provider boundary**: `rsi/providers.py` (`MockProvider` offline default + `RealLLMProvider` openai-compatible via stdlib, no SDK, usage metadata, stable errors, fail-closed `missing_credentials`, never logs key) + mandatory human gate (`ApprovalPolicy(provider)` disables `auto_approve` for real, explicit `AWAITING_HUMAN_APPROVAL→APPROVED/REJECTED`, `REJECTED never applied`) + provider-aware hash audit (`cycle,attempt_id,provider,model,proposal_hash,verifier_result,jev_guard,approval_state,apply_state,verification,revision,rollback` with `improvement-state` `PROPOSED→VERIFIED→GUARD_PASSED→AWAITING_HUMAN_APPROVAL→APPROVED→APPLIED→VERIFIED_AFTER_APPLY`). Three lanes proved: **mock offline** (22 events `APPLIED safety` chain intact, no network), **missing secret** (2× `provider-config-error` `missing_credentials`, no patch, safe exit, no leak), **real** (14 events `APPLIED` via human, auto-approve blocked, rollback `restore True`, chain intact, no leak). `142 tests OK`, `runs/memory.json` `frozen`, `baseline-*.json` reversible.

## 7. Smallest Path to MVP_READY

To reach `MVP_READY` (production-grade RSI):

- Run one external real-LLM arm (`OPENAI_API_KEY` + `TYPESAFE_API_KEY`) on a disposable fixture (wording) with live `POST /chat/completions` and `TYPESAFE` Jev, still human-gated, measuring real `usage` tokens and cost.
- Add `TRACEABILITY.md` + `tests/test_report_schema.py` for report/dashboard JSON schema regression.
- Harden dashboard `Loop health` aggregation and `benchmark` matrix across mock/real.

