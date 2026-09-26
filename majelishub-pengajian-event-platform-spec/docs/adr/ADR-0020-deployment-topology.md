# ADR-0020 — Container topology: web + worker + managed Postgres/storage

- Status: Accepted · Date: 2026-09-26 · Deciders: SRE, Principal Architect
- Requirements affected: NFR-OPS-001…006, NFR-REL-005/006 · Related: ADR-0002, ADR-0010, ADR-0013, `DEPLOYMENT.md`

## Context

Deployment must suit: (a) a single mosque with a small VPS and a volunteer, and (b) a regional
network with a hosted environment. Both must run the same code. Media processing is CPU-heavy
and bursty; web traffic is low and spiky around kajian times; the recording worker must not
compete with the web process for CPU during an event.

## Decision

**Two container images from one repository:**

1. `web` — Next.js 16 `standalone` output, Node 24 slim base, non-root, read-only root
   filesystem, health endpoint, binds `0.0.0.0`.
2. `worker` — same code, different entrypoint: pg-boss consumers + **pinned ffmpeg**.
   CPU- and memory-limited (`--cpus`, `--memory`) so a long processing job cannot starve the
   web tier on a single-VM deployment.

**Stateful services are external to the images:**
- PostgreSQL 18: managed in production (or a single well-backed-up instance for small installs).
- S3-compatible storage: managed (R2/B2/S3) or MinIO in the small-install compose.
- OTLP collector: optional.

**Topologies:**
- *Small install:* one VM running `compose` with `web`, `worker`, `postgres`, `minio`,
  `caddy` (TLS termination + reverse proxy). Documented as the supported "masjid server" shape.
- *Hosted:* web containers behind a managed proxy/LB (or a serverless Next.js host), managed
  Postgres, managed object storage, worker on a small VM (needs ffmpeg and CPU).

**Non-negotiables:** TLS everywhere (camera/mic require a secure context); no `latest` tags;
images pinned by digest; migrations run as an explicit step (never on app boot in production);
health endpoints for both processes; graceful shutdown that finishes in-flight jobs and stops
claiming new ones.

## Alternatives considered

- **Kubernetes.** *Gains:* scheduling, rolling updates, HPA. *Costs:* a control plane to run and
  upgrade, YAML surface area, ingress/cert management, and a skill floor incompatible with a
  volunteer operator. *Rejected* for v1 with a documented migration path (the images are
  compatiable; only manifests are missing).
- **Serverless-only (functions + managed queue + managed storage).** *Gains:* near-zero ops,
  scale to zero. *Costs:* long-running processing, 2-hour upload streams and ffmpeg do not fit;
  cold starts hurt the entrance; vendor coupling. *Rejected as the whole topology* (the web tier
  alone may be serverless — a documented OPTIONAL).
- **Single image running web + worker in one process.** *Costs:* media processing starves the
  web tier exactly when the mosque needs it; a crashed ffmpeg kills the web server.
  *Rejected.*
- **Bare-metal deploy with systemd units.** *Gains:* simple on one machine. *Costs:* environment
  drift, no reproducible artefact, harder rollback. *Rejected as the primary path*, acceptable
  as a documented fallback for an operator who refuses containers (with an explicit
  unsupported-until-tested note).
- **Migrations applied automatically on boot.** *Costs:* concurrent migration attempts from two
  instances; surprise schema changes during an event. *Rejected:* migrations are a separate,
  observable step.

## Consequences

**Positive:** one artefact per component, reproducible; worker isolation protects the entrance
during processing; the same compose works on a laptop and a mosque VPS; rollback is a tag
change plus (if needed) a migration rollback note.

**Negative:** the small install carries meaningful CPU requirements for ffmpeg (documented);
two images to build and scan in CI; TLS/reverse-proxy is the operator's responsibility in the
self-hosted shape (compose provides Caddy with automatic certificates as the default).

**Neutral:** the app must be stateless apart from the database and storage — this constraint is
what makes horizontal scaling possible later without redesign.

## Enforcement

- Weekly CI job builds both images, boots compose, runs migrations, and executes the Playwright
  smoke suite against the containerised stack (`T-OPS-002`).
- Health endpoints exist for both processes and are asserted in `DEPLOYMENT.md` §Verification.
- A release is rejected if either image is not pinned by digest or if the ffmpeg version differs
  from the pinned one.
- Graceful shutdown behaviour is tested: SIGTERM during an active job must not lose the job.

## Revisit trigger

Reopen if: a deployment requires autoscaling under load spikes beyond a single VM; multi-region
is required; or a managed platform materially reduces operational cost without adding vendor
risk (e.g. next.js hosting + object storage + managed Postgres) — decided per deployment, since
the codebase supports both.
