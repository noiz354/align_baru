# HomeOps Wave3 BASELINE (d5f0974)

**Wave2 state:** `RUNNABLE_DEMO` (feat homeops narrow vertical household→rooms→chores→Today→complete with PGlite `d92529e`)

**Demo boundary at baseline:** chores could be created and listed, Today filtered OPEN, complete marked COMPLETED but did not create next recurring occurrence for `Buang sampah` DAILY/WEEKLY; no deterministic `occurrenceKey` per definition, no idempotent next, double-complete would not be deduped via next creation guard, restart not verified for recurring chain.

**Wave3 target:** `RUNNABLE_DEMO → MVP_PARTIAL` via one real boundary: recurring `Buang sampah` DAILY/WEEKLY definition→occurrence today→Today→complete→next occurrence→reload/restart no duplicate, idempotent double-complete.

**Frozen evidence:** `MVP_AUDIT/progress/homeops-household-manager-spec/` (before 02 after 06, pglite:///tmp/homeops-pglite 49K).

**Commit:** `d92529e` baseline, `d5f0974` WAVE3 lock.
