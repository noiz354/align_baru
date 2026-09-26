# ADR-004: Object Storage

Status: Accepted
Date: 2026-09-26

## Context

Page images (AVIF/WebP/JPEG variants), covers, and upload staging must be durably stored, cheaply delivered, and swappable between environments: MinIO in local dev, Cloudflare R2 (zero egress) or AWS S3 in production. The app must never couple to one vendor.

## Decision Drivers

1. Protocol portability (R2/S3/MinIO behind one interface).
2. Egress cost — an image reader is egress-heavy; R2's zero-egress model is a major operational cost driver.
3. Multipart/presigned uploads (FR-UPLOAD-008).
4. Mature, maintained client library.
5. The application layer never sees vendor SDKs (dependency rule).

## Options Considered

### Option A — S3 protocol via `@aws-sdk/client-s3` behind `ObjectStoragePort`

One client for AWS S3, Cloudflare R2, MinIO (all speak S3). 3.1141.x (Sept 2026), very actively maintained, Apache-2.0, works on Node 24. Port interface in `src/shared/contracts/storage.ts` (put/get/delete/head/multipart/presign + lifecycle).

### Option B — Vendor-specific SDKs (R2 via `@aws-sdk` anyway; GCS `@google-cloud/storage`)

No benefit: R2 already uses the S3 SDK; GCS would add a second SDK and a second code path for zero product value.

### Option C — Local filesystem storage

Rejected: no durability guarantee, no versioning, no multipart, breaks any horizontal scaling, and backup story is hand-rolled. Acceptable only as a unit-test fake (in-memory), never in dev/prod.

### Option D — Serve images directly from a CDN (store only in CDN)

Rejected: no durable source of truth, no re-ingest (FR-UPLOAD-009), no staging area, vendor lock-in on the data itself.

## Decision

**S3 protocol** as the storage contract. Client: `@aws-sdk/client-s3` 3.1141.x (PLANNED install at T-UPLOAD-006). Implementation lives in `src/server/storage/object-storage.ts` behind `ObjectStoragePort`.

Environments:
- Dev: MinIO (`minio/minio`) in compose; bucket `yomi-media`.
- Production default: Cloudflare R2 (zero egress) — app-relative URLs `/media/{assetKey}` are proxied through the app in v1 (FR-MEDIA-001/003), so egress cost appears only if we later cut the CDN/proxy path (scale option, ARCHITECTURE.md §8.2).
- Production alternative: AWS S3 (same code, different endpoint/credentials).

Bucket layout (physical detail, hidden behind asset keys — NFR-SEC-010):
- `pages/{chapterId}/{pageKey}.{avif|webp|jpeg}`
- `covers/{mangaKey}.{webp|jpeg}`
- `staging/{jobId}/...` (24 h lifecycle purge, NFR-DATA-005)

## Consequences

### Positive
- Environment portability: same binary works on MinIO/R2/S3 via env (NFR-OPS-002).
- Multipart + presigned parts (FR-UPLOAD-008) come from the SDK, not hand-rolled.
- Vendor-neutral: storage swap is an env change + smoke test, not a release.

### Negative
- App-proxied media means the Node process serves image bytes in v1 → memory/CPU cost on large chapters (mitigated by streaming, no buffering — `server/media` contract; scale path §8.2 removes the proxy).
- Two more credentials to manage (storage keys) — secrets policy applies (NFR-SEC-009).

## Risks

- **R1:** S3-protocol drift between MinIO and R2 (e.g., multipart edge cases). → Integration tests run the same suite against MinIO (CI) and a live R2 bucket in the pre-prod environment (T-PROD-006).
- **R2:** SDK surface is large; accidental client-side import. → ESLint boundary rule: only `server/storage` may import `@aws-sdk/*`.
- **R3:** Egress/CPU cost of proxied media at scale. → Measured in VS-4 (T-PERF-005); CDN direct path is a documented scale option.

## Mitigations

Port isolation + boundary lint; streaming responses (never buffer full images in Node); presigned URLs only for server-internal use in v1 (public delivery stays app-mediated, FR-MEDIA-003); staging lifecycle rule (24 h).

## Revisit When

- Media proxy cost > ~15% of app CPU at target scale → cut CDN direct delivery (new ADR amendment).
- A provider with a materially better image-variant story (e.g., server-side transforms on R2) is adopted → re-open variant pipeline (ADR-005 interaction).

## References

- docs/research/2026-stack-validation.md (object storage section, ref [14])
- ARCHITECTURE.md §6, DATA_MODEL.md §10 (asset keys), ADR-005 (variants), ADR-009 (topology)
