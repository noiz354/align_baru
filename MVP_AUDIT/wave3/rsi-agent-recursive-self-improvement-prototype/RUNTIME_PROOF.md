# RSI Agent Wave3 RUNTIME_PROOF

**Provider mode:** `provider-contract E2E`, explicitly **not a live LLM**. No external provider credential was available. `scripts/wave3_repo_workflow.py --approve --approver wave3-human-reviewer` starts a local OpenAI-compatible HTTP mock on ephemeral loopback port and calls actual `RealLLMProvider.complete()` to `/v1/chat/completions` exactly once. Provider reports `openai-compatible` `contract-mock-model`; mock verifies `Authorization: Bearer <contract key>` but never logs/stores it.

## Disposable repo / baseline

- Sandbox Git worktree `/tmp/rsi-wave3-sandbox-*`, created empty and outside `/home/user/align_baru/rsi-agent-recursive-self-improvement-prototype`; deleted after proof. Contains only `src/add.py` + `tests/test_add.py` (plus `.git` while running).
- Task: `Fix add(a, b): it currently subtracts; make the single failing unit test pass.`
- Before: `src/add.py` returns `a-b`; `tests/test_add.py` checks `add(2,3)==5`; baseline test fails with `AssertionError: -1 != 5`.
- `workspace_before_hash` (Git tree): **`1dd1ed027306dfba87b5bfcd03d330aec857aa19`**

## Required workflow exact values

1. **Provider proposal:** one HTTP request through `RealLLMProvider` local mock, JSON exactly `{path:"src/add.py", content:"def add(a,b): return a+b", summary:...}`.
2. **Verifier:** isolated second candidate workspace test passes; baseline test had failed as expected.
3. **Guard:** approved path `src/add.py`, exact allowlist; max 16KiB patch, fixed command `sys.executable -m unittest discover -s tests`, `shell=False`, timeout 10s; no other command/file/tool accepted.
4. **Approval state:** audit record `AWAITING_HUMAN_APPROVAL` then explicit CLI `--approve --approver wave3-human-reviewer`. `approval_event=evt-000006` for `proposal_id=repo-af14a515ad2a`, bound to patch hash.
5. **Patch apply:** only to temporary Git repo `src/add.py`.
6. **Tests:** same allow-listed unittest command in applied sandbox → **PASS**.
7. **Accepted:** audit `accepted`; `patch_hash= a7d0d52733b0353b1b734b02c86465dd32516320cf7e64477e0a3258a8ed8cf1`.
8. **After hash:** `workspace_after_hash=62046d3aa48c5b1ef19ec03691ee77ef4f4537be`.
9. **Rollback:** original source bytes restored, Git tree `rollback_hash=1dd1ed027306dfba87b5bfcd03d330aec857aa19`, **exactly equal** to `workspace_before_hash`.
10. **Audit:** 9 hash-chained events valid: `baseline-verifier`, `provider-proposal`, `verifier`, `guard-passed`, `AWAITING_HUMAN_APPROVAL`, `explicit-human-approval`, `patch-applied`, `accepted`, `rollback`. Workspace removed after proof.

## Negative paths (runtime; all rejected)

- `../outside` → `SandboxViolation` path traversal
- `/tmp/outside.py` (also `C:\\outside.py`) → absolute path rejected
- `sh -c "cat /etc/passwd"` → exact test-command allowlist rejection; no shell executed
- environment value `sk-123456789012345678901234` passed as audit detail → `SecretLeakViolation` before append; assertion verified raw value absent from audit bytes
- provider payload with extra command/file capability or wrong keys rejected by strict JSON field guard

## Existing RSI regression

- Mock offline run: `python3 demo.py --runs-dir /tmp/rsi-wave3-mock --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 2` exited 0 and wrote only to `/tmp`; `PROVIDER: mock`, no network. Small holdout 0% cold/0% warm is not a product acceptance benchmark; it confirms only offline path stays runnable.
- Fail-closed config: `RSI_PROVIDER=openai-compatible RSI_API_KEY= ... demo.py --improve --runs-dir /tmp/rsi-wave3-failclosed ...` exited 0 offline fallback with message `fail-closed: real provider requested without credential — no patch will be applied`; improvement loop recorded 2 `provider-config-error` hash-chain events (`reason=missing_credentials...fail-closed, no patch applied`) and **no applied patch**.
- Full Python test suite: `python3 -m unittest discover -s tests` → **147 tests, 1 skipped, all others passed** (includes 5 new repo workflow guard/E2E tests).
- No run data under tracked project `runs/` was staged; mock/missing output dirs live under `/tmp`.
