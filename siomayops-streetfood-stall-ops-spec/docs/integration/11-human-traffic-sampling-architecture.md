# Page 11 — Human traffic sampling architecture

**Status:** Pilot implementation present; production release blocked. **Task T-TRAFFIC-001 remains NOT DONE.**

## Request/data flow

```text
/operator/traffic-sampling
  └─ browser UI
     ├─ GET /api/v1/operators/me/traffic-sampling
     │   └─ session → authorize(location:view, self)
     │       → getTrafficSamplingPage → current active shift/location + same-location history
     ├─ explicit “Mulai rekam 10 detik” tap only
     │   └─ capture.ts → getUserMedia(video, audio:false) → MediaRecorder → local preview
     ├─ optional multipart video upload + Idempotency-Key
     │   └─ session → authorize(evidence:upload, self)
     │       → WebM/EBML/size/declared-duration validation → private local disk
     │       → short-lived metadata in trafficVideoAssets
     └─ manual count/note + client request ID
         └─ session → authorize(location:view, self)
             → active-location resolution from stored shift → derive band
             → file-backed trafficSamples + anonymous system audit event
             → refreshed same-location read model
```

There is intentionally **no** video read/download API, no video processing service, and no raw clip access for HQ/supervisors/auditors. The video is linked temporarily to a result only by a random media/sample ID. Sample rows have no `operatorId` or `shiftId`; timestamps are stored at an hour boundary. The outlet/location and exact count remain sensitive operational data and are not emitted to analytics.

## Browser permission boundary

The app-wide `Permissions-Policy` continues to deny camera and microphone. Only `/operator/traffic-sampling` overrides camera to `self`; that header does not start the camera. The only `getUserMedia` call lives in `src/app/operator/traffic-sampling/capture.ts`, invoked from the explicit button, and requests `audio: false`. `/operator/location` remains camera-disabled. CSP permits `blob:` only for local media preview; uploaded blobs are not rendered or downloaded.

## Persistence and ownership

| Concern | Pilot implementation | Production status |
| --- | --- | --- |
| Authoritative metadata store | Existing file-backed `memoryStore`, persisted atomically to `data/db.json`; sample and media maps are scoped by organization | Production PostgreSQL repository/migration not implemented |
| Raw media | `SIOMAYOPS_PRIVATE_MEDIA_DIR` (default ignored `data/private-media/traffic`), directory mode 0700, object mode 0600, random UUID filename | S3-compatible private bucket/ACL, encryption, replica/backup expiry and deletion evidence missing |
| Read path | Server-side bounded query by session organization and server-derived active selling location; max 10 rows | Production repository/query plan pending |
| Write path | Zod contract → self-scope authorization → current shift/location from Task 10 → domain band derivation → store map; result has no operator/shift fields | Production identity/migration transaction and concurrency control pending |
| Idempotency | Client request UUID for result; UUID `Idempotency-Key` for upload; idempotency index contains organization+random key and returns prior result | Cross-process durable uniqueness requires database constraints/transaction |
| Retention | Purge on Page 11 reads/writes, process startup via store loading, and a 15-minute unref'ed in-process timer; media metadata is detached from sample on purge | Not a reliable external scheduler; no backup deletion proof; production flag remains closed |

The Drizzle schema catalogue now describes `traffic_samples` and `traffic_video_assets`; this checkout has no migration directory/convention, and runtime does not use that schema. Do not treat the schema definitions as a deployed migration.

## Band and history behavior

The operator supplies an integer count from 0–500. The server derives `QUIET` (0–4), `STEADY` (5–9), `BUSY` (10–19), or `VERY_BUSY` (20–500). History is limited to the active selling location and the latest 10 records; no client-supplied location is accepted. Notes are optional, capped at 240 characters, and intentionally excluded from logs/analytics.

## Production gate

Capture, upload, and result writes require `TRAFFIC_SAMPLING_ENABLED=true` in non-production. This checkout unconditionally rejects these operations when `NODE_ENV=production`; the future approval/purge flags are not an enablement path yet. A future release must implement approved privacy and verified deletion gates; environment flags alone are not evidence of approval or deletion. Production also requires an actual-duration parser/validator, a streaming upload/body-size limit, persistent auth, a private object-storage adapter, a reliable scheduled purge including backup replicas, and approved DPIA/re-identification review.

## UI-to-persistence data contract

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
| --- | --- | --- | --- | --- | --- |
| Current outlet and shift | Existing Page 10 operator context | `shifts`, `locationReports`, `sellingLocations` | `GET /operators/me/traffic-sampling` → `getOperatorLocationContext` | Authenticated operator self; session-derived | Implemented in pilot |
| Previous samples | `getTrafficSamplingPage` bounded read model | `trafficSamples` map; same location, latest 10 | `GET /operators/me/traffic-sampling` | Session org + server-derived current location | Implemented in pilot |
| Start/cancel video | Browser `capture.ts` / `MediaRecorder` | No persistence until upload; blob stays in browser memory | Explicit button; no API starts camera | Self UI; camera permission only on Page 11 | Implemented in UI; real browser capture proof pending |
| Upload status/metadata | Upload response + sample `videoStatus` | `trafficVideoAssets` map + private local media file | `POST /operators/me/traffic-samples/uploads` | OPERATOR `traffic-sample:create` + `evidence:upload`; session org/current location | Pilot only; no playback/read route |
| Manual count and band | `deriveTrafficBand` domain rule | `trafficSamples` | `POST /operators/me/traffic-samples` | OPERATOR self; location from active shift, never request body | Implemented in pilot |
| Manual note | Zod bounded optional note | `trafficSamples.note` | `POST /operators/me/traffic-samples` | Same as sample result; shown only in same-location operator history | Implemented in pilot |
| Analytics | Allowlisted Pino event contract | Structured app logs | Page, event, upload, and write routes | No operator/shift/location IDs or exact result | Implemented; no downstream analytics warehouse |
| Raw media deletion | `purgeExpiredTrafficMedia` | File system + temporary media metadata | Startup/read/write and 15-minute in-process timer | System-only; no read/download route | Pilot helper only; production/backup proof missing |
