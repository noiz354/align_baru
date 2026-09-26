# BACKUP AND RESTORE

A backup exists only if it has been restored. This document defines what is backed up, how often, and
the exact restore procedure that a second person must be able to execute.

Related: `RETENTION.md` (backup retention 35 days), `DEPLOYMENT.md` §8, `RUNBOOK.md` RB-18.

---

## 1. Scope

| Asset | Backed up | Method | Frequency | Retention (backup copies only) |
|---|---|---|---|---|
| PostgreSQL (all schemas: app, jobs, audit) | Yes | Physical/base backup + continuous WAL archiving; nightly logical `pg_dump` as a second, simpler line | WAL continuous; dump nightly 01:30 venue-local | 35 days |
| Object storage — **master audio** bucket | Yes | Provider versioning/replication if available; otherwise a scheduled mirror job (list + copy, hash-verified) | Daily | 35 days |
| Object storage — derived audio (seekable/normalised/16 kHz), partial chunks, exports | **No** | Regenerable from master, or intentionally ephemeral | — | — |
| Original uploaded chunks (partial bucket) | No | Keep until assembly verification passes; then deleted by policy | — | ≤ 14 days |
| Configuration and secrets | Encrypted export held by two named operators | On change | — | Current + previous |
| Jobs/queue state | Indirect (in Postgres) | — | — | — |

Rationale for not backing up derived audio: it is a pure function of the master plus configuration.
Backing it up doubles storage cost and creates a restore path that can silently diverge from the
pipeline. If the master is lost, the derivatives are gone — which is why the master is the one object
class with a mirror.

## 2. Restore readiness requirements

- Restore must be possible **without the person who set the system up**.
- The procedure must be rehearsed **quarterly** with two people, timed, and recorded.
- Every automation must be safe to run against an empty environment.
- Restored environments start with **jobs and notifications disabled** and `MAINTENANCE_MODE` on, so a
  restored copy can never message real people or re-run deletions.

## 3. Restore procedure (reference: `ops/backup-restore.sh` — skeleton in Phase 0)

```
1. Announce: incident or drill? (drill: never target production)
2. Identify the target backup (timestamp, size, checksum).
3. Provision an empty database instance and an empty storage namespace.
4. Restore the base backup / dump; replay WAL to the chosen point (or stop at the dump's point).
5. Restore storage: replay the mirror for master audio keys (verify per-object hashes).
6. Configure the app for the restored instance:
     MAINTENANCE_MODE=true   JOBS_ENABLED=false
     flags.notifications=false  flags.retention=false  flags.publishing=false
7. Apply migrations only if the backup predates the current release (forward-only).
8. Start the app; run verification (section 4).
9. If this is a real restore: switch traffic, then re-enable jobs, then notifications last.
10. Record: who, when, source backup, verification result, duration, surprises.
```

Exact command lines live in `ops/backup-restore.sh` (skeleton) and in the deployment's own notes; they
depend on whether Postgres is managed or self-hosted.

## 4. Verification checklist after restore

| Check | Expected |
|---|---|
| Migration state | Matches the release being run (`schema_migrations` table) |
| Table counts | Within expected range for the backup time (per-table spots: events, registrations, attendance, transcripts, revisions, audit) |
| Constraint sanity | `SELECT` proves: no duplicate attendance per (event, registration); no published transcript without an approver; no cross-org FKs |
| Storage sampling | 3 random master-audio objects: downloadable, hash matches the recorded value, duration matches the session |
| Public read | A public event page renders |
| Attendance report | A closed event's counts match the pre-backup exported report |
| Jobs | Disabled — and the queue is empty (no surprise re-execution) |
| Notifications | Disabled, and no intent is pending dispatch |
| Audit trail | Latest entries present; audit queries return results |
| Secrets | Rotated for the restored environment (a restored copy must not share production credentials) |

## 5. Recovery objectives

| Objective | Value | Note |
|---|---|---|
| RPO (data loss tolerance) | ≤ 15 minutes (WAL) / ≤ 24 h worst case (if only dumps survive) | Registration and attendance records created during an event cannot be re-created by hand |
| RTO (time to be operational) | ≤ 4 hours including verification | Measured quarterly; if exceeded, the drill findings drive simplification |
| Restore of a single object | ≤ 30 minutes | For accidental deletion of one audio object |

## 6. Common failure modes and prevention

| Failure mode | Prevention |
|---|---|
| Backups exist but are unreadable | Restore into scratch every month; alert if a restore fails |
| Backups include the wrong schema (missing audit/jobs) | Dump the whole cluster; verify table lists |
| Storage mirror silently incomplete | Hash verification per object and a monthly sample download |
| Nobody knows the credentials in an emergency | Sealed break-glass credential with two holders; quarterly check |
| Restore overwrites live data during a panic | Procedure forbids restoring into the production instance; restore to a new instance and switch |
| A restored copy sends real notifications | Jobs/notifications disabled by default after restore, plus `MAINTENANCE_MODE` |
| Retention deletes data mid-restore | Retention runs only in production and never on a freshly restored instance until verified |

## 7. Evidence kept

Every restore (drill or real) records: date, operator(s), backup source, start/end time, verification
results, discrepancies, and follow-up actions. Evidence records contain **counts and metadata only** —
never the personal data that was restored.
