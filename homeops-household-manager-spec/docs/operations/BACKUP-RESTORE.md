# Backup & Restore

> Companion to RUNBOOK.md §7 (the incident procedure) and OPERATIONS.md §5 (routine). This file is the **plan**: what is protected, how well, and how we know.
> Honest framing: a backup you have never restored is a hope, not a backup. The weekly drill is the mechanism that converts hope into a guarantee.

## 1. What must be protected

| Asset | Loss impact | Backup method | Frequency | Retention |
| --- | --- | --- | --- | --- |
| PostgreSQL database | Total product loss (households, history, alerts) | `pg_dump -Fc` (custom format) + provider snapshot if managed | nightly 03:00 household-quiet time | 30 daily, 8 weekly |
| Attachments (issue/completion photos) | Lost photos; records survive | rsync/tarball of the storage root (or provider versioning) | nightly with the DB | aligned to the DB set |
| Secrets | Cannot sign sessions, cannot send push, cannot rotate DB user safely | Operator password manager (manual, out of band) | on change | permanent |
| Configuration (`.env`, compose file, Caddyfile) | Rebuildable from the repo in an hour | Version-controlled except values; values in the password manager | on change | permanent |
| Postgres WAL (optional) | Point-in-time recovery between dumps | Provider PITR (managed) or `archive_command` (self-hosted, only if justified) | continuous | 7 days |

**Not backed up:** application logs (diagnostic only, 30 days on host), metrics (derived), caches (derived).

## 2. Objectives

| Objective | Target | Reasonable? |
| --- | --- | --- |
| RPO (max data loss) | ≤ 24 h (nightly) — accepted for a household app; PITR tightens it if configured | Yes: losing a day of "marked the bin full" is painful, not catastrophic |
| RTO (time to restored service) | ≤ 2 h for database-only restore; ≤ 4 h for full host rebuild | Yes for a single operator with a written runbook |
| Verification | Weekly automated restore drill into a scratch database | Yes, and it is the point of this document |
| Restore confidence | A drill result recorded every week for the last 4 weeks | Non-negotiable |

## 3. Backup procedure (as implemented by T-OPS-001)

```bash
# 1) dump (custom format allows selective restore)
pg_dump --format=custom --no-owner --file=/backups/homeops-$(date +%F).dump "$DATABASE_URL"

# 2) verify the artifact is readable before trusting it
pg_restore --list /backups/homeops-$(date +%F).dump | head

# 3) encrypt before it leaves the host (age or gpg with a key held by the operator)
age --recipient "$BACKUP_KEY" -o /backups/homeops-$(date +%F).dump.age /backups/homeops-$(date +%F).dump

# 4) copy off-host (object storage or a second machine), then check the remote size
rclone copy /backups/homeops-$(date +%F).dump.age remote:homeops-backups/

# 5) prune local files older than 3 days (the off-host copy is the archive)
find /backups -name 'homeops-*.dump*' -mtime +3 -delete
```

Attachments: `tar czf attachments-$(date +%F).tar.gz -C "$ATTACHMENT_STORAGE_ROOT" .` followed by the same encrypt + copy steps.

Rules: the backup job's **success or failure must itself be monitored** (a silent broken cron on a single host is the classic failure); the artifact is verified (`pg_restore --list`) before encryption; the passphrase/recipient key is stored separately from the backups (otherwise the backup is useless or exposed).

## 4. Restore procedures

### 4.1 Database only (most likely case)

1. Announce a maintenance window if production is involved; stop writes (`docker compose stop web`) — a restore over a live database loses data.
2. Decrypt to a working path; create a scratch database; restore there first.
3. Sanity queries (counts by household, open occurrences, open alerts, most recent activity):
   ```sql
   SELECT count(*) FROM household;
   SELECT count(*) FROM chore_occurrence WHERE status IN ('SCHEDULED','IN_PROGRESS','SNOOZED');
   SELECT priority, count(*) FROM alert WHERE state IN ('OPEN','ACKNOWLEDGED') GROUP BY 1;
   SELECT max(created_at) FROM activity_event;
   ```
4. If the numbers make sense, restore into the production database (drop/recreate the schema or use the scratch database under the app role), then re-apply any migrations newer than the dump.
5. Start the app, run each job manually once (`/api/cron/*`), verify `/today` for a real member.
6. Write down the data-loss window (the gap between the dump and the incident) and tell the household plainly.

### 4.2 Full host rebuild (disaster)

1. Provision a new host (DEPLOYMENT.md §6), restore secrets from the password manager.
2. Deploy the image matching the schema version of the most recent good dump.
3. Restore the database, then attachments.
4. Re-point DNS; wait for TLS; verify health, then run the scheduler manually once.
5. Verify push: subscriptions come from the database, so they survive — unless the VAPID keys were regenerated (RUNBOOK §8).

### 4.3 Partial restore (one household)

Because every table carries `household_id`, a single household can be recovered from a dump into a scratch database and copied out row-by-row with a script. This is deliberately manual: it is rare, and correctness matters more than convenience. Never restore a whole database over production to fix one household.

## 5. The weekly drill

| Step | Detail |
| --- | --- |
| 1 | `createdb homeops_drill_$(date +%F)` |
| 2 | Restore the newest backup into it (timed) |
| 3 | Run the sanity queries; compare counts to the production source where they must match (households, members) |
| 4 | Start the app against the drill database on a spare port and load `/today` for a member |
| 5 | Drop the drill database (it contains real household data — do not leave copies around) |
| 6 | Record: date, artifact used, restore duration, result, any procedure correction |

Drill log (keep in the repository or the operator's notes):

```markdown
| Date       | Artifact              | Restore time | Result | Procedure change |
| 2026-10-04 | homeops-2026-10-03    | 6 m 12 s     | pass   | —                |
```

A failed drill is a **P1** even though nothing is broken yet: it means the recovery path is fiction.

## 6. Security and privacy of backups

| Concern | Rule |
| --- | --- |
| Encryption | Always, before leaving the host; key stored separately |
| Access | Only the operator; no shared drives, no chat apps, no email |
| Retention | 30 daily + 8 weekly; expired artifacts are deleted, not orphaned |
| Deletion requests | A household deletion is honoured in production; backups expire within 30 days, and that limitation is **stated** in the confirmation (PRIVACY.md §7) |
| Drill copies | Dropped immediately after verification; never kept "for convenience" |
| Provider snapshots | Treated as a second, untrusted-by-default copy — the operator's own dump is the one with a tested restore path |

## 7. What could still go wrong (accepted risks)

1. **Two disasters in one day** (a restore plus a host failure) — mitigated only by having two copies in two places.
2. **A restore that succeeds technically but loses a day of household work** — mitigated by the honest data-loss window statement, not by pretending RPO is zero.
3. **Attachments and database diverge** (restored at different times) — the nightly pairing reduces this; a mismatch is documented as accepted, and broken image references degrade to a placeholder.
4. **Operator unavailable** — DEPLOYMENT.md §6 and this file are written so a technically capable person can act; the secrets access note is the remaining single point of failure, and it is recorded as such.
