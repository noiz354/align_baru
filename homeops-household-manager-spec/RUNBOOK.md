# RUNBOOK.md — Incident Procedures

> 2026-09-26 · Status: **WRITTEN, NOT REHEARSED** (dry-run scheduled in T-OPS-006)
> Format: symptom → impact → first checks → actions → verification → post-incident. Every procedure assumes you are tired; keep steps literal.

## 0. Before anything

1. Note the time and what you observed.
2. Check `/api/health` and `/api/health?deep=1` — they tell you whether the app is up, the DB is reachable, the migration version matches, and whether scheduled work is stale.
3. Check the last deploy (`git sha`, timestamp) — the most common cause of a sudden break.
4. Do **not** delete data to "clean up" during an incident. Back up first if a restore may be needed.

| Reference id | Where it comes from |
| --- | --- |
| Correlation id (short hex) | Shown on the error page; search logs for it |
| `requestId` / `traceId` | Logs and (if configured) traces |
| Job name | Health deep response and metrics |

---

## 1. Site is down

**First checks:** container running? Caddy running? disk full? DB up? recent deploy?

```bash
docker compose ps
docker compose logs --tail=200 web
docker compose logs --tail=200 caddy
df -h
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/health
```

**Actions by cause:** restart the container if it is in a crash loop and logs show a transient error; if it is disk, free space (old images/logs) and restart; if the database is down, start it and let the app reconnect; if it is a bad deploy, roll back to the previous image tag (DEPLOYMENT.md §5).

**Verify:** health 200, `/today` loads, one mutation works, scheduler ran a tick.

**Post-incident:** record cause and duration; if the cause was a deploy, add a check to the rollout checklist.

---

## 2. Scheduler stalled (`scheduler_tick_age_seconds` > 15 min)

**Impact:** chores/occurrences not materialised, alerts not evaluated, notifications not draining. Users see stale dashboards but no data loss.

**First checks:** process alive? advisory lock stuck from a previous crashed run? long-running job? DB reachable?

```sql
-- is something holding an advisory lock?
SELECT pid, state, query_start, query FROM pg_stat_activity WHERE query ILIKE '%advisory%';
-- last successful tick is surfaced by /api/health?deep=1
```

**Actions:** if a job is genuinely running long, let it finish or terminate its backend (`pg_terminate_backend`) and let the next tick retry; if the process is wedged, restart the container; if the lock is orphaned by a dead connection, it is released automatically when the session ends.

**Verify:** tick age returns below cadence; run a manual trigger for each job:

```bash
curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/cron/evaluate-alerts
curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/cron/materialise-chores
curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/cron/drain-notifications
```

**Post-incident:** if the cause was a slow query, add/verify an index per DATA_MODEL.md §4.

---

## 3. Push notifications not arriving

**Impact:** members miss reminders; in-app alerts remain correct (they are the source of truth).

**First checks:** is the subscription still registered? are attempts failing? is the outbox draining? has `VAPID` changed? Did the member re-install the PWA (iOS requires installation)?

**Actions:** inspect delivery metrics for error classes; if 404/410 are frequent, the stale subscriptions are pruned automatically (confirm the prune ran); if 401/403 appear, the VAPID keys likely mismatch → fix configuration (do **not** rotate keys casually: rotation invalidates all subscriptions, see §8); if nothing is pending at all, check the policy layer — the member may be in quiet hours or over the daily cap (this is intended behaviour, not a bug).

**Verify:** send a test notification from settings; confirm an attempt row with outcome `delivered`.

**Post-incident:** if the cause was a policy misunderstanding, improve "why didn't I get this?" copy.

---

## 4. Outbox backlog / dead letters

**First checks:** `outbox_pending` and `outbox_dead_letter` metrics; error classes on attempts; provider status (push service/email).

**Actions:** transient provider failures → wait for backoff; a poison message (repeated failure with the same class) → move to dead-letter state and inspect **without** printing payloads (they contain no user content by design, only ids); fix the cause, then re-drive dead letters from their ids.

**Verify:** backlog returns to ~0; no new dead letters for 1 h.

---

## 5. Member is locked out

**First checks:** can they sign in with another account? Is their email correct? Is the email channel configured (invitations/recovery)?

**Actions (in order of least invasive):**

1. Ask them to try password reset. If no mail provider is configured, use the operator-issued path:
2. Operator issues a single-use reset link (documented in DEPLOYMENT.md §2 for the required config) and delivers it out-of-band; the link is single-use and expires in 30 minutes.
3. If their sessions are suspect, an owner revokes all sessions (settings → sign out all devices) — this is also the action for a lost device.

**Verify:** they sign in, complete one action, and see their household.

---

## 6. Suspected account or session compromise

**Impact:** household data exposure. Treat as S1.

**Actions:**

1. Revoke all sessions for the affected member (owner action) and change the household-critical settings if needed.
2. Force a password reset for that account.
3. Review `audit_log` for role changes, exports, and sign-ins (no content, only ids and outcomes).
4. Check for unexpected push subscriptions and remove them.
5. If the compromise was via a stolen device, remind the household that in-app truth is unaffected but the session is gone.
6. Only if data was exfiltrated: document the scope (which tables were readable in that window) — this is where the "we log no content" stance helps: logs prove less was exposed, not more.

---

## 7. Restore from backup

**Use when:** data corruption, accidental destructive migration, or a failed host.

1. **Stop writes:** put the app behind a maintenance page (or stop the web container) so nothing writes during restore.
2. Identify the newest good backup (timestamp + size + integrity check).
3. Create a scratch database and restore there first; verify counts and a sample of relationships:

```bash
createdb homeops_restore
pg_restore --clean --no-owner -d homeops_restore /backups/homeops-YYYY-MM-DD.dump
psql -d homeops_restore -c "select count(*) from household; select count(*) from chore_occurrence where status in ('SCHEDULED','IN_PROGRESS','SNOOZED');"
```

4. If the restored data is correct, restore into the production database (or promote the scratch DB by renaming).
5. Re-apply any migrations newer than the backup if the code expects them.
6. Start the app; run the scheduler manually once; verify `/today` for a real member.
7. Restore attachments storage for the same date window if the loss affected them.
8. **Document the data-loss window** honestly and tell the household.

**Verify:** row counts sane; no duplicate open occurrences; alerts recomputed by the tick.

---

## 8. VAPID rotation (avoid unless necessary)

Rotating push keys invalidates every subscription. If you must:

1. Generate new keys, deploy, and verify in-app alerts still work.
2. Notify the household that push must be re-enabled per device (settings → notifications).
3. Watch `push_subscriptions_active` until it recovers.
4. If delivery is broken with old keys and rotation is the only path, treat it as scheduled maintenance, not an emergency.

---

## 9. Database disk full

1. Stop writes; keep the app up read-only if possible.
2. Find the largest consumers:

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public'
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 10;
```

3. Most likely: `activity_event`, `notification_attempt`, `alert`, `attachment` metadata, or WAL after heavy writes.
4. Run the retention prune manually (cron trigger), then `VACUUM` (not `FULL` during an incident unless necessary).
5. Expand the volume if growth is legitimate (attachments); review retention settings otherwise.

**Never** truncate a table to free space during an incident without a fresh backup.

---

## 10. Household deletion request

1. Verify the requester is the household owner (email + a written confirmation).
2. Take a final backup and store it per the retention policy (it will expire; note that in the confirmation).
3. Delete in dependency order (children first), then the household row; alternate: mark archived and schedule deletion.
4. Confirm in writing, with the date and the scope of what was deleted.
5. Log the operation in the operator's record (not in the product UI).

---

## 11. Dependency security patch

1. Read the advisory; determine exploitability in our deployment (server-side only, no public API, no public uploads).
2. Patch on a branch; run the full CI; deploy via the normal checklist.
3. If the advisory is actively exploited and the patch is unavailable: mitigate at the edge (Caddy rule), disable the affected feature, or take the app down — in that order of preference, and document the decision.

---

## 12. No exporter configured

If OTLP is not configured, you still have: `/api/health?deep=1`, container logs on the host, and the database (counts, timestamps). Use these:

```bash
docker compose logs --since 1h web | grep '"level":"error"'
psql "$DATABASE_URL" -c "select count(*) from outbox_message where state='dead_letter';"
psql "$DATABASE_URL" -c "select max(created_at) from alert;"
```

Everything in this runbook can be executed without a metrics backend — deliberately (ADR-015).
