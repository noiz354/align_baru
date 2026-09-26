# ADR-0013 — S3-compatible, private object storage with presigned access

- Status: Accepted · Date: 2026-09-26 · Deciders: SRE, Security, Media architect
- Requirements affected: FR-AUDIO-006/011/017, NFR-SEC-009 · Related: ADR-0008, `RETENTION.md`, `docs/media/STORAGE.md`

## Context

Audio must be stored somewhere durable, cheap per GB, streamable, and accessible to a worker
for processing. The system must not become a file server, and voice recordings must never be
publicly enumerable. Uploads arrive from browsers on unstable mosque networks, in thousands of
small chunks per session.

## Decision

- Use the **S3 API** as the storage interface via `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`. Deployments choose MinIO (self-hosted, dev and small
  installs) or an S3-compatible managed service (Cloudflare R2, Backblaze B2, AWS S3).
- **All buckets are private.** No public bucket, no public object ACLs, ever.
- Browsers **never receive storage credentials**. Downloads use **short-lived presigned GET
  URLs** (5–15 min) issued by the server *after* an authorization decision. Uploads use
  **presigned PUT/POST per chunk** with a short expiry, or stream through the app for small
  payloads (either is acceptable; the default is server-mediated chunk upload for validation
  and metadata integrity, with presigned uploads as the scaling path).
- Key layout is deterministic and organization-scoped:
  `audio/{organizationId}/{eventId}/{sessionId}/{sequence}.part`,
  `audio/{organizationId}/{eventId}/{assetId}/{kind}.{ext}`,
  `exports/{organizationId}/{eventId}/{exportId}.csv`, `artifacts/...` for provider payloads.
- Objects carry metadata (`sessionId`, `sequence`, `sha256`, `durationMs`, `contentType`) and
  are verified by hash on assembly.
- Lifecycle (delete raw chunks after assembly, delete transcription derivatives after
  transcription) is driven by **our retention job**, not by provider lifecycle rules — because
  provider feature support varies (tagging/versioning/notifications are not universal, ADR-0013
  alternatives).
- Storage access is mediated by an `ObjectStorage` port so the provider can change.

## Alternatives considered

- **Public bucket with unguessable keys ("security by obscurity").** *Costs:* keys leak through
  referrers, screenshots, shared links, browser history; deleted-content obligations become
  unenforceable. *Rejected outright* — recordings are personal data.
- **Serve audio through the app process.** *Gains:* simple authorization. *Costs:* Node process
  streaming large media, bandwidth through the app, no range-request efficiency, and scaling the
  app for media traffic. *Rejected as the primary path* (kept for tiny exports and
  policy-restricted playback where we want inline access logging).
- **Local filesystem volumes.** *Costs:* loses multipart/resumable upload, makes durability a
  VM problem, complicates the two-process topology and backups. *Rejected as primary*
  (documented as a degraded single-node option only with an explicit ADR amendment).
- **Provider-specific SDK features (S3 tags, event notifications, object lock).** *Rejected as
  dependencies:* R2 lacks tagging and S3 notifications; versioning support varies. We manage
  lifecycle in Postgres.

## Consequences

**Positive:** durable, cheap, scalable storage; direct browser uploads possible without
credentials; authorization lives with the app; provider portability; range requests work for
long recordings.

**Negative:** presigned URLs are bearer capabilities for their lifetime — they must be short,
audited, and never logged; the app must handle storage unavailability explicitly
(`FAILURE-MODEL.md` F6); hash verification is our job.

**Neutral:** storage cost is now a first-class product concern (`OPERATIONS.md` §Cost), because
two hours of audio per event per week adds up.

## Enforcement

- A test asserts no bucket policy grants public read (deployment check task `T-OPS-006`).
- A test asserts preset URLs expire within the configured window and that a request for another
  organization's asset is denied before signing.
- No storage key may be constructed from user input without validation (path traversal).
- Logs must not contain presigned URLs (`OBSERVABILITY.md` §Forbidden attributes) — they are
  credentials.

## Revisit trigger

Reopen if: storage cost per event exceeds the documented ceiling; a deployment requires
on-premise-only storage with no S3 implementation (then document a filesystem adapter with its
own backup story); or provider limitations block a required capability.
