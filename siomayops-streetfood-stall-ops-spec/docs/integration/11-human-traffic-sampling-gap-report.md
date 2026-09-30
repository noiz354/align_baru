# Page 11 — Human traffic sampling gap report

**Task status: NOT DONE.** The UI and file-backed pilot API exist, but the canonical end-to-end and release criteria are not met.

## Implemented in this checkout

- `/operator/traffic-sampling` shows loading/error/empty/success states, session-derived active location/shift, bounded previous samples, manual count/note entry, local silent camera preview, upload status, and refreshed history.
- The browser camera is requested only after the explicit start button; audio is disabled and recording auto-stops before the 10-second ceiling. The client keeps video in memory until optional upload or cancellation.
- Same-origin routes require the development operator session, `OPERATOR` role, `location:view` or `evidence:upload`, and self scope. Organization, shift, and selling point are derived server-side; no caller-selected location is used.
- The server validates count/note, declared duration, payload size, MIME type and EBML signature; derives the traffic band; writes sample/result and private local video metadata; and emits safe structured events plus an anonymous system audit summary.
- File-backed `memoryStore` serialization includes the new sample and video maps. The media adapter writes opaque files outside Git and has a bounded deletion helper. Sample metadata omits operator/shift IDs and exact time is coarsened to an hour.
- Production sampling is unconditionally hard-disabled in this checkout; non-production requires an explicit opt-in flag.

## Blocking gaps before Task 11 can be DONE or production enabled

1. **Production authentication:** `AuthPort` is still a development fake and returns no production session.
2. **Production persistence/migration:** the actual runtime store is local file-backed JSON. Drizzle catalogue entries are not a migration and no PostgreSQL traffic repository/transaction has been implemented.
3. **Media duration trust:** the browser enforces a short recording window, but the API currently validates only the client-declared duration; it does not parse the encoded WebM duration. A forged client can misstate duration. Production remains disabled until actual duration is server-verified (or upload processing rejects unverified media).
4. **Upload body limit:** the route checks `Content-Length` when available and verifies size after `formData()` parsing. A streaming/proxy-enforced hard limit is needed to prevent oversized multipart bodies from being buffered first.
5. **Private production object storage:** local filesystem mode is private for the pilot, but no production bucket ACL, encryption/replica configuration, or no-HQ-access proof exists.
6. **Retention proof:** local opportunistic purge plus a process timer is not a durable scheduled job; no backup/replica deletion within 24 hours is verified. A persistent job, alerts, recovery drill and independent deletion evidence are outstanding.
7. **Privacy review:** the Page 11 DPIA is preliminary. DPO/privacy-owner approval, workplace/bystander notice review, and approval of R-27's provisional 90-day result retention are outstanding.
8. **Browser/runtime evidence:** no real browser has granted camera permission, recorded a clip, uploaded it, and proved the UI flow. Previous Playwright Chromium download failed with CDN TLS `ECONNRESET`; no camera E2E result is claimed.
9. **CI and repository checks:** local unit/integration/type/lint checks have run; the production build and static documentation/stub gates remain to be recorded. Existing non-Page-11 check failures must be separated from new failures.
10. **Runtime restart proof:** unit tests inspect the store and deletion behavior; a complete running-app create/reload/restart flow remains outstanding.

## Explicitly unsupported by design

- Camera/audio on page load, continuous feeds, playback/download after upload, face/person/biometric recognition, demographic or sensitive-attribute inference, computer vision, third-party media processors, model training, individual performance/attendance/discipline use, and HQ/supervisor raw-video access.
- The raw clip itself is not an estimator; the operator-entered count is the result.
