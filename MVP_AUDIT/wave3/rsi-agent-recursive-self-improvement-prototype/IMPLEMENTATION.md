# RSI Agent Wave3 IMPLEMENTATION

**Narrow fix:** add a separate, bounded repository-patch workflow around existing provider, CandidateWorkspace, secret scanner, and AuditLog; never patch the RSI package itself.

## Changed files

- `rsi/repo_workflow.py` — new repository workflow and trust boundaries:
  - `RepositoryImprovementWorkflow` only accepts an empty directory named `rsi-wave3-sandbox-*` directly under system temp, outside the RSI source tree.
  - Snapshot restricted to exactly `src/add.py` + `tests/test_add.py`; `src/add.py` is the only allowed patch path; path traversal, absolute path, Windows drive path, any extra target, extra proposal field, oversized source, and secret-looking source/summary are rejected.
  - Provider can only return JSON `{path, content, summary}`. It receives the bounded workspace file snapshot as prompt context; it receives no filesystem tool or arbitrary shell tool.
  - Verifier writes candidate only into a second disposable CandidateWorkspace and runs a fixed `sys.executable -m unittest discover -s tests` using `subprocess.run(..., shell=False, timeout=10)`. Provider-supplied command fields are invalid; `validate_command` rejects any command outside the one exact allowlist.
  - Main target gets a fresh temporary Git repo, baseline commit/tree hash, initial failing test proof, patch apply only after approval, post-apply test, and exact baseline restoration/tree hash equality. `PYTHONDONTWRITEBYTECODE=1` avoids pycache contaminating the original Git tree hash.
  - Hash-chain `AuditLog` records baseline-verifier → provider-proposal → verifier → guard-passed → `AWAITING_HUMAN_APPROVAL` → explicit-human-approval (actor/reviewer, proposal ID, exact patch hash) → patch-applied → accepted/rejected → rollback. Audit stores hashes/target/status, no patch secrets.
  - `--approve` and `--approver` are mandatory for the runnable successful path; no implicit provider/model approval.

- `scripts/wave3_repo_workflow.py` — local OpenAI-compatible HTTP mock server + runtime driver. It calls `RealLLMProvider.complete()` (stdlib HTTP client, auth header verified server-side, not logged), with `model=contract-mock-model`, one task, exact patch. It is labelled **provider-contract E2E**, not live LLM. Creates/deletes the temporary Git repo and audit outside repository.

- `tests/test_repo_workflow.py` — 5 tests: relative path/allowlist rejection, exact command allowlist, secret rejection before audit write, CLI approval required, full provider-contract E2E including rollback equality and 4 negative paths.

- `rsi/__init__.py` — exports workflow type and guard API.

Implementation commit: `3fc515c feat(rsi): add guarded repository improvement workflow`.

## Runtime artifact facts

- temporary repo only contains `src/add.py` + `tests/test_add.py` plus Git internals; source bug `return a - b`, one failing `assert add(2,3)==5`.
- Workflow never points to repository root/current RSI source. Sandbox removed after run.
- Provider returned no command; only one source replacement. Shell invocation fixed, `shell=False`.
- Local server used fake contract-only API key to exercise HTTP Authorization; key never put in audit or stdout. Audit's secret scanner rejected a separate secret-looking env value before writing.

## Limits

- No external provider credential/model call completed. This is **not** a live LLM run; repository workflow readiness is therefore still `MVP_PARTIAL`.
- Sandbox workflow accepts exactly one allow-listed patch path/one test command for the bounded exercise; it does not claim general production repository autonomy.
