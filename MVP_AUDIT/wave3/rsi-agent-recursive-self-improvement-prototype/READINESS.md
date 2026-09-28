# RSI Agent Wave3 READINESS

**Wave2:** `MVP_PARTIAL` (`33ea9ea`) — provider boundary/fail-closed config, human gate, memory candidate verifier, audit chain and rollback existed.

**Wave3:** `MVP_PARTIAL` (no promotion)

**New runtime-proven boundary:** full bounded repository patch lifecycle in a disposable Git repo: failing `add(a,b)` bug → actual `RealLLMProvider` HTTP/network path to local OpenAI-compatible mock → isolated verifier → exact path/command/secret guards → `AWAITING_HUMAN_APPROVAL` → explicit named approval → applied patch → test PASS → accepted audit → exact original tree hash rollback. All required IDs/hashes and the 9-event audit chain are in `RUNTIME_PROOF.md`.

**Why not MVP_READY:** available proof is provider-contract E2E against a local protocol mock, not a genuinely real external model cycle. No live provider credentials/model response completed the guarded flow, so user’s promotion rule keeps `MVP_PARTIAL`.

- Sandbox repository is outside and never touches RSI source; temp worktree deleted at completion.
- Four guard failures runtime-rejected: traversal, absolute path, disallowed shell, secret audit; `147` tests `1 skipped`, rest passed.
- Existing offline mock and missing-secret fail-closed flows re-run; no runtime logs/temp run data added under tracked `runs/`.

**Remaining blocker (single):** one live, genuinely real model-approved cycle using configured external credentials has not been proven. Provider-contract E2E is not live LLM and is not presented as one.

**Evidence:** `MVP_AUDIT/wave3/rsi-agent-recursive-self-improvement-prototype/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md}`; repeat with `python3 scripts/wave3_repo_workflow.py --approve --approver <reviewer>`; also `python3 -m unittest discover -s tests`.

**Implementation commit:** `3fc515c`.
