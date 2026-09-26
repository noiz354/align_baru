# RUNBOOK.md

Date: 2026-09-26 · Audience: the operator (and agents performing ops tasks). Procedures reference the topology in DEPLOYMENT.md.

## 1. Standing Tasks

| Cadence | Task |
|---|---|
| Daily (automated) | DB backup 03:00 UTC; verify backup file exists + size > 1 MB (alert on failure) |
| Weekly | Check disk usage on all volumes; prune images beyond 5; review alert dashboard |
| Monthly | Verify backup restore *to a scratch container* (not prod) — 15 min drill |
| Quarterly | Full restore drill (RTO clock) per §4; dependency review (npm audit, base image update); cert renewal check (Caddy auto — confirm) |

## 2. Routine Operations

### 2.1 Deploy
1. Build image `yomi:<sha>` (CI or local `docker compose build`).
2. On VM: `docker compose -f compose.prod.yml pull && up -d` (tag via `COMPOSE_IMAGE_TAG=<sha>`).
3. Migrations run at container start (DEPLOYMENT.md §4) — watch `docker compose logs app` for `migrations: applied=…`.
4. Run the DEPLOYMENT.md §7 validation checklist.
5. Keep old tag known for rollback.

### 2.2 Rollback
Per DEPLOYMENT.md §5. Target: traffic back on previous image ≤ 15 min. DB is **not** rolled back.

### 2.3 Read-only inspection
- Logs: `docker compose logs -f app` (dev) or `docker exec yomi-app cat /var/log/app.json | jq .` (prod, via host) — logs are JSON, PII-redacted by design (NFR-OBS-006).
- Query DB read-only: use the maintenance role in a psql session with `SET default_transaction_read_only = on`.

## 3. Common Incidents

### 3.1 Upload job stuck (state ≠ ready/failed for > 20 min)
1. Check `yomi_upload_jobs_total` by state + job row (`state`, `error_code`, timestamps).
2. If `processing` and CPU is flat: the watchdog should have killed it (15 min cap, ADR-005) — if not, restart the app container (in-process jobs die; job rows stay `processing` → operator marks `failed` via maintenance role with reason `ops.timeout` — audit event).
3. Staging files auto-purge after 24 h (NFR-DATA-005); manual purge: delete `staging/{jobId}/` prefix via S3 CLI with the operator key.
4. Ask the curator to re-upload (re-ingest path, FR-UPLOAD-009).

### 3.2 Storage (S3/R2) outage
1. Symptom: `/readyz` 503, `reader_image_errors_total` spike, upload jobs failing `STORAGE_*`.
2. App behavior is designed to degrade: catalog/APIs still serve (DB-backed); reader shows per-image retry placeholders (FR-READER-018); uploads queue/fail with typed errors.
3. Action: provider status check; if > 30 min, enable the maintenance page (Caddy snippet) for `/media/*` only if pages are unusable; do **not** restart the app (retries will recover).
4. Post: verify no partial job rows without storage objects (INT-UP-001 invariant) — run the `uploads.reconcile` maintenance script (T-OBS-005 area; script is a task, not a v1 deliverable).

### 3.3 PostgreSQL down
1. Symptom: `/readyz` 503, 5xx spike.
2. If container crash: `docker compose up -d db`, check `docker compose logs db`, verify volume mount.
3. If data corruption suspected: **stop the app**, restore from latest dump into a scratch PG (§4), verify, then swap volumes.
4. Post: verify backups are healthy (the down event may have coincided with a missed backup).

### 3.4 Auth anomaly (brute force / session abuse)
1. Symptom: `yomi_auth_failures_total` spike alert.
2. Immediate: edge (Caddy) rate-limit rule for the IP; disable compromised account (`status=disabled`) via admin UI or maintenance role — invalidates sessions on next request (ADR-006).
3. If session-secret compromise is suspected: rotate `SESSION_SECRET` (invalidates all sessions — users re-login; document in incident note), re-run argon2 re-hash pass is not needed (hashes are in DB, unaffected).
4. Post: review audit events for the window.

### 3.5 Disk > 90%
1. Identify: `docker system df` + volume usage.
2. Prune: images > 5, dangling, old backups beyond retention, staging prefix (S3 side) if local MinIO dev.
3. Recurring: size the VM up or move backups to the cloud bucket (DEPLOYMENT.md §6).

## 4. Backup & Restore Drill (quarterly, RTO target 4 h)

1. **Clock start.**
2. Fresh scratch environment (compose, new volumes).
3. Restore latest `pg_dump` into scratch PG (timed step).
4. Run migrations on scratch; app boots against scratch; `/readyz` 200.
5. Spot-check: seeded-check title visible; one chapter's 500-page list count matches; one page image loads from live storage.
6. **Clock stop** → record RTO. Failure to meet 4 h = incident with a task.

## 5. Schema Emergency Fix (bad migration)

1. Never edit history; write a **forward** fix migration (expand/contract).
2. If the bad migration blocked boot: `drizzle-kit migrate --force-skip` is NOT available by default — the escape hatch is the maintenance role: apply the fix SQL manually, then insert the missing migration bookkeeping row (procedure reviewed at T-PROD-005).
3. Document in the incident; the bad migration file stays in history with a comment.

## 6. Secrets Rotation

| Secret | Rotation | Effect |
|---|---|---|
| `SESSION_SECRET` | on compromise / yearly | all sessions invalidated |
| DB credentials | on compromise / yearly | app restart with new env |
| S3 keys | on compromise / yearly | app restart; old key deleted after 0 active uses |
| MAIL_PASS | on compromise / yearly | app restart |

Procedure: generate new value → update host env / CI secret → `docker compose up -d app` → verify (login works, storage ops work) → revoke old value.

## 7. Scaling Operations (when triggers in ARCHITECTURE.md §8 hit)

1. Read replica: new DB endpoint + `DATABASE_REPLICA_URL` env (flag-gated reads) — task-gated, not this runbook.
2. Second app instance: `docker compose` scale `app:2` (stateless) — verify session behavior (PG-backed, safe).
3. CDN direct media: asset URL switch (env `MEDIA_DIRECT_BASE`) + DNS — new ADR first.

## 8. Incident Process

1. **Detect** (alert or human) → open incident note (date, symptoms, affected).
2. **Contain** (fastest reversible action first: edge rule, disable user, roll back image).
3. **Diagnose** (logs/traces/metrics per OBSERVABILITY.md; DB read-only).
4. **Recover** (fix or rollback; verify with DEPLOYMENT.md §7).
5. **Post-mortem** (5 Whys, action items → TASKS.md with IDs).
6. Secrets: rotate anything that was exposed, per §6.
