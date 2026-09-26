# DEPLOYMENT

**Document ID:** DOC-DEPLOYMENT
**Status:** Phase 0 (topology + plan; **nothing deployed**)
**Related:** ADR-0024, `OPERATIONS.md`, `RUNBOOK.md`, `docs/research/STACK-2026.md` §2.15

---

## 1. Target topology (Phase 1 / pilot)

```text
                    Internet
                        │
                 ┌──────▼──────┐
                 │  TLS edge    │  (platform CDN/proxy: TLS, HSTS, rate limiting,
                 │  + WAF       │   security headers, request buffering)
                 └──────┬───────┘
                        │
        ┌───────────────▼───────────────────────────────┐
        │     Container host / managed container runtime │
        │  ┌─────────────────┐   ┌───────────────────┐   │
        │  │ web (Next.js)   │   │ worker (pg-boss)  │   │
        │  │ N replicas      │   │ M replicas        │   │
        │  │ same image      │   │ same image        │   │
        │  └───────┬─────────┘   └────────┬──────────┘   │
        └──────────┼──────────────────────┼──────────────┘
                   │                      │
        ┌──────────▼──────────────────────▼──────────┐
        │  Managed PostgreSQL 18 (primary + failover) │
        │  system of record · job queue · outbox      │
        └──────────────────┬──────────────────────────┘
                           │
        ┌──────────────────▼───────────┐   ┌───────────────────────────┐
        │ S3-compatible object storage │   │ OTLP → metrics/traces/logs│
        │ (evidence, exports)          │   │ (VPC-internal)            │
        └──────────────────────────────┘   └───────────────────────────┘
```

Deliberately absent: Kubernetes, service mesh, Redis, message broker, separate API service,
shared filesystem, long-lived SSH access to production.

---

## 2. Environments

| Env | Purpose | Data | Providers | Rules |
| --- | --- | --- | --- | --- |
| local | Development | Seeded synthetic | Fakes only | Docker Compose: Postgres, optional MinIO |
| preview (per PR) | E2E + review | Synthetic | Fakes | Ephemeral DB; migrations applied from scratch |
| staging | Pre-production | Production-shaped synthetic | Sandboxes | Migration rehearsal, restore drill, load sanity |
| production | Live | Real | Live (when enabled) | Immutable images; audit on; alerts routed |

**No production data ever flows into local, preview, or staging.**

---

## 3. Container image

| Aspect | Decision |
| --- | --- |
| Build | Multi-stage Dockerfile; Next.js standalone output; deterministic installs from the lockfile |
| Base | Node.js 24 LTS alpine-class image, pinned by digest |
| User | Non-root; read-only root filesystem where feasible; writable `/tmp` only |
| Contents | One image with two entrypoints (`web`, `worker`) — no environment-specific images |
| Size | Kept small (no dev dependencies, no build toolchain in the final layer) |
| Health | `/api/v1/health` (liveness: process; readiness: DB reachable + migrations applied + config valid) |
| Shutdown | Graceful on SIGTERM: stop accepting, finish in-flight, drain worker jobs, then exit |
| Config | Environment variables + secret manager injection; validated at boot (fail fast on missing config) |

---

## 4. Release process

```text
1. Merge to main            → CI: lint, typecheck, unit, integration, browser, build, scan
2. Build image (tag = git sha, never "latest" in production)
3. Migration job             → reviewed SQL, single instance, expand/contract pattern
4. Deploy web (rolling)      → readiness gates, then shift traffic
5. Deploy worker             → graceful drain; jobs are idempotent so double-processing is safe
6. Post-deploy verification  → smoke checks (login, sale create, sync, dashboard card)
7. Monitor 30 min            → error rate, latency, job failures, callback failures
8. Record release note       → what changed, migrations applied, verification results
```

Rollback: redeploy the previous image tag (≤ 10 min). **Migrations must be backwards-compatible**
for one release cycle (add columns/tables first; remove later), so rollback never requires a
down-migration under pressure.

---

## 5. Configuration and secrets

| Item | Location | Notes |
| --- | --- | --- |
| App config (tolerances, thresholds, feature flags) | Database (audited) + env defaults | Business-tunable without deploy |
| Environment config (URLs, region, bucket names) | Environment variables | Validated at boot with a Zod schema |
| Secrets (DB URL, S3 keys, provider keys, OTP provider, VAPID keys) | Secret manager | Never in repo, image, or logs; rotated on schedule and on suspicion |
| Feature flags | Database + env kill-switches | Every slice ships behind a flag (ADR-0038) |

---

## 6. Database operations

| Task | Stance |
| --- | --- |
| Migrations | Generated as SQL, human-reviewed, applied by an explicit job; **never** on app boot; expand/contract |
| Backups | Managed PITR; retention per `RETENTION.md`; encryption on |
| Restore drill | Quarterly, timed, with data-integrity spot checks (`T-OPS-003`) |
| Indexing | Reviewed with query plans during slice work; partial unique indexes encode invariants |
| Growth | Table sizes and index bloat watched in dashboards; partitioning only when justified |
| Read models | Rebuildable at any time from facts (idempotent jobs) |

---

## 7. Data residency and providers

| Component | Preference |
| --- | --- |
| Database | Region closest to Indonesia offered by the chosen managed provider (Singapore/Jakarta) |
| Object storage | Same region where possible; lifecycle rules for retention |
| Observability backend | In-region or with strict data minimisation (no PII labels) |
| Payment provider | Indonesian PJSP with published sandbox and signed callbacks |
| Maps tiles | Provider permitting offline-friendly caching policies for HQ-only rendering |

Cross-border considerations are documented in `PRIVACY.md` §7 before enabling any offshore
processor.

---

## 8. Cost model (pilot expectations)

| Item | Driver | Control |
| --- | --- | --- |
| Web/worker compute | Replicas × size | Start with the smallest that meets SLOs; scale on measured latency |
| Managed Postgres | Storage + IOPS + instance | Archive/partition when large; monitor slow queries |
| Object storage | Evidence volume | Client-side compression + short retention (`RETENTION.md` R-06/R-12) |
| Egress | Evidence downloads, HQ exports | Zero-egress storage provider preferred (R2-class) |
| Notifications | Per message (push is free; WhatsApp/SMS paid) | In-app first; paid channels only for P1 |
| Maps | Tile requests | HQ-only, cached, no operator map |
| Observability | Ingest volume | Sampling + log level discipline; bounded labels |

Track **cost per active stall** monthly (NFR-OPS-006) and publish it to the owner.

---

## 9. Deployment anti-patterns (explicitly forbidden)

1. Building on the production server.
2. `drizzle-kit push` (or any schema-diff tool) against shared environments.
3. Manual edits to production data outside an audited admin path.
4. Long-lived SSH/root access; break-glass only, logged.
5. Shipping with `latest` tags or unpinned base images.
6. Deploying during the closing window (17:00–19:00) without an explicit decision.
7. Feature flags that are never cleaned up (each flag has an owner and an expiry review).
