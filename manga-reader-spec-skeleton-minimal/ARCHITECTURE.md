# Architecture

## Decision summary
A modular monolith, server-rendered web application and PostgreSQL system. Next.js App Router serves routes and application boundary; feature modules own use cases/contracts; infrastructure adapters live only in server. PostgreSQL is system of record. Private S3-compatible object storage holds quarantined originals and derived assets. CDN/reverse proxy serves app and authorized media delivery. No microservices, queue, Redis, search engine, GraphQL, or Kubernetes initially.

## Context and topology
Browser → CDN/reverse proxy → Next.js web application → PostgreSQL / private object storage; telemetry exports OTLP to collector/backend. Image decoding/rendering in client; ingestion processing in controlled server worker/process (initially same deployable boundary, independently bounded execution). See architecture subdocs.

## Runtime and trust boundaries
Public browser is untrusted. Route/controller parses DTO and invokes application service; policy authorization is enforced in server service/use case; feature code depends on repository/storage/auth ports, never drivers. Infrastructure validates persisted ownership and safe media delivery. Upload bytes enter quarantine and are not public until validated/published. Database credentials and object credentials server-only. Do not expose raw object keys.

## Modules
auth (identity/session policy); catalog (public discovery/filter); manga (work, title, creator, genre/tag metadata); chapters (ordering/publication/page manifest); reader (presentation state contracts and navigation requirements, not persistence); library (owned collection/bookmarks/preferences); progress (resume/history); search (query contract/catalog search adapter); admin (editor use cases/policy); uploads (ingestion orchestration and statuses); media (asset descriptors/transforms/delivery policy); observability (telemetry interfaces). Shared types/contracts must not become a dumping ground.

## Deployment and data flow
See DEPLOYMENT.md and docs/architecture/data-flow.md. Public reads only published data; account writes require session and owner checks; admin write requires role+resource scope; upload staged and validated then publication switches visibility. No module may bypass application authorization using direct DB calls from UI.

## Requirement/decision links
Reader: FR-READER-001..014, ADR-007, T-READER tasks. Upload: FR-UPLOAD-001..004, ADR-004/005, T-UPLOAD. Auth: FR-AUTH-001, ADR-006. See traceability in docs/architecture/final-review.md.
