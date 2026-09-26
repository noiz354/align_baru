# ADR-016: Deployment — Single Container + Managed Postgres, Docker Compose

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps serves one household (possibly a few, if the operator hosts for family). Availability expectations are modest (NFR-REL-005: 99% monthly, maintenance windows allowed). Operations must be performable by the same person who writes the code (NFR-MAINT-001), with no on-call rotation. The app needs a long-lived Node process (ADR-013's scheduler) and a persistent Postgres (ADR-002). It must host in a way that a member can reach from a phone over HTTPS (PWA/push require a secure origin). Backup/restore must be simple and *tested*. The main alternatives are a serverless platform (Vercel-class), a PaaS (Fly/Railway/Render), a VPS with Docker, or a home server plus a tunnel.

## Problem
Which deployment shape gives a long-lived process, persistent database, HTTPS, backups and a reversible deploy — with the fewest moving parts and no operational specialisation?

## Decision Drivers
- Long-running process for the scheduler (ADR-013) — rules out pure serverless default.
- Persistent, backed-up Postgres (NFR-REL-001).
- HTTPS + custom domain for PWA install and push.
- Reproducible artifact (Docker) so local and production match.
- Migrations applied deliberately, not implicitly on boot in a loop.
- Reversible deploys within ~10 minutes (NFR-REL-003).
- Cost appropriate to a household product.

## Options Considered
1. **Single VPS + Docker Compose (`web` + `postgres` + `caddy`), migrations as an explicit pre-deploy step, nightly `pg_dump` to object storage.** Full control, low cost, standard ops.
2. **Managed Postgres + single container host (Fly.io/Railway/Render)** — less to operate for the database (managed backups/PITR), slightly more cost, still a long-lived process.
3. **Vercel + serverless Postgres (Neon/Supabase)** — excellent DX, but breaks the in-process scheduler model, pushes household data to third parties, and complicates long-lived connection pooling.
4. **Kubernetes cluster** — massively disproportionate; rejected.
5. **Home server + Cloudflare Tunnel** — cheapest and private, but depends on home network/power; acceptable only as an operator variant, not as the documented default.
6. **Managed container platform with built-in cron (ECS/Cloud Run + scheduler)** — viable but adds cloud-specific concepts without a requirement.

## Decision
Adopt **(1) as the default, with (2) explicitly allowed** as an equivalent variant for operators who prefer a managed database. Both keep the same application artifact and the same operational contract.

Baseline topology:

```text
Internet ──▶ Caddy (TLS, security headers, HTTP→HTTPS)
                │
                └──▶ web container (Next.js Node server, port 3000)
                        ├── scheduler loop (in-process, DB-locked)
                        └── Postgres 18 (container volume or managed instance)
```

Rules and procedures:
- **Artifact**: multi-stage Dockerfile (`node:24-bookworm-slim` base, `next build` with `output: standalone`, non-root user, no dev dependencies in the runtime image, image tagged by git SHA and by semver).
- **Configuration**: 12-factor env vars; secrets via env/secret store, never baked into the image (NFR-SEC-007). `.env.example` documents every variable and which are required.
- **Migrations**: `drizzle-kit generate` produces SQL committed to the repo; `migrate` runs as an explicit step *before* the new container is switched in, executed from the release pipeline (NFR-REL-002). Forward-only; no auto-migrate on container start.
- **Rollout**: `docker compose pull && docker compose up -d` (or platform equivalent) with a health check on `/api/health`; keep the previous image tag for rollback (NFR-REL-003).
- **Backups**: nightly `pg_dump` (custom format) to object storage or an off-host location, 30-day retention, plus a *weekly restore drill* documented in RUNBOOK.md (NFR-REL-001).
- **TLS/headers**: terminate TLS at Caddy; security headers set at the proxy (CSP is set by the app where it must be nonce-aware, see SECURITY.md#headers).
- **Timezone**: containers run UTC; the household timezone is application data, never a container setting (FR-HH-006).
- **Resource envelope**: 1 vCPU / 1 GB RAM / 20 GB disk is the documented minimum, with observed headroom expectations in PERFORMANCE.md.
- **Observability**: stdout logs captured by the host; optional OTLP export per ADR-015.
- **Node upgrade policy**: pin Node 24 LTS now; evaluate Node 26 after its LTS promotion on 2026-10-28 (documented trigger, not an implementation task).

## Consequences

### Positive
- One artifact, one host, one database — matches ARCHITECTURE.md §3 and the 99% availability target without specialists.
- Local parity: `docker compose up` reproduces production dependencies.
- Scheduler works as designed (long-lived process).
- Backups/restores are ordinary, well-understood `pg_dump`/`pg_restore`.
- Cost is predictable and small; no per-seat or per-invocation pricing surprises.
- Reversible deploys with pinned image tags.

### Negative
- The operator owns database patching, disk monitoring and backup verification.
- Single-node means a host outage is an outage (no HA); accepted under NFR-REL-005.
- Manual or scripted rollout rather than zero-downtime blue/green; brief maintenance windows are acceptable.
- Managed-Postgres variant adds a hosting account and a network dependency.
- VPS deployment requires the operator to keep the host OS patched.

## Risks
| Risk | Impact |
| --- | --- |
| Backup runs but restore is never tested | Data loss discovered at the worst moment |
| Migration applied before a failed deploy | Schema ahead of code |
| Disk fills (logs, images) | Outage |
| TLS/domain misconfiguration | PWA install and push break |
| Host compromise via weak SSH/root access | Full data breach |

## Mitigations
- Weekly restore drill is a documented runbook step with a completion log (RUNBOOK.md#restore-from-backup); backups are verified by restoring into a scratch database.
- Migrations are additive-first (expand/contract) so code and schema can be temporarily compatible; destructive steps land one release later (CONTRIBUTING.md#migrations).
- Disk usage is a monitored signal; `docker system prune` policy and log rotation documented in OPERATIONS.md.
- TLS and header configuration is part of the deployment checklist; push requires HTTPS and the checklist asserts it before enabling notifications.
- Host hardening checklist in DEPLOYMENT.md (SSH keys only, no root login, firewall: 80/443 only, unattended upgrades).

## Revisit Conditions
- Availability or latency requirements rise beyond a single node (multi-region users).
- Managed Postgres becomes cheaper than the operational burden of self-hosting (operator preference).
- Household count grows beyond a handful and multi-tenant hosting becomes a product requirement (would reopen ADR-005 and this ADR together).
- Serverless platforms gain an equivalent of long-lived scheduled execution without a vendor dependency (would reopen the scheduler ADR first).

## References
- PRD.md — NFR-REL-001..005, NFR-MAINT-001, NFR-SEC-007
- DEPLOYMENT.md, OPERATIONS.md, RUNBOOK.md
- docs/operations/BACKUP-RESTORE.md, docs/operations/INCIDENT-RESPONSE.md
- docs/research/STACK-2026.md#9
- ADR-001 (framework), ADR-002 (database), ADR-013 (scheduler), ADR-015 (observability)
- TASKS.md — T-PLAT-020..028, T-OPS-001..006
