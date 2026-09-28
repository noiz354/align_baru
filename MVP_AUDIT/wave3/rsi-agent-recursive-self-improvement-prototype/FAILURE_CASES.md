# RSI Agent Wave3 FAILURE_CASES

1. **Traversal path:** provider proposal path `../outside` → `SandboxViolation: path traversal is not allowed`; outside bytes unchanged.
2. **Absolute path:** `/tmp/outside.py` (and Windows drive syntax) → `SandboxViolation`; absolute write refused.
3. **Disallowed shell:** `sh -c "cat /etc/passwd"` → command allowlist rejection. Execution only calls fixed `sys.executable -m unittest discover -s tests`, with `shell=False`, timeout and minimal environment; provider cannot supply commands.
4. **Secret-looking environment value:** test injected `WAVE3_SECRET_LOOKING_VALUE=sk-123456789012345678901234`, attempted audit append → `SecretLeakViolation` before write. Runtime asserted the exact value absent from audit file.
5. **Missing real-provider credentials (regression):** `RSI_PROVIDER=openai-compatible` with empty `RSI_API_KEY` → fail-closed audit `provider-config-error`, improvement loop does not run/apply, no key logged; offline exploration may continue on mock with clear warning.
6. **Unapproved workflow:** script successful path requires both `--approve` and `--approver`; otherwise argparse refuses before provider invocation. Approval is bound to `proposal_id` and exact `patch_hash`.

**Strongest negative path:** secret scanner rejected an env-shaped API key before the audit append; test proved it was not serialized. The other path/command rejection outcomes above also passed runtime.
