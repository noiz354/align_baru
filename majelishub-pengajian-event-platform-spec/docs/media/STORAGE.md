# STORAGE

Requirements: NFR-OPS-005, NFR-SEC-009, FR-AUDIO-014 · ADR: ADR-0013 (private buckets + short presigned
URLs) · Related: `RETENTION.md`, `docs/media/AUDIO-PIPELINE.md`, `docs/media/CHUNK-PROTOCOL.md`

---

## 1. Buckets

| Bucket (env var) | Content | Access | Lifecycle |
|---|---|---|---|
| `S3_BUCKET_UPLOADS_PARTIAL` | Raw chunk `.part` objects during and shortly after a session | Private; write via the app, read only by the media worker | Objects deleted after successful assembly verification + 14 days maximum |
| `S3_BUCKET_AUDIO_MASTER` | Assembled, normalised, **seekable** master | Private; never public | The one irreplaceable class: mirrored per backup policy; retention default 24 months (configurable 6–60) |
| `S3_BUCKET_AUDIO_DERIVED` | 16 kHz ASR inputs, waveform peaks, preview clips | Private | Regenerable; 30 days for ASR inputs, peaks kept while the master lives |
| `S3_BUCKET_EXPORTS` | Generated attendance/audit exports | Private; signed, short-lived | Deleted after 7 days (verified by job) |

Rules:

1. **No bucket is ever public.** All access is through permission checks plus short-lived signed URLs
   (default 300 s, hard cap 900 s). Signed URLs are never logged and never placed in a page HTML served
   publicly.
2. **Object keys are derived from ids, never from client input:** `audio/{organizationId}/{eventId}/{sessionId}/{sequence}.part`,
   `.../master.ogg`, `derived/{sessionId}/asr-16k.flac`, `exports/{organizationId}/{exportId}.csv`.
   No user-supplied filename ever appears in a key (path traversal and overwrite risk).
3. **The application must not depend on provider-specific features.** Object tagging, bucket
   versioning, object-lock, lifecycle rules and event notifications are *not* assumed to exist: R2
   returns 501 for tagging, others differ. Housekeeping is done by our own jobs, with provider features
   used only as defence in depth where available.
4. **Path-style addressing configurable** (`S3_FORCE_PATH_STYLE=true` for MinIO); endpoint and region
   configurable; SSE enabled where supported.
5. **Content types are set explicitly** on write (`audio/ogg`, `audio/webm`, `application/octet-stream`
   for parts, `text/csv` for exports), and downloads for non-media files are sent with
   `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
6. **Checksums:** the app records SHA-256 of every object it writes; a verification job samples objects
   and re-hashes them monthly (bit-rot and silent corruption detection).

## 2. Credentials and access

| Principal | Permission | Notes |
|---|---|---|
| App container | Put/Get/Delete on partial + derived + exports; Put on master | No list-all; scoped by prefix where the provider supports it |
| Worker container | Get on all buckets; Put on master/derived; Delete on partial | Needed for assembly/processing |
| Media container | Get on partial; Put on master/derived (via the worker's handed-off signed URL where possible) | The most exposed component; receives the narrowest long-lived credentials possible |
| Humans | Never direct credentials | Only signed URLs, issued per request, per object, short-lived |
| Backups | Separate read-only credential | Used by the mirror job |

Rotation: storage keys rotate per procedure (`RUNBOOK.md` RB-14 / `OPERATIONS.md` §7); old keys are
revoked after verification.

## 3. Signing rules

1. Created only after `requirePermission(...)` succeeds for the specific resource.
2. TTL: the minimum needed (default 300 s; ≤ 900 s hard cap). Long playback is handled by re-issuing on
   expiry (the player fetches a new URL), not by long TTLs.
3. Scope: one object per URL (no prefix/bucket-wide grants).
4. Response is never cached by intermediaries (`Cache-Control: private, no-store` on the API response).
5. The URL never appears in the page source of a public page before an explicit user action (no
   pre-signing on render for signed content).
6. Revocation reality: a signed URL remains valid until expiry — documented as an accepted residual risk
   (≤ 15 minutes, `THREAT_MODEL.md`). Withdrawal therefore also flips the **permission** state so new
   URLs cannot be issued.

## 4. Housekeeping jobs (ours, not the provider's)

| Job | Cadence | Action | Verification |
|---|---|---|---|
| `partial-cleanup` | daily | Delete partial chunks for sessions whose assembly verification passed, and any partial object older than 14 days | Count of deleted vs expected; alert on mismatch |
| `assembly-orphan-check` | daily | Chunks without a session; sessions without chunks | Report, never auto-delete without a verified reason |
| `derived-prune` | daily | Delete ASR inputs older than 30 days | Count verification |
| `export-cleanup` | daily | Delete exports older than 7 days | Zero expired exports remaining |
| `master-mirror` | daily | Copy/verify master objects into the backup location | Per-object hash verification |
| `object-hash-audit` | monthly (sampled) | Re-hash a random sample (≥ 20 objects or 1%) | Any mismatch is an incident |

All jobs are idempotent, bounded in batch size, and write an evidence record with counts only.

## 5. Failure handling

| Failure | Behaviour |
|---|---|
| Storage unreachable during recording | Uploads fail closed; client keeps the local queue; UI says "belum terkirim" (never success) |
| Storage unreachable during assembly | Job retries with backoff; session stays `UPLOADED`; no partial master is produced |
| Quota exhausted | Writes fail with a distinct error; alert to the platform administrator; uploads pause rather than degrade silently |
| Object missing but referenced | The asset is marked `FAILED(OBJECT_MISSING)`; the master mirror is the recovery path (RB-18); never substitute a different object |
| Signed URL replay | Bounded by TTL and per-object scope; monitored via access logs (provider-side) — accepted residual |
| Provider incompatibility (tagging/versioning) | App never depends on them; a startup capability probe logs what is unavailable rather than failing |

## 6. Local capability probe (startup, non-fatal)

On boot the app probes: put/get/delete a probe object in the partial bucket, SSE support, path-style
compatibility, and whether tagging/versioning respond. Results are logged once and shown on the operator
health page. A deployment with a reduced feature set (e.g. R2 without tagging) is fully supported by
design — the probe exists to make the difference visible, not to gate startup.

## 7. Cost posture

Master audio at 48 kHz Opus ≈ 100–150 MB per 2-hour event; derived files add ~30–40 MB; partial chunks
are transient. Cost levers, in order of effect: master retention window (privacy-visible, so it is a
configuration with a notice check), ASR derivative retention, and export retention. Storage growth per
event is reported monthly (`ANALYTICS` cost card) so an operator can plan rather than discover.
