# MEMORY.md — Write Policy and Versioning

> 2026-09-27 · Companion docs: EVALUATION.md, ROLLBACK.md, OBSERVABILITY.md.

Memory (`runs/memory.json`) is the *only* artifact the RSI loop is allowed to
improve. It holds `Lesson` objects: verified procedures and boundary conditions
observed against real execution. This document is the policy that governs what
may be written there, and when.

## 1. The lesson model

```python
Lesson(
    id=...,                # content-hashed, deterministic
    content=...,           # imperative instruction, never raw prose
    knowledge_keys=[...],  # the competence areas this lesson covers
    source_task_id=...,    # the observed attempt it came from (traceability)
    confidence=0.0..1.0,
    verified=True,         # observed by the Verifier; required to be stored
    version=1,             # bumps on replace
    superseded_by=None,    # points at the replacer when retired
    deprecated=False,      # soft-delete: kept for audit, removed from reads
    created_at=...
)
```

## 2. Write policy

A lesson enters memory **only** through one of two gates:

| Gate | Evidence strength | Mechanism |
|---|---|---|
| **Exploration** (`Verifier`) | A single observed execution | `VerifierAgent.verify()` mines a `procedure` (success) or `boundary` (failure) lesson directly |
| **Improvement loop** | Proven on the identical holdout | `EvaluationEngine` → `ApprovalPolicy` → `apply_change_set()` |

Stronger evidence is required for a *permanent* change than for a runtime
observation. The improvement loop's gate is strictly the stronger one: the
candidate lesson must already be verifier-verified, the candidate must pass
structural checks, beat the target metric on the frozen holdout with no critical
regression, and clear the risk ceiling. A random runtime claim can never skip
that gate.

## 3. What may never be written

* Raw feedback prose, benchmark fixtures, repository content or prompt text —
  quarantined by `FeedbackIngestor`.
* An unverified lesson (`verified=False`) — refused by
  `LessonChangeSet.validate`.
* A fabricated, un-sourced lesson — refused by TamperDetector (R1).
* A lesson naming a benchmark id, expected answer, or hazard phrase —
  refused by TamperDetector (R4, R5, R6).
* A credential-shaped string of any kind — refused by the secret scanner.
* Anything while memory is frozen — `MemoryFrozenError`.

## 4. Versioning and lifecycle

| Transition | What happens | Reversibility |
|---|---|---|
| `add` | appended with `version=1` | removable |
| `replace` | same `id`, `version += 1` | previous version is the archived baseline |
| `retire` | `deprecated=True`, optional `superseded_by=<new id>` | clear the flag |

* **Deprecated lessons are excluded from every read path** — `keys()`,
  `coverage()`, `relevant()`, the actor's context — but kept on disk for audit.
* **A retired lesson disappears from the generated skill files automatically**
  because the export reads only active, verified lessons.
* `superseded_by` records *which* lesson replaced it, so the audit trail can
  always reconstruct why a rule went away.

## 5. Provenance invariants (no silent rules)

Every lesson must carry a `source_task_id` that exists in the run's attempt
log. That is what makes memory auditable: for any rule the agent is now
following, there is a concrete recorded attempt that produced it, and a concrete
affected task it was verified against. If a lesson claims a task that was never
attempted, the improvement loop blocks it.

## 6. Freeze boundary

* Exploration may write freely.
* `freeze()` (at the BRS/DRS → test-time boundary) makes every write raise —
  including the improvement loop, which refuses to start a cycle on a frozen
  store.
* A new run starts with a fresh (grown-from-zero) memory; `--resume` opts into
  warm continuity deliberately.

## 7. Sample

```json
{
  "id": "lesson-9f1c...",
  "content": "[procedure] apply tests-first for golden-report rendering",
  "knowledge_keys": ["golden"],
  "source_task_id": "task-w2-3",
  "confidence": 0.82,
  "verified": true,
  "version": 1,
  "deprecated": false
}
```
