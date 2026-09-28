# F-001-S2 — ACCEPTANCE: the session guard shares the pool

## A1 — No pool of its own

- [x] `getSessionUser` no longer calls `createDb`/`closeDb`
- [x] it takes an **optional** handle; omitting it uses the process-wide one
- [x] five guard calls with a session token open **zero** new connections,
      measured with `pg_stat_database.sessions` (cumulative)
- [x] four guard calls with no token at all open zero new connections

## A2 — The optional-parameter choice is stated, not implied

- [x] the header explains why optional over required: a required handle would
      force three call sites to each grow a `try/finally` around a pool that is
      itself a process singleton, buying explicitness at the cost of three chances
      to leak it
- [x] it records that F-002 removes the question, when the repository threads the
      pool

## A3 — Anonymous requests pay nothing

- [x] the handle is acquired **after** the token check, so an anonymous visit to
      `/discover`, `/search` or the reader never reaches the pool from this path
- [x] **KNOWN NOT COVERED:** moving the acquisition above the token check is *not*
      detected by this suite, and the reason is structural — `acquireDb` on a warm
      pool opens no connection, so a connection counter cannot see it. The defect
      it would introduce is a refcount that an aborted request never gives back,
      which leaks a shutdown, not a connection. The ordering is defended by the
      comment and by review, not by a test. Recorded rather than papered over.

## A4 — Debt is documented, not silently left

- [x] `requireUser` still throws a bare `Error`, not an `AppError` (C-13) → F-002
- [x] the `x-session-token` header fallback is kept and its risk stated: it lands
      in access logs, proxy logs and `Referer` (C-6) → F-002 decides
- [x] the file still bypasses the `SessionRepository` port → F-002

## A5 — Measurement, and three attempts at it

The first version sampled `pg_stat_activity` **after** the call. A per-call pool
opens and closes before the test looks, so reverting the guard to
`createDb`/`closeDb` **PASSED** — a real regression the measurement missed.

The second version used `pg_stat_database.sessions`, a cumulative counter immune
to timing. It then failed even against the correct implementation, because the
probe opened its own connection and so incremented the number it was reading.

The third reads through a handle that already exists, and polls past the ~500ms
stats-collector lag rather than sleeping a guessed interval.

| Mutation | Result |
|---|---|
| guard reverted to per-call `createDb`/`closeDb` | **1 test fails** |
| acquisition moved above the token check | not detected — see A3 |

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-001-S2 (this commit) |
| Tests | 613 → **615 passed (615)** |
| Files | `src/server/auth/guard.ts`, `tests/integration/db-singleton.test.ts` |
| Commands | the two mutations · full regression gates |
| Notes | Three measurement attempts; the first passed against the bug, the second failed against the fix. Both were found by running the mutations rather than trusting the assertion. |
