# DEPLOYMENT.md

Date: 2026-09-26 · Model: ADR-009 (single VM, Docker Compose, stateless app + PG + S3-compatible storage + optional collector). No infrastructure is deployed in this phase; this document specifies the target.

## 1. Topology

```
Internet
   │  HTTPS (443)
   ▼
┌─────────────────────────────────────────────────────────────┐
│ Single VM (Docker host)                                      │
│                                                             │
│  ┌──────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  caddy   │───▶│  app (Next.js)   │───▶│  db (PG 18)   │  │
│  │ TLS 443  │    │  Node 24, :3000  │    │  volume: pg   │  │
│  │ 80→443   │    │  (1..n replicas) │    └───────────────┘  │
│  └──────────┘    │  stateless       │    ┌───────────────┐  │
│                  └─────────────────┘    │ collector     │  │
│                           │              │ (optional:    │  │
│                           ▼              │ prom, loki,   │  │
│                  S3/R2 endpoint (cloud)  │ tempo, grafana)│ │
│                  or MinIO (dev compose)  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **caddy**: TLS (automated ACME), HSTS, security headers (SECURITY.md §5), backstop rate limits, 128 MB body cap.
- **app**: the Next.js image; env-injected config; scales by replica count behind Caddy (stateless).
- **db**: `postgres:18.x` pinned; named volume; `max_connections 50`; app pool 10.
- **collector**: optional service (Prometheus + Loki + Tempo + Grafana) — enabled by env flag; dev/prod both supported.
- **MinIO**: dev compose only; prod uses cloud S3/R2 via env (ADR-004).

## 2. Images & Builds

- Single multi-stage Dockerfile (T-FOUND-010 skeleton; T-PROD-001 final):
  1. `deps`: node:24-alpine, `npm ci` (lockfile).
  2. `build`: `next build` (Turbopack) + drizzle-kit migration bundle check.
  3. `runner`: node:24-alpine, non-root (`node` user), copy standalone output, `EXPOSE 3000`, healthcheck → `/healthz`.
- Tags: `yomi:<git-sha>` + rolling `yomi:latest`; keep last 5 (ADR-009 R2).
- Native modules (sharp, argon2): prebuilt binaries via npm (sharp) / platform build in `deps` stage (argon2) — verified on the exact base image at T-FOUND-010 (ADR-005 R3).

## 3. Environment Variables (normative inventory, NFR-OPS-002)

Validated at boot by the typed env contract (`src/shared/validation/env.ts` skeleton; T-FOUND-002). Fail fast with a redacted error.

| Var | Required | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | `production`/`development`/`test` |
| `APP_ORIGIN` | yes | `https://read.example.com` | Origin check (CSRF), CSP, cookies |
| `APP_BASE_PATH` | no | (empty) | reverse-proxy path, if any |
| `SESSION_SECRET` | yes | 256-bit hex | session token signing/rotation (NFR-SEC-009) |
| `DATABASE_URL` | yes | `postgres://yomi:***@db:5432/yomi` | single URL; no user-controlled DSN parts |
| `S3_ENDPOINT` | yes | `https://<account>.r2.cloudflarestorage.com` | MinIO in dev |
| `S3_REGION` | yes | `auto` (R2) / region | |
| `S3_BUCKET` | yes | `yomi-media` | private bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | yes | | least-privilege policy: only this bucket |
| `UPLOAD_MAX_TOTAL_BYTES` | no | `524288000` | 500 MB (NFR-SEC-007) |
| `UPLOAD_MAX_FILE_BYTES` | no | `104857600` | 100 MB |
| `UPLOAD_MAX_FILES` | no | `500` | |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | `http://collector:4318` | empty = telemetry off (dev default) |
| `OTEL_SERVICE_NAME` | no | `yomi-app` | |
| `MAIL_FROM` / `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | VS-9 | | password reset email (FR-AUTH-004) |
| `RATE_LIMIT_SEARCH_PER_MIN` etc. | no | `30` | overrides for NFR-SEC-005/006 defaults |
| `NEXT_TELEMETRY_DISABLED` | yes | `1` | Next.js own telemetry off (data policy) |

Secrets (SESSION_SECRET, DATABASE_URL credentials, S3 keys, MAIL_*): host-side env file **outside the repo** or CI secret store; never in compose files in the repo (NFR-OPS-006).

## 4. Startup Sequence & Gating

1. Process boots → env validation (typed, redacted failures).
2. Migrations: `drizzle-kit migrate` **runs before serving** (expand/contract rule: migrations must be backward-compatible with the previous app image, NFR-OPS-004).
3. Storage canary: HEAD/PUT 1-byte canary key (readyz dependency).
4. App serves; `/healthz` 200; `/readyz` 200.
5. Reverse proxy healthchecks gate traffic (Caddy: `/healthz` 10 s interval).

## 5. Rollback (NFR-OPS-004, ≤ 15 min)

1. Identify previous image tag (registry `:sha` tags kept ×5).
2. `docker compose -f compose.prod.yml up -d app` with previous tag (or `COMPOSE_IMAGE_TAG=...`).
3. **Database:** never rolled back — expand/contract discipline guarantees the previous app works against the new schema. If a migration was bad: apply a *forward* fix migration (documented procedure, RUNBOOK §5).
4. Verify: `/readyz` + smoke E2E subset (T-PROD-006) + RUNBOOK §2 checks.
5. Object storage: immutable keys mean no rollback concerns for delivered content.

## 6. Backups & Restoration (NFR-DATA-004, NFR-OPS-005)

**PostgreSQL:**
- Daily `pg_dump --format=custom` at 03:00 UTC → `backups/db/yomi-YYYYMMDD.dump` (private, encrypted volume or private bucket). Retention: 30 daily + 12 monthly.
- RPO ≤ 24 h, RTO ≤ 4 h (restore drill quarterly — RUNBOOK §4).
- `pg_hba`: app role (DML, no DDL) + maintenance role (separate, manual).

**Object storage:**
- R2/S3: enable versioning on the media bucket (protects against accidental overwrite; re-ingest uses new keys so versions are a backstop, not the mechanism). Staging prefix: lifecycle rule delete > 24 h (NFR-DATA-005).
- Covers/pages: no separate backup — versioning + (optional) cross-region replication is the durability story (provider ≥ 11-nines design).

**Restoration order:** storage (nothing to do — provider durable) → fresh PG from latest dump → run migrations → verify canaries + spot-check one chapter's page metadata against stored objects (RUNBOOK §4.3).

## 7. Deployment Validation Checklist (T-PROD-006, run after every deploy)

1. `/healthz` 200, `/readyz` 200.
2. Smoke E2E subset: catalog renders (seeded check title visible), chapter opens, first page loads, progress POST accepted (authenticated context), one admin mutation + audit row.
3. Dashboards: RED no 5xx, DB latency baseline, telemetry arriving (span count > 0 for 2 min).
4. Security spot: CSP header present, cookie flags correct, `/readyz` unauthenticated OK but no app routes leak readiness detail.
5. Disk: volumes < 80%.

## 8. Environment Matrix

| Env | Purpose | DB | Storage | Telemetry |
|---|---|---|---|---|
| dev (compose) | daily dev | PG 18 (volume) | MinIO | off |
| ci (compose, ephemeral) | tests | PG 18 (ephemeral) | MinIO (ephemeral) | off |
| pre-prod | storage/PG provider verification | managed PG 18 | live R2 bucket (test) | on (test project) |
| prod | live | managed/local PG 18 | R2 (default) / S3 | on |

Pre-prod exists specifically to verify the R2 vs MinIO protocol equivalence risk (ADR-004 R1) before prod use.
