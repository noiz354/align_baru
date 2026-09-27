# ROLLBACK.md — Reversibility Semantics

> 2026-09-27 · Companion docs: EVALUATION.md, SECURITY.md, OBSERVABILITY.md.

Rollback is a first-class operation, not a recovery afterthought. Every applied
improvement is revertible to the last accepted baseline, and every revert is
audited.

## 1. Invariants

| # | Invariant | Enforced by |
|---|---|---|
| R-1 | The baseline revision is known before any apply | `LessonChangeSet.base_revision` + `ImprovementLoop.run_cycle` |
| R-2 | The previous baseline payload is archived before any apply | `runs/baseline-mem-<revision>.json` |
| R-3 | The patch is reversible (every op has an inverse) | `rsi/patches.py` op table |
| R-4 | The config's previous value is known | `FilePatch` carries the previous content; RAO archives `<name>.<revision>.prev.md` |
| R-5 | The memory change is reversible | `PersistentMemory.snapshot()` / `restore()` |
| R-6 | The applied proposal is logged | `improvement-applied` audit event with `revision_before`/`revision_after` |
| R-7 | A failed post-apply verification rolls back automatically | `verify_applied()` → `rollback()` |
| R-8 | The last known-good baseline is never deleted | archives are append-only |

## 2. Reversing a lesson change set

| Op | Forward | Inverse |
|---|---|---|
| `add` | append a lesson | remove it |
| `replace` | overwrite lesson id | restore the previous lesson |
| `retire` | mark deprecated | clear the deprecation |

A change set's `validate()` also enforces `max_ops`, so a revert is always at
least as small as the forward change.

## 3. Rollback path at runtime

```
apply (revision-gated)
  └─► verify_applied()  ── real holdout re-run, independent of the candidate run
        ├─ pass  ⇒ cycle ends; revision recorded
        └─ fail  ⇒ rollback():
                     1. load runs/baseline-mem-<revision_before>.json
                     2. memory.restore(payload)     (fails loudly if the archive is missing)
                     3. append `rollback-executed` with restored revision + archive path
                     4. proposal status → ROLLED_BACK
```

`PersistentMemory.restore()` requires the archived revision to match the
pre-apply revision; if it does not, the loop raises instead of restoring
something wrong.

## 4. Reversing a skill-file rewrite (RAO)

`RAOLoop.rollback(target_dir)` restores the newest archive of `SKILL.md` /
`CLAUDE.md`:

1. sort the archived files `<name>.<revision>.prev.md` by modification time,
   newest first,
2. take the newest whose stem resolves to the current live file,
3. write it back to the live path,
4. record the restore in the audit log.

It deliberately uses the **newest** archive: restoring the oldest would rewind
several improvements at once.

## 5. Observability of rollback

`runs/audit.jsonl` records, for every rollback:

* `restored_revision` — the revision the memory returned to,
* `archive` — the exact file that was restored,
* `proposal_id` — what is being undone.

`LoopHealth.rollback_rate` is the share of accepted improvements that were rolled
back; a rising rate is the signal to stop the loop.

## 6. What is deliberately not reversible

Nothing in the prototype requires a destructive, non-reversible action:

* Project code, tests, evaluator, sandbox, audit and deployment config are
  protected paths, so the loop cannot edit them in the first place.
* `runs/` artifacts are regenerable output (README) — the *rollback material* is
  the `baseline-mem-*` archive, which is never deleted.
