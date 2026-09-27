# SECURITY.md — Security, Threat Model and Sandbox Boundaries

> 2026-09-27 · Companion docs: THREAT_MODEL.md (below), SANDBOX.md (below),
> EVALUATION.md, ROLLBACK.md, OBSERVABILITY.md.

This document is the security position of the RSI prototype. It is not aspirational:
each control names the module that implements it and the test that proves it.

## 1. Position

The prototype is a **bounded, auditable, reversible, human-controlled** recursive
self-improvement system. It is *not* an unconstrained self-modifying agent.

The single mutable artifact is **persistent memory** (`runs/memory.json`): lessons
that were observed against real execution. Everything else — the evaluator, the
sandbox, the risk model, the audit log, the acceptance policy, the CLI — is
read-only to the improvement loop, and is classified CRITICAL by `rsi/risk.py`.

## 2. What the system must never do

| Forbidden behaviour | Control | Test |
|---|---|---|
| Modify arbitrary host files | `rsi/sandbox.py` path containment | `test_absolute_and_traversal_paths_are_refused` |
| Silently rewrite its own safety constraints | `rsi/risk.py` protected paths | `test_safety_config_is_protected` |
| Silently expand permissions | `CRITICAL_AREAS` | `test_restricted_scope_is_critical` |
| Silently grant itself new tools | `CRITICAL_AREAS` | `test_restricted_scope_is_critical` |
| Silently deploy itself | `CRITICAL_AREAS` | `test_production_deployment_is_never_auto_approved` |
| Silently change credentials | `rsi/sandbox.py` secret scan | `test_secret_smuggling_is_refused` |
| Hide modifications | `rsi/audit.py` hash chain | `test_editing_an_audit_record_breaks_the_chain` |
| Disable audit logs | `rsi/audit.py` is a protected path | `test_safety_config_is_protected` |
| Remove rollback paths | every change set carries a `rollback_plan` | `test_proposal_is_evidence_backed_and_measurable` |
| Modify production systems without approval | `ApprovalPolicy` | `test_high_risk_requires_human_approval` |

## 3. Secret safety

Never written to source, patches, logs, evaluation reports, memory, benchmarks or
skill files.

* **Detection** (`rsi/sandbox.py::_SECRET_PATTERNS`) is assignment-shaped only, so
  legitimate prose such as *"review auth middleware for token leaks"* does not
  trip it, while `OPENAI_API_KEY=sk-…`, `password: …`, `Bearer …`,
  `AKIA…`, `ghp_…`, PEM blocks and `Authorization: Bearer …` all do.
* **Enforcement points:** `CandidateWorkspace.write`, `FilePatch` construction
  paths, `AuditLog.append`, `export_skills`, benchmark snapshots.
* **Redaction** (`redact()`) is applied to audit records and skill exports before
  they are persisted.
* **Configuration boundary:** real backends read `OPENAI_API_KEY` /
  `TYPESAFE_API_KEY` from the environment only. No flag, file, patch or log ever
  carries them. `assert_no_secrets` raises before a credential-shaped value can
  reach an artifact.

```python
from rsi.sandbox import assert_no_secrets, redact, find_secret
assert_no_secrets(content, what="candidate file")   # raises SecretLeakViolation
safe = redact(text)                                  # ***REDACTED***
```

## 4. DATA vs INSTRUCTIONS

Repository files, benchmark inputs, task specs, user content, feedback messages
and external data are **untrusted input**. None of it can become an instruction:

1. `FeedbackIngestor` (`rsi/feedback.py`) keeps the free-text `message` as an
   opaque, redacted, length-capped `excerpt`. Proposal generation reads only the
   structured fields (`source`, `task_id`, `knowledge_keys`, `failure_mode`,
   `human_confirmed`).
2. Records carrying a hazard marker, a credential-shaped value, or an unknown
   source are **quarantined** and excluded from generation.
3. A machine signal cannot mint human approval: `human_confirmed=True` from a
   non-`human_correction` source is demoted to unconfirmed.
4. `TamperDetector` rule R6 rejects lessons containing injection vocabulary, so a
   poisoned lesson cannot enter memory even if it passed ingestion.
5. The Jev guardrail (`rsi/routing.py::guard`) escalates tasks whose spec carries
   hazard markers to a human workflow before the Actor ever runs.

## 5. Dependency policy

Zero runtime dependencies (stdlib only). A new dependency must justify:

* why existing code cannot do it,
* maintenance status,
* security implications,
* license,
* size/complexity cost.

Nothing in this prototype adds a library to avoid writing small, straightforward
code — the sandbox, the diff, the audit chain, the dashboard and the benchmark
runner are all stdlib.

---

# THREAT_MODEL.md

## 1. Assets

| Asset | Why it matters |
|---|---|
| `runs/memory.json` | The only mutable artifact; a poisoned lesson changes every future run |
| `runs/audit.jsonl` | The only record of what the agent did to itself |
| `runs/baseline-mem-*.json` | The rollback material for the last known-good state |
| Host filesystem and credentials | Outside the sandbox by construction |
| Evaluation integrity | A rigged evaluation makes every improvement meaningless |

## 2. Threats and mitigations

| # | Threat | Vector | Mitigation | Test |
|---|---|---|---|---|
| 1 | Prompt injection | Task spec, benchmark fixture, feedback message, repository content | Jev guardrail escalation; `FeedbackIngestor` quarantine; TamperDetector R6 | `test_feedback_with_injection_is_quarantined` |
| 2 | Malicious repository content | A lesson crafted to carry instructions | DATA/INSTRUCTIONS split; lessons are generated, never copied from prose | `test_raw_message_never_becomes_an_instruction` |
| 3 | Self-modification of guardrails | A candidate that edits `rsi/risk.py` or `rsi/evaluator.py` | Protected paths → CRITICAL → never auto-applied | `test_safety_config_is_protected` |
| 4 | Sandbox escape | `../`, absolute paths, symlinks, NUL bytes | `_normalize` + `resolve()` containment | `test_traversal_and_absolute_writes_are_refused`, `test_symlink_escape_is_refused` |
| 5 | Secret exfiltration | Credential-shaped string in a lesson, patch, log or benchmark | Secret scan at every write boundary | `test_secret_smuggling_is_refused` |
| 6 | Command injection | Tool arguments reaching a real shell | The tool surface is an allow-list of four named tools; a real toolset must re-apply the same allow-list | `rsi/tools.py::MockToolset.call` |
| 7 | Dependency poisoning | A proposal that adds a library | Dependency change is a CRITICAL area | `test_restricted_scope_is_critical` |
| 8 | Benchmark tampering | Candidate edits the benchmark definition or holdout | Benchmark version pinned per evaluation; protected paths | `test_candidate_cannot_change_the_evaluator` |
| 9 | Test tampering | Candidate deletes a failing test, skips an assertion, lowers coverage | Change ops cannot express it; tests/ is a protected path | `test_candidate_cannot_delete_a_failing_test` |
| 10 | Log deletion / audit bypass | Editing or removing `audit.jsonl` records | Hash chain + `verify_chain()` | `test_deleting_an_audit_record_breaks_the_chain` |
| 11 | Permission escalation | A candidate that grants itself tools or paths | `CRITICAL_AREAS`; risk is computed from the change, not the claim | `test_risk_is_computed_from_the_change_not_the_claim` |
| 12 | Overfitting / benchmark gaming | Hardcoded answers, special-cased ids, skipped hard cases | TamperDetector R4, R5, R7 | `test_candidate_cannot_read_expected_answers` |
| 13 | Unbounded recursion / resource exhaustion | Repeated cycles, huge diffs, many files | `ImprovementLimits`, `SandboxLimits`, `EvaluationLimits`, stagnation stop | `test_max_cycles_is_respected`, `test_diff_budget_rejects_a_huge_change_set` |
| 14 | Race conditions | Two cycles on one baseline; stale candidate; rollback racing apply | `LoopLock`, base-revision check, `applied.json` | `test_concurrency_lock_serialises_cycles`, `test_stale_base_revision_is_refused` |
| 15 | Fake success | A stub evaluator returning `passed: true` | No code path fabricates a pass; every metric comes from a real holdout run | `test_tamper_findings_block_acceptance` |

## 3. Residual risks (documented, not hidden)

* **Mock environment.** `MockToolset` / `MockPlanner` simulate code execution. A
  real deployment must implement the `Planner` protocol and a real toolset that
  re-applies the same allow-list and budgets; the safety machinery around them is
  unchanged.
* **Adversarial OS process.** The sandbox is a structural boundary against an
  over-eager agent, not against a malicious native process. Running candidates in
  a container would be the next hardening step and is out of scope for a
  stdlib prototype.
* **Approver identity.** `ApprovalPolicy` records the approver label it is given;
  it does not authenticate a human. Binding it to a real identity system is a
  deployment concern.

---

# SANDBOX.md

## 1. What the sandbox is

`CandidateWorkspace` (`rsi/sandbox.py`) is a temporary, disposable directory that
holds exactly one candidate's material: the candidate memory payload and the
change-set diff. The accepted baseline is never mutated to "see what happens".

```python
with CandidateWorkspace.create("cand-prop-1234") as workspace:
    workspace.write("candidate-memory.json", payload)
    workspace.write("change-set.diff", change_set.diff())
    ...
# cleanup() removes the whole tree
```

## 2. Guarantees

| Guarantee | Mechanism |
|---|---|
| Containment | `_normalize()` rejects absolute paths, `..`, NUL bytes and empty paths; `resolve()` re-checks the resolved path stays under the root, including through symlinks |
| File budget | `SandboxLimits.max_files` |
| Per-file size | `SandboxLimits.max_bytes_per_file` |
| Total size | `SandboxLimits.max_total_bytes` |
| Diff size | `SandboxLimits.max_diff_lines` (change sets also carry `max_ops`) |
| Secret hygiene | `assert_no_secrets()` runs before every write |
| Disposability | `cleanup()` / context manager |

## 3. Limits actually configured

| Limit | Default | Where |
|---|---|---|
| Files per workspace | 64 (`max_files`), tightened per candidate to `max_changed_lessons + 4` | `SandboxLimits`, `ImprovementLoop` |
| Operations per change set | 8 (`max_ops`), tightened to `ImprovementLimits.max_changed_lessons` (2) | `SandboxLimits`, `EvaluationLimits` |
| Bytes per file | 256 000 | `SandboxLimits` |
| Total bytes | 1 000 000 | `SandboxLimits` |
| Diff lines | 400 default; 200 in the improvement loop | `SandboxLimits`, `ImprovementLimits` |
| Holdout tasks per evaluation | 24 | `EvaluationLimits` |
| Wall clock per loop | 120 s | `ImprovementLimits` |
| Tool calls per loop | 2000 (recorded per cycle) | `ImprovementLimits` |
| Concurrent experiments | 1 (`LoopLock`) | `ImprovementLimits` |

## 4. What the sandbox does not do

It does not run untrusted native code, and it is not a container. If a future
slice executes real candidate code, it must do so inside a container with its own
resource limits, and the allow-list here remains the first line of defence.
