# DEPLOYMENT

How MajelisHub is built, released, migrated and (if needed) rolled back. Target: **one operator**
can deploy and understand it.

Stack reference: `docs/research/STACK-2026.md` §19 · Ops procedures: `OPERATIONS.md`, `RUNBOOK.md` ·
SLOs: `docs/operations/SLO.md`

---

## 1. Topology (self-host, Docker Compose)

```
              ┌──────────────┐   HTTPS   ┌────────────────────────────┐
Internet ─────▶ reverse proxy│──────────▶│ app container (Next 16)    │
              │ (Caddy/Traefik, TLS,     │  ├─ HTTP + Server Actions  │
              │  HSTS, body limits)      │  └─ proxy.ts (middleware)  │
              └──────────────┘           └───────────┬────────────────┘
                                                     │
                                          ┌──────────▼──────────┐
                                          │ Postgres 18         │  (private network)
                                          │  app + jobs + audit │
                                          └──────────┬──────────┘
                                                     │
   ┌───────────────────┐    ┌───────────────────┐    │
   │ worker container  │────│ media container   │────┘
   │ (jobs, pg-boss)   │    │ (ffmpeg, sandbox) │
   └───────────────────┘    └───────────────────┘
                 │                     │
                 └────────┬────────────┘
                          ▼
                 ┌──────────────────┐
                 │ S3-compatible    │  private buckets, presigned URLs only
                 │ object storage   │
                 └──────────────────┘
```

Roles: **app** (HTTP only, no ffmpeg, no long jobs), **worker** (jobs: assembly, processing,
transcription orchestration, notifications, retention, reconciliation), **media** (ffmpeg execution,
isolated, no DB credentials beyond the job it is handed), **db**, **storage**, **proxy**.

Rationale: the media worker is the only component allowed to run a third-party binary on
user-supplied bytes; it is separately resource-limited and cannot reach the internet unless configured
for a hosted STT provider.

## 2. Environments

| Env | Purpose | Data | Providers |
|---|---|---|---|
| Local | Development | `tiny` fixtures | fakes; hosted services disabled |
| CI | Automated tests | fixtures + containers | fakes/fixture responses |
| Staging | Release rehearsal, QA drills | synthetic production-shaped data | configured like production, separate credentials |
| Production | Live | real | real or explicitly disabled |

Rule: **no production data in staging or local**, no production credentials outside production secret
storage.

## 3. Configuration — full environment reference

Grouped; secrets are marked 🔒 (provided via secret storage, never in `.env` files committed to git).

**Core**
| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` in deployed environments |
| `APP_URL` | yes | Public origin; used for links, cookies, CSP |
| `PORT` | yes | Container port (behind proxy) |
| `LOG_LEVEL` | yes | `info` default; `debug` never in production |

**Database**
| `DATABASE_URL` 🔒 | yes | Application role (not owner) |
| `DATABASE_MIGRATION_URL` 🔒 | yes | Migrations only (owner role; used by the migration step, never by the app) |
| `DATABASE_POOL_MAX` | yes | Sized to instance count; pooled through the proxy where available |
| `DATABASE_STATEMENT_TIMEOUT_MS` | yes | Guards runaway queries |

**Auth/session**
| `BETTER_AUTH_SECRET` 🔒 | yes | ≥ 32 bytes, rotated per procedure |
| `SESSION_COOKIE_DOMAIN` | yes | |
| `RATE_LIMIT_STORE` | yes | Persistent store (Postgres) — **in-memory limiter is forbidden in production** |
| `TRUSTED_PROXY_HOPS` | yes | For correct client IP handling behind the proxy |

**Storage (S3-compatible)**
| `S3_ENDPOINT` · `S3_REGION` | yes | |
| `S3_ACCESS_KEY_ID` 🔒 · `S3_SECRET_ACCESS_KEY` 🔒 | yes | Scoped to the buckets |
| `S3_BUCKET_AUDIO_MASTER` · `S3_BUCKET_AUDIO_DERIVED` · `S3_BUCKET_UPLOADS_PARTIAL` · `S3_BUCKET_EXPORTS` | yes | Four buckets; see `docs/media/STORAGE.md` |
| `S3_FORCE_PATH_STYLE` | yes | `true` for MinIO |
| `S3_SIGNED_URL_TTL_SECONDS` | yes | Default 300; ≤ 900 hard cap |
| `S3_SERVER_SIDE_ENCRYPTION` | yes | Provider-supported algorithm |

**Jobs**
| `JOBS_ENABLED` | yes | Worker: `true`; app: `false` |
| `JOB_CONCURRENCY_*` | yes | Per-queue limits (`ASSEMBLY`, `MEDIA`, `TRANSCRIPTION`, `NOTIFY`, `RETENTION`) |
| `JOB_RETRY_LIMIT_*` · `JOB_DEAD_LETTER_AFTER_DAYS` | yes | |
| `JOB_PURGE_AFTER_DAYS` | yes | pg-boss hygiene (ADR-0010) |

**Media**
| `MEDIA_WORKER_ENABLED` | yes | On the media container only |
| `FFMPEG_PATH` · `FFPROBE_PATH` | yes | Pinned version; recorded in the image |
| `MEDIA_MAX_UPLOAD_BYTES` | yes | Per chunk (default 8 MB) |
| `MEDIA_MAX_SESSION_BYTES` | yes | Default 500 MB |
| `MEDIA_TMP_DIR` · `MEDIA_CPU_LIMIT` | yes | Bounded tmpfs; hard limits |
| `MEDIA_NORMALIZE_TARGET_LUFS` | yes | Default −16 |

**Transcription**
| `TRANSCRIPTION_PROVIDER` | yes | `SELF_HOSTED_WHISPER` \| `HOSTED_*` \| `DISABLED` |
| `TRANSCRIPTION_PROVIDER_URL` 🔒 | yes if hosted | Allow-listed egress only |
| `TRANSCRIPTION_PROVIDER_KEY` 🔒 | yes if hosted | |
| `TRANSCRIPTION_EGRESS_ENABLED` | yes | **`false` by default**: no audio leaves the deployment without an explicit decision (PRIVACY.md §5) |
| `TRANSCRIPTION_REVIEW_SLA_DAYS` | yes | Drives the review-age alert |
| `TRANSCRIPTION_MAX_AUDIO_MINUTES` | yes | Cost/abuse guard |

**Notifications**
| `EMAIL_PROVIDER` · `EMAIL_FROM` · `EMAIL_API_KEY` 🔒 | yes | Transactional provider |
| `NOTIFICATION_QUIET_HOURS` | yes | `21:00-06:00` venue-local |
| `NOTIFICATION_CHANNELS_ENABLED` | yes | MVP: `in_app,email` |

**Retention**
| `RETENTION_ENABLED` | yes | Off until VS-13 |
| `RETENTION_DRY_RUN` | yes | `true` outside production |
| `RETENTION_*_DAYS` | yes | Per class (R1…R28 in `RETENTION.md`) |
| `RETENTION_BATCH_SIZE` | yes | Bounded deletion batches |

**Observability**
| `OTEL_ENABLED` · `OTEL_EXPORTER_OTLP_ENDPOINT` · `OTEL_SERVICE_NAME` | no | Traces/metrics |
| `OTEL_SAMPLING_RATIO` | yes | Default 0.1; event-hour override |
| `METRICS_ENABLED` | yes | Prometheus scrape or OTLP |

**Operations/security**
| `FEATURE_FLAGS_*` | no | Kill switches (see §10) |
| `MAINTENANCE_MODE` | yes | Serves a calm maintenance page; blocks writes |
| `SECRET_SCAN_ENABLED` | yes | Log/telemetry guardrail |

Validation: a single `config` module parses and validates **all** of the above at boot with a schema,
fails fast, and never prints values. Misconfiguration must fail at deploy time, not at first request.

## 4. Build

1. `npm ci` from the lockfile (no floating versions).
2. `tsc --noEmit` — types are the first gate.
3. Tests per `TESTING.md` §9.
4. `next build` → standalone output (Next 16 standalone mode) — the two images (**app**, **worker/media**)
   are built from the same output with different entrypoints.
5. Image hygiene: non-root user, read-only root filesystem, no shell in the app image, ffmpeg only in
   the media image, pinned base digests, SBOM generated and attached.

## 5. Migrations

Rules (ADR-0020):

1. **Never on application boot.** A container starting must not change the schema.
2. Migrations run as an explicit deploy step using the migration role, before the new app version is
   cut over.
3. Every migration is **forward-only, additive-first**: add nullable columns/indexes concurrently,
   backfill in a job, then remove old paths in a later release. No destructive change in the same
   release as the code that stops using the old shape.
4. Long operations use `CREATE INDEX CONCURRENTLY` / batched backfills; no long table locks during
   event hours.
5. Migrations are reviewed for lock behaviour and for whether they are **safe to run twice**.
6. Release rehearsal: apply to a restored production-shaped copy in staging; measure duration.
7. A migration that cannot be reverted must have an explicit rollback plan in the release notes
   (usually "restore from backup + replay accepted data").

## 6. Release procedure

| Step | Action | Gate |
|---|---|---|
| 1 | Freeze: tag `vX.Y.Z`, generate changelog from Conventional Commits | — |
| 2 | Backups: verify last backup age < 24 h; take a fresh pre-release backup | Restore test passed within 90 days |
| 3 | Staging deploy + full E2E + QA scenario for the touched surface | Green |
| 4 | Check the event calendar: is a kajian live in the next 60 minutes in any deployment? | If yes, deploy only critical fixes, or defer |
| 5 | Production deploy: migrate → roll workers → start new app → switch proxy | Health checks green |
| 6 | Post-deploy checks (below) | All green |
| 7 | Watch window: 30 min of elevated attention, alerts reviewed | No critical alerts |
| 8 | Release notes published to operators (plain language, what changed, what to watch) | — |

**Post-deploy checks:** health endpoint; a public event page loads; a synthetic registration on a
staging-like event and its token validates; logger emits the correct fields; job queue drains; storage
write/read reachable; no spike in 5xx; `telemetry_dropped_attribute_total` = 0.

## 7. Zero-downtime expectations

- **App:** rolling restart behind the proxy; sessions live in the database, so a restart does not log
  users out.
- **Workers:** drain in-flight jobs (SIGTERM grace) before exit; jobs are idempotent, so an
  interrupted job re-runs safely (C11).
- **Database:** migrations are backward-compatible for one release, so old and new app versions can
  coexist briefly.
- **During an event:** treat as a change window — no non-critical deployments.

## 8. Backup

| Item | Method | Frequency | Retention | Verify |
|---|---|---|---|---|
| Postgres | `pg_dump`/physical base backup + WAL archiving | continuous WAL, daily full | 35 days | daily automated restore into a scratch DB and a row-count check |
| Object storage | Provider replication/versioning **if available**; otherwise a scheduled mirror of master audio keys (never derived/partial buckets) | daily | 35 days for mirrors | monthly sampling: download 3 random keys and verify hashes |
| Configuration/secrets | Encrypted export kept by two operators | on change | — | quarterly walkthrough |

Details and the restore procedure: `docs/operations/BACKUP-RESTORE.md`.

## 9. Rollback

| Situation | Action |
|---|---|
| Bad app release, schema compatible | Redeploy previous image tag (minutes) |
| Bad app release with a migration applied but backward-compatible | Redeploy previous image; leave schema; fix forward |
| Migration not backward-compatible | Restore the pre-release backup into a new database, point the old app at it, then reconcile data created in the meantime (documented per release; this is why destructive migrations are banned in the same release) |
| Bad configuration | Revert config and restart; config is validated, so a bad value blocks the boot instead of misbehaving |
| Corrupted object in storage | Restore the key from mirror/backup; verify hash; never "fix" audio bytes by hand |

## 10. Feature flags / kill switches

| Flag | Purpose |
|---|---|
| `flags.recording` | Stop all new recording sessions (existing sessions can still finish) |
| `flags.upload` | Pause chunk acceptance (client buffers and retries) |
| `flags.transcription` | Stop new transcription submissions (queued jobs remain) |
| `flags.publishing` | Stop new transcript publications (existing content unaffected) |
| `flags.registration` | Stop new registrations; check-in still works |
| `flags.checkin` | Force manual-only mode for the entrance |
| `flags.notifications` | Stop outbound messages (intents still recorded) |
| `flags.retention` | Stop deletion jobs (evidence of a pause is kept) |

Flags are settings in the database, changeable by a platform administrator, **audited**, and shown on
the affected page ("Perekaman sedang dinonaktifkan sementara").

## 11. CI/CD pipeline (GitHub Actions)

| Job | Trigger | Content |
|---|---|---|
| `verify` | PR | install → typecheck → lint (incl. boundary + no-fake-implementation rules) → unit → contracts |
| `integration` | PR | Postgres + MinIO services → integration, security, concurrency suites |
| `browser` | PR | Playwright chromium → component + smoke E2E + axe |
| `build` | PR | Both images, SBOM, vulnerability scan |
| `release` | tag | Staging deploy → full E2E + QA scenario → manual approval → production deploy → post-deploy checks |
| `nightly` | schedule | Full E2E, entrance drill, recording survival, load, performance budgets, restore drill |
| `maintenance` | schedule | Retention dry-run, dead-letter report, dependency audit, SLO review export |

Secrets live in the CI provider's secret store; production deploy uses an environment with required
reviewers. No long-lived production credentials in GitHub — prefer short-lived deployment tokens.

## 12. Deployment cost model (documented, reviewed quarterly)

| Component | Shape | Notes |
|---|---|---|
| App + worker + media | 1 small VPS (2 vCPU / 4 GB) can serve a single-mosque deployment; scale by adding app replicas | self-hosted Whisper requires GPU or patience; CPU transcription is a nightly-batch pattern |
| Postgres | Managed or self-hosted with backups | largest operational risk if self-hosted without drills |
| Object storage | ~ (2 h Opus @ 48 kHz ≈ 100–150 MB master + derivatives) per event | largest variable cost; retention is the lever |
| Email provider | per 1,000 messages | |
| STT provider (optional) | per audio minute | disabled by default; see ADR-0011 cost table |

The cost model must be recomputable by an operator from real usage numbers — it appears on the
operator dashboard as a monthly estimate with assumptions stated.
