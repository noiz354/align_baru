# ADR-0020: Object storage via S3-compatible API + signed URLs

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-7
- **Area:** Platform
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Evidence photos (expense receipts, incident scenes) and exports need durable storage that is cheap, lifecycle-managed and not inside the database.

## Decision

Use the S3 API via `@aws-sdk/client-s3` against an S3-compatible provider (Cloudflare R2, MinIO self-hosted, Backblaze B2 or AWS S3). Clients upload via pre-signed PUT URLs with server-generated unguessable keys and type/size limits; downloads use short-lived pre-signed GET URLs. Lifecycle rules implement retention.

## Consequences

Positive: provider portability, zero-egress options reduce cost, database stays lean, retention automated at the bucket level. Negative: a second system to monitor; signed-URL handling is a security-sensitive surface requiring review.

## Alternatives considered

Storing evidence as bytea in Postgres (rejected: database bloat and backup cost); container-local disk (rejected: lost on redeploy); public buckets (rejected: IDOR class risk).

## Compliance impact

Retention rules (R-06/R-12/R-24) execute at the storage layer, with deletion logged; access is always via expiring URLs.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
