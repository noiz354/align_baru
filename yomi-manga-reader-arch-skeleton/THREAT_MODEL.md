# THREAT_MODEL.md

Date: 2026-09-26 · Method: STRIDE-flavored register over the trust boundaries in SECURITY.md §2. "Planned mitigation" is a design commitment; "Verification" names the test/step that proves it. No mitigations are implemented yet.

Legend: Impact: C=Confidentiality, I=Integrity, A=Availability. Related reqs/tasks in the last columns.

## T-01 — Cross-Site Scripting (reflected/stored/DOM)

- **Affected boundary:** B2/B3 (API responses, rendered pages); DOM (reader state).
- **Attack scenario:** Admin stores a synopsis/title like `<img src=x onerror=...>` or a chapter title with HTML; or an attacker who gains admin writes payloads into catalog fields; or a crafted deep link injects into a client-rendered string.
- **Impact:** C (session is HttpOnly so no direct theft) + I (DOM manipulation, fake UI, admin action forgery via clickjacking-adjacent UI).
- **Planned mitigation:** No raw HTML anywhere: all user/admin strings rendered as text (NFR-SEC-016); strict self-only CSP with no inline eval (NFR-SEC-011); Zod length/format validation on all string inputs; React auto-escaping as the default.
- **Verification:** E2E renders a seeded malicious string and asserts it appears as literal text; CSP violation report check in CI (T-SEC-002); DOM-fuzz on reader deep links (E2E-READER-021).
- **Related:** NFR-SEC-011/016 · T-SEC-002, T-CATALOG-002 (input validation)

## T-02 — SQL Injection

- **Affected boundary:** B4/B5 (features → server/db → PG).
- **Attack scenario:** Search query `q' OR '1'='1`, sort parameter, or slug with SQL fragments reaches a string-built query.
- **Impact:** C/I (full DB read/write).
- **Planned mitigation:** Parameterized Drizzle calls only (NFR-SEC-015); sort/filter values whitelisted to enum values in Zod; search goes through the trigram GIN index with bound parameters; no dynamic table/column names from input.
- **Verification:** Static rule: drizzle is only importable in `server/db` (ESLint boundary, T-FOUND-011); integration fuzz on `/api/v1/search` with 50 injection payloads asserting 4xx/no-leak (T-SEARCH-005); DB role lacks DDL (T-SEC-005).
- **Related:** NFR-SEC-015 · T-FOUND-011, T-SEARCH-005, T-SEC-005

## T-03 — Broken Authentication / Credential Attacks

- **Affected boundary:** B1/B2 (auth endpoints).
- **Attack scenario:** Online brute force / credential stuffing on login; user enumeration via differing responses or timing; reset-token spraying.
- **Impact:** C/I (account takeover).
- **Planned mitigation:** Argon2id (NFR-SEC-001); rate limits 10/min/IP + 5/min/account (NFR-SEC-005); uniform errors and uniform timing (constant-time compare; no account-exists signal); reset tokens single-use/60-min (DATA_MODEL §17); failed-login counters → alert (NFR-OBS-007).
- **Verification:** Rate-limit integration tests (T-AUTH-010 test coverage), timing uniformity assertion (T-AUTH-013), reset-token single-use tests (T-AUTH-009 tests).
- **Related:** NFR-SEC-001/005 · T-AUTH-004/009/010/013

## T-04 — Broken Access Control / IDOR

- **Affected boundary:** B3 (all private + admin APIs).
- **Attack scenario:** Reader A requests `GET /api/v1/library`, `POST /api/v1/progress` with user B's id, or `GET /api/v1/progress?chapterId=...&userId=B`; or a reader calls `/api/v1/admin/manga` PATCH; or a disabled user continues with a live session.
- **Impact:** C/I (cross-user data theft/modification; privilege escalation).
- **Planned mitigation:** Caller identity always from the verified session — **never** from request body/query for private-data operations (API contract rule); queries scoped by `user_id`; admin role re-checked per handler; disabled users fail session validation on next request; IDOR 404 policy (no existence leak).
- **Verification:** Authorization matrix test — every route × {anonymous, reader, admin, disabled, other-user-id variants} (T-SEC-003); E2E-ADMIN/READER IDOR attempts (E2E-ADMIN-002, E2E-READER-019).
- **Related:** FR-AUTH-007/008, NFR-SEC-* · T-SEC-003, T-AUTH-007/008, T-LIB-009

## T-05 — Session Theft / Fixation

- **Affected boundary:** B1/B2 (cookie).
- **Attack scenario:** Session cookie intercepted (requires TLS termination failure), or attacker sets a known cookie pre-login (fixation), or a leaked long-lived JWT-style token stays valid.
- **Impact:** C/I (account takeover until expiry).
- **Planned mitigation:** HttpOnly+Secure+SameSite=Lax (NFR-SEC-002); TLS-only in prod; token rotated on login (fixation nullified); 30 d idle/90 d absolute caps; server-side revocation (ADR-006).
- **Verification:** Cookie flag assertions in E2E (E2E-AUTH-004); fixation test: set cookie → login → old cookie rejected (T-AUTH-006 tests); revocation test: logout → token rejected (T-AUTH-005 tests).
- **Related:** NFR-SEC-002/003 · T-AUTH-005/006, E2E-AUTH-*

## T-06 — CSRF

- **Affected boundary:** B2 (mutating endpoints).
- **Attack scenario:** Victim's browser auto-submits a form/JSON POST from an attacker site (e.g., force-logout, add-to-library spam, admin mutation if the admin is logged in).
- **Impact:** I (actions as victim).
- **Planned mitigation:** SameSite=Lax (blocks cross-site POST cookies) + Origin header verification on every mutating handler (NFR-SEC-004); no `text/html` responses to JSON endpoints.
- **Verification:** Integration test: POST without/with wrong Origin → 403 CSRF error; E2E cross-origin form attempt (T-AUTH-013 / T-SEC-003 coverage).
- **Related:** NFR-SEC-004 · T-SEC-001 (headers), T-AUTH-013

## T-07 — Privilege Escalation to Admin

- **Affected boundary:** B3 (admin APIs, user management).
- **Attack scenario:** Reader forges `role` in a register request; admin-role field accepted in an admin PATCH for a non-admin actor; last-admin self-demotion leaves the instance admin-less (DoS).
- **Impact:** I (full admin takeover).
- **Planned mitigation:** `role` never writable from non-admin APIs (Zod schemas omit it for public routes); role changes only via admin endpoint with audit (FR-ADMIN-007); last-admin guard (EC-ADM-04); audit events on every role change.
- **Verification:** Matrix test includes role-forgery payloads (T-SEC-003); last-admin guard unit test (T-ADMIN-006); audit assertions (T-ADMIN-007).
- **Related:** FR-AUTH-008/009 · T-ADMIN-006, T-SEC-003

## T-08 — Upload: Zip Slip / Path Traversal / Symlink

- **Affected boundary:** B7 (archive extraction).
- **Attack scenario:** ZIP with `../../etc/cron.d/x`, absolute path `/tmp/x`, or a symlink entry pointing outside the staging dir; extraction writes files outside staging or poisons other jobs' staging.
- **Impact:** I (arbitrary file write on the app host) + A.
- **Planned mitigation:** Streaming extraction with: canonicalized destination must start with the job's staging prefix (reject otherwise); no symlink/hardlink entries; no directory entries used as write targets; per-entry and total size caps (NFR-SEC-008); extraction runs as the app user (no setuid surfaces).
- **Verification:** Attack-fixture suite: Zip Slip, absolute path, symlink, backslash-absolute (T-UPLOAD-015) — each rejected with `UPLOAD_PATH_TRAVERSAL`/`UPLOAD_SYMLINK` and zero filesystem side effects (test asserts).
- **Related:** NFR-SEC-008, FR-UPLOAD-002/003 · T-UPLOAD-014/015, T-UPLOAD-005

## T-09 — Upload: Decompression Bomb / Resource Exhaustion

- **Affected boundary:** B7 (extraction + decode).
- **Attack scenario:** 10 MB ZIP → 500 GB decompressed; or a 2 GB PNG-in-ZIP; or 10,000-entry archive; or an image with 100,000 px dimension.
- **Impact:** A (host OOM/disk fill) + I (staging disk exhaustion).
- **Planned mitigation:** Streaming size caps (cumulative decompressed > 500 MB → abort; NFR-SEC-007); entry count cap 500; per-file 100 MB; dimension cap 10,000 px pre-decode where headers allow; sharp `limitInputPixels`; job-level timeout (processing ≤ 15 min) kills the job; staging on a size-limited volume (DEPLOYMENT.md).
- **Verification:** Bomb fixtures (500 MB decompressed from 10 MB; 501 entries; 9999×9999 image) in T-UPLOAD-015; resource monitor assertions (RSS/delta) in the test; timeout kill test (T-UPLOAD-003).
- **Related:** NFR-SEC-007/008 · T-UPLOAD-002/003/005/015

## T-10 — Upload: MIME Spoofing / Malicious Content

- **Affected boundary:** B7 (intake + decode), B6 (storage).
- **Attack scenario:** File named `page.jpg` containing HTML/JS or an executable; stored and later delivered with the wrong Content-Type → stored XSS or drive-by.
- **Impact:** C/I (XSS at readers), A.
- **Planned mitigation:** Magic-byte sniffing is authoritative (NFR-SEC-007); allow-list of image formats; decode must succeed as an image or reject; EXIF/metadata stripped; delivery Content-Type comes from the **stored** format, never the original filename; `nosniff` on media (SECURITY.md §7).
- **Verification:** Spoof fixtures (script-in-.jpg, exe-in-.png) rejected `UPLOAD_BAD_MIME` (T-UPLOAD-015); media delivery content-type assertions (E2E-READER-018); CSP backstop (T-SEC-001).
- **Related:** NFR-SEC-007, FR-UPLOAD-002 · T-UPLOAD-002/004, T-UPLOAD-015

## T-11 — Unsafe File Delivery / Cache Poisoning

- **Affected boundary:** B6 (media delivery).
- **Attack scenario:** Attacker guesses/enumerates asset keys; or a proxy/CDN caches different content under one key; or a storage error leaks S3 XML with internal paths.
- **Impact:** C (content enumeration of unpublished/draft pages), I (cached-wrong-content).
- **Planned mitigation:** Random unguessable asset keys (FR-MEDIA-003, 128-bit); key lookup via DB (draft/deleted keys 404); immutable keys — content per key never changes (NFR-PERF-013) so cache poisoning is structurally blocked; storage errors mapped to `STORAGE_*` with no passthrough (API_CONTRACT §6).
- **Verification:** Fuzz 1k random keys → all 404 (E2E-READER-022); key-guessability audit (length/entropy check in T-UPLOAD-007); error-body leak test (T-OBS-004 chaos).
- **Related:** FR-MEDIA-003 · T-MEDIA-001 (within catalog/reader tasks), T-UPLOAD-007

## T-12 — SSRF

- **Affected boundary:** B6 (any outbound call driven by input).
- **Attack scenario:** A user/admin-supplied URL field causes the server to fetch internal addresses (metadata endpoint 169.254.169.254, localhost services).
- **Impact:** C/I (cloud metadata, internal ports).
- **Planned mitigation:** By design: **no user-controlled URLs exist** in v1 (covers are uploaded files, not fetched; no webhooks). The only outbound calls are to fixed, env-configured endpoints (DB, storage, OTLP, SMTP). If any URL-fetching feature is proposed later → new ADR + SSRF guard (private-range deny list) before implementation.
- **Verification:** Static: grep/CI rule that no `fetch`/HTTP client is called with a runtime-variable URL outside `server/` (T-SEC-005 audit step); re-verification whenever a URL feature is proposed.
- **Related:** NFR-SEC-009 (env) · T-SEC-005

## T-13 — Secrets Leakage

- **Affected boundary:** all (code, logs, errors, client bundles).
- **Attack scenario:** `.env` committed; session secret in an error stack; storage keys in a log line; token in a client bundle; backup artifact copied to an unencrypted location.
- **Impact:** C (full system compromise).
- **Planned mitigation:** Secrets only via env (NFR-SEC-009); logger redaction function (NFR-OBS-006) with tests; error responses never include stack traces (INTERNAL_* mapping, API_CONTRACT §6); bundle-scan in CI for the SESSION_SECRET pattern (T-SEC-006); backups encrypted at rest / private bucket (DEPLOYMENT.md §6).
- **Verification:** CI secret scan (gitleaks) on the repo (T-SEC-006); log-capture test asserting no secret patterns (T-OBS-003); error-body assertions across all typed errors (API contract tests).
- **Related:** NFR-SEC-009, NFR-OBS-006 · T-SEC-005/006, T-OBS-003

## T-14 — Logging Leakage (PII)

- **Affected boundary:** B8 (telemetry), logs, traces.
- **Attack scenario:** Email appears in an upload filename log; user id + reading behavior correlated in a public dashboard; beacon payloads contain content.
- **Impact:** C (privacy).
- **Planned mitigation:** Redaction at the logger root (email → hash8); user ids pseudonymous; beacon schema whitelists fields (NFR-OBS-007); dashboards internal-only (DEPLOYMENT.md).
- **Verification:** Log-redaction unit tests (T-OBS-003); beacon payload schema tests (T-OBS-007).
- **Related:** NFR-OBS-006, NFR-SEC-014 · T-OBS-003/007

## T-15 — Rate Abuse / DoS (API & upload)

- **Affected boundary:** B1/B2 (all endpoints), B7 (uploads).
- **Attack scenario:** Search hammering (DB cost), login brute force (T-03), upload flooding (disk/CPU), reader media enumeration (T-11).
- **Impact:** A (resource exhaustion), I (disk fill).
- **Planned mitigation:** In-app limits: search 30/min/IP, generic 300/min/IP, upload 2/h/account (NFR-SEC-006); edge backstop (Caddy) for bulk; upload staging size cap; media 404s are cheap (single indexed lookup); body size caps (128 MB).
- **Verification:** Rate-limit tests per endpoint class (T-AUTH-010, T-SEARCH-005, T-UPLOAD-013); load smoke at VS-11 (T-PROD-006).
- **Related:** NFR-SEC-005/006 · T-SEARCH-005, T-UPLOAD-013, T-PROD-006

## T-16 — Supply Chain Compromise

- **Affected boundary:** build (npm, Docker base).
- **Attack scenario:** Malicious/typosquatted dependency; compromised base image; lockfile tampering.
- **Impact:** C/I (build + runtime compromise).
- **Planned mitigation:** Lockfile + `npm ci`; `npm audit` blocking high/crit; pinned base images; new-dep policy (research registry, CONTRIBUTING.md); image build from lockfile only (NFR-SEC-013).
- **Verification:** CI gates (T-FOUND-011, T-SEC-006); quarterly dependency review (RUNBOOK standing task).
- **Related:** NFR-SEC-013 · T-FOUND-011, T-SEC-006

## T-17 — Account Deletion Incompleteness (privacy violation)

- **Affected boundary:** B4 (cascades), backups.
- **Attack scenario:** User deletes account; residual progress/history/rows remain and are later exposed (bug, backup restore, admin UI).
- **Impact:** C (privacy).
- **Planned mitigation:** Cascading FK deletes (DATA_MODEL §1) + explicit sweep in the deletion service (progress, history, library, bookmarks, sessions, prefs, tokens); audit rows retain `actor_email '<deleted>'` only; backups documented as a residual (RPO window, NFR-DATA-004/005).
- **Verification:** Deletion integration test asserting zero residual rows (T-AUTH-011); restore-drill check that a post-deletion backup behaves (RUNBOOK §4).
- **Related:** FR-AUTH-005, NFR-DATA-005 · T-AUTH-011

## T-18 — Clock Skew / Progress Tampering

- **Affected boundary:** B3 (progress API).
- **Attack scenario:** Client claims ancient `updated_at` to roll back another session's progress, or future-stamps to win LWW; two tabs race.
- **Impact:** I (user's own data only — low severity).
- **Planned mitigation:** Server timestamps only (NFR-DATA-003); LWW by server `updated_at`; idempotent identical updates; page index validated against chapter (invalid → 422 `READER_INVALID_PAGE`, never stored).
- **Verification:** Concurrency test (two sessions, interleaved writes, final state = latest server stamp) (T-READER-021 tests); invalid-page fuzz (T-READER-032 tests).
- **Related:** NFR-DATA-003, FR-READER-023 · T-READER-021/022/032

---

## Coverage Check

| OWASP class | Threats |
|---|---|
| XSS | T-01, T-10 |
| CSRF | T-06 |
| IDOR/BAC | T-04, T-07 |
| SQLi | T-02 |
| Session | T-05, T-03 |
| Upload/Traversal/Zip Slip/Bomb/MIME | T-08, T-09, T-10 |
| SSRF | T-12 |
| Unsafe file delivery | T-11 |
| Secrets/logs | T-13, T-14 |
| Rate abuse | T-15 |
| Supply chain | T-16 |
| Data privacy | T-17, T-18 |

GA gate (T-SEC-007): every row above has a green verification result or a documented, accepted residual with an owner.
