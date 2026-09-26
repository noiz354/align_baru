# ADR-009: Deployment Model

Status: Accepted
Date: 2026-09-26

## Context

Self-hosted, single-team, single-collection product. Operational scale: one app, one PostgreSQL, one S3-compatible bucket, one telemetry endpoint. The brief explicitly defers Kubernetes/Kafka/Redis/microservices. Deployment must be boring, reversible, and documented (DEPLOYMENT.md, RUNBOOK.md).

## Decision Drivers

1. Boring technology: Docker images + compose on one VM (or any host with Docker).
2. Reproducible: same image dev→prod (NFR-OPS-001).
3. Rollback ≤ 15 min (NFR-OPS-004).
4. Zero secrets in repo (NFR-OPS-006).
5. Scale path exists without re-architecture (ARCHITECTURE.md §8).

## Options Considered

### Option A — Single VM + Docker Compose (app, postgres:18, minio-or-nothing [cloud S3], caddy, optional grafana stack)

One `docker-compose.prod.yml`, one Dockerfile (multi-stage: deps → build → runner, non-root). Caddy terminates TLS and fronts the app. Backups: nightly `pg_dump` + storage lifecycle (NFR-DATA-004/005).

### Option B — PaaS (Vercel/Render/Fly)

Fast, but: self-hosted is a product requirement (content ownership); object storage + PG + uploads on a PaaS is 3 managed services + higher cost + weaker control over the upload pipeline (CPU-time limits on 500-page sharp batches). Rejected as primary; Fly/Render remain a plausible *alternative* target for the app container only (compose portability makes this cheap — noted, not built).

### Option C — Kubernetes (k3s or cloud)

Rejected: one VM, ~5 services, zero multi-tenant need — K8s adds a full extra platform to operate for zero product value (brief: "Do not introduce by default"). Scale path (§8) deliberately stops before K8s; if we ever need it, it is a new ADR.

### Option D — Bare metal processes (systemd, no containers)

Rejected: dev/prod drift, native-module (sharp/argon2) install pain on the host, weaker rollback story.

## Decision

**Option A.**
- **Image:** single multi-stage Dockerfile (Node 24 alpine-slim base), non-root, `next build` + `next start` (T-PROD-001).
- **Compose (prod):** `app` (stateless, port 3000), `db` (postgres:18.x pinned tag, volume), `caddy` (TLS, rate-limit backstop, security headers), optional `collector` (Prometheus/Grafana/Loki/Tempo) — MinIO only in the dev compose (prod uses cloud S3/R2 by default).
- **Process model:** single `app` container by default; horizontally trivially scaleable (stateless; sessions in PG) by adding replicas behind Caddy (scale option §8.3).
- **Uploads:** in-process in v1 (job state machine in `features/uploads`); the worker-extraction scale option (§8.4) reuses the same image with a different entrypoint — the port boundaries make this a config change, not a rewrite.
- **Rollback:** keep last 5 images tagged; `docker compose pull && up -d` with the previous tag; expand/contract schema changes mean no DB rollback is ever required (NFR-OPS-004).
- **Validation:** `/readyz` gates + E2E smoke suite (T-PROD-006) + RUNBOOK.md checks after every deploy.

## Consequences

### Positive
- Entire production is one file + one env file (injected by the host, never in the repo) + image tags.
- Rollback is minutes; backup/restore is documented and drilled (T-PROD-004, RUNBOOK.md).
- Dev == prod topology (same compose shape, different volumes/env).

### Negative
- We own the VM (patching, disk, TLS renewal). → Caddy auto-TLS; OS patching is a RUNBOOK.md standing task.
- Single VM = availability ceiling (~99.9% with fast restart). Acceptable for a self-hosted personal collection; documented as a product decision.

## Risks

- **R1:** Docker base-image supply chain. → Pinned digests/tags, `docker compose build` from locked deps, `npm audit` in CI (NFR-SEC-013).
- **R2:** Disk fill from image/backup buildup. → Retention: 5 images, 30 d backups, storage lifecycle (RUNBOOK standing task).
- **R3:** Caddy misconfig blocks the app. → Caddyfile is versioned in-repo; config tested in the compose smoke (T-PROD-006).

## Mitigations

Pinned versions everywhere (research doc registry); smoke suite after deploy; backup restore drill each quarter (RUNBOOK.md); monitoring alert on disk > 80% (OBSERVABILITY.md §5).

## Revisit When

- Two always-on deployments (e.g., staging parity required) → evaluate managed PG + same compose.
- Sustained need > 1 app instance at peak (measure CPU at VS-11) → still compose (add replicas); K8s only if services > ~8.
- The brief's scale triggers (ARCHITECTURE.md §8) are hit → re-derive, new ADR.

## References

- DEPLOYMENT.md (topology, env, secrets, backups), RUNBOOK.md, NFR-OPS-* (PRD §7.6), ARCHITECTURE.md §8
