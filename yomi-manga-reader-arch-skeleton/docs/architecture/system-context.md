# System Context

Companion to ARCHITECTURE.md §2. Defines the external entities, the interfaces between them, and the rules for each.

## 1. Actors

| Actor | Description | System interfaces used |
|---|---|---|
| Anonymous reader | Browser (desktop/laptop/phone); no account | catalog, search, chapter list, reader, media, telemetry beacon |
| Member | Registered user | everything anonymous + progress sync, library, history, bookmarks, preferences, account ops |
| Admin (curator) | Member with admin role (P1 persona) | everything + admin APIs, uploads, users, audit, stats |
| Operator | Human running the VM (not a software actor) | compose, runbook scripts, dashboards, backups |
| Telemetry collector | Local or vendor OTLP endpoint | OTLP/HTTP (traces, metrics); logs via stdout collection |

## 2. External Systems

| System | Protocol | Purpose | Failure behavior of Yomi |
|---|---|---|---|
| PostgreSQL 18 | postgres wire (driver pool) | system of record | `/readyz` 503; APIs 500/503-class; app keeps serving cached HTML? NO — APIs fail typed (no cache in v1, PERFORMANCE.md §7); healthz still 200 |
| S3-compatible storage (R2/S3/MinIO) | HTTPS (S3 API) | pages, covers, staging | media 502 (typed); uploads fail typed; catalog still serves (DB-backed); `/readyz` 503 |
| SMTP provider (VS-9) | SMTP | password-reset mail | reset request still 204 (no mail ⇒ user can't reset; logged + alert; documented degradation) |
| Reverse proxy (Caddy) | HTTP (same host) | TLS, headers, rate backstop | operator concern; app unreachable ⇒ outage (single-VM ceiling, ADR-009) |
| Telemetry collector | OTLP/HTTP | observability | telemetry dropped, app unaffected (ADR-008) |
| End-user browsers | HTTPS | everything | — |

**No other external systems exist in v1.** No CDN (media is app-proxied), no third-party APIs, no webhooks, no search service, no email verification service (account creation is immediate — documented product choice for a self-hosted trusted-collection app; abuse surface is bounded by rate limits + single-admin curation).

## 3. Interface Rules

1. **Browsers → app:** JSON APIs + HTML (SSR) + media. CSRF: Origin check on mutations (NFR-SEC-004). Rate limits per NFR-SEC-005/006.
2. **App → DB:** parameterized queries only (NFR-SEC-015); app role: DML only (T-SEC-005); pool max 10 (DEPLOYMENT.md §1).
3. **App → storage:** bucket-scoped credentials; private bucket; app never exposes storage URLs to browsers (FR-MEDIA-003); streaming reads (no full-file buffering).
4. **App → telemetry:** no PII (NFR-OBS-006); best-effort (never blocks a request).
5. **Operator → app:** compose + scripts only; no in-band admin channel (all admin goes through the authenticated admin API — audited).

## 4. Context Boundaries (what is deliberately outside)

- Content licensing/rights (NO-2) — outside the system by assumption.
- Payments, analytics SaaS, social (NO-1/4/5).
- Mobile app shells (NO-3) — the responsive web app *is* the product surface.
- Multi-region / multi-tenant (NO-5, NO-8).

## 5. Deployment Context

Single VM, Docker Compose: `caddy` (public), `app`, `db`, optional `collector` (private network). Cloud: S3/R2 endpoint (+ SMTP at VS-9). Full topology: DEPLOYMENT.md §1; model: ADR-009.
