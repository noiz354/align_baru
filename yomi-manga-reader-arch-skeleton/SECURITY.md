# SECURITY.md

Date: 2026-09-26 · Status: Authoritative. Per-threat detail with verification strategies lives in THREAT_MODEL.md. Requirement refs: NFR-SEC-*, NFR-DATA-*, NFR-OBS-006.

## 1. Threat Posture Summary

Yomi is a **self-hosted, single-collection** app: public read access to published content, authenticated private data (progress/library/bookmarks/history), and a small admin class. The highest-risk surfaces, in order:

1. **Upload pipeline** (untrusted files from the admin — Zip Slip, bombs, MIME spoofing, path traversal).
2. **AuthN/authZ** (session theft, IDOR on private data, privilege escalation to admin).
3. **Media delivery** (unsafe file delivery, layout leakage, cache poisoning).
4. **API** (rate abuse, injection, SSRF via URL fields — minimized by design: no user-controlled URLs).
5. **Supply chain** (npm, Docker base images).

## 2. Trust Boundaries

| Boundary | Crosses | Controls |
|---|---|---|
| B1 Internet → edge (Caddy) | untrusted traffic | TLS 1.2+, HSTS, security headers, backstop rate limiting, request-size caps (128 MB body max = upload limit) |
| B2 Edge → Next.js | (same host) | body re-validation, JSON-only API content types, Origin check on mutations (NFR-SEC-004) |
| B3 Web layer → features | — | typed inputs only (Zod at the API edge); no raw request objects below the web layer |
| B4 Features → ports | — | dependency rules (features never touch SQL/storage/SDKs); ports validate domain invariants |
| B5 server/db → PostgreSQL | SQL | parameterized Drizzle calls only (NFR-SEC-015); least-privilege DB role; no `SUPERUSER` |
| B6 server/storage → S3 | network | scoped credentials (bucket-only, least-privilege policy), TLS, no public bucket — delivery is app-mediated (FR-MEDIA-003) |
| B7 Upload intake → media pipeline | **untrusted bytes** | full upload validation contract (NFR-SEC-007/008) — see §6 |
| B8 App → telemetry collector | internal | no PII in payloads (NFR-OBS-006) |

## 3. Authentication & Session Security (ADR-006)

- Passwords: Argon2id (m=65536 KiB, t=3, p=4); parameters encoded in the stored hash; re-hash-on-login upgrade path (NFR-SEC-001).
- Sessions: 256-bit random tokens, HttpOnly + Secure + SameSite=Lax, Path=/; idle 30 d sliding / absolute 90 d; rotation on login; server-side revocation (NFR-SEC-002/003).
- CSRF: SameSite=Lax blocks cross-site POST cookies; all mutating handlers additionally verify `Origin` (and `Referer` fallback) equals the app origin (NFR-SEC-004).
- Rate limits (NFR-SEC-005): login 10/min/IP & 5/min/account; register 5/h/IP; reset 3/h/IP. Uniform "invalid credentials" response (no enumeration).
- Authorization: every private-data API re-checks authN; every admin API re-checks role **in the handler** (middleware is UX-only). Object-level: every query is scoped by the caller's user id — no "fetch by id then hope" patterns (IDOR control; verified by the authorization matrix test, T-SEC-003).
- Roles: `reader` | `admin`; role changes and disables are audited (FR-ADMIN-007); last-admin guard (EC-ADM-04).

## 4. Web Application Controls (OWASP mapping)

| OWASP Top 10 (2021) class | Yomi control | Refs |
|---|---|---|
| A01 Broken Access Control | scoped queries, role re-check in handlers, authorization matrix tests | T-SEC-003, THREAT T-04 |
| A02 Cryptographic Failures | Argon2id, TLS everywhere, token entropy, no secrets in client | NFR-SEC-001/002/009 |
| A03 Injection | parameterized ORM only; no raw string SQL; Zod-validated inputs; strict CSP | NFR-SEC-015, T-SEC-002 |
| A04 Insecure Design | threat model (this doc set); publish = visibility flag, not data op; idempotent progress | THREAT_MODEL.md |
| A05 Security Misconfiguration | minimal headers/defaults; env-validated config (fail fast); least-priv DB/storage roles | T-SEC-005 |
| A06 Vulnerable Components | lockfile, `npm audit` blocking high/crit in CI, dependency review, pinned images | NFR-SEC-013, T-SEC-006 |
| A07 Auth Failures | §3 above | — |
| A08 Integrity Failures | signed/typed responses, content-type options, no user HTML, immutable assets | NFR-SEC-016 |
| A09 Logging Failures | audit log (admin), structured app logs, alert thresholds; no PII | NFR-OBS-*, NFR-SEC-012 |

## 5. Headers & Transport (NFR-SEC-011)

Set at the edge (Caddy) and re-asserted in-app (belt & braces):
- `Content-Security-Policy: default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` — no inline scripts (Next.js nonces only where unavoidable; CSP is tuned at T-SEC-001, never relaxed past self-origin).
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=()`.
- `nosniff` + explicit `Content-Type` on all API responses (JSON) and media (per format).

## 6. Upload Security Contract (NFR-SEC-007/008) — the highest-risk surface

Authoritative sequence (implemented by `features/uploads.prepareChapterUpload` + `server/media`, tasks T-UPLOAD-014/015/002/003/005):

1. **Intake:** only admins; multipart ≤ 500 MB total, ≤ 100 MB per part, ≤ 500 files; content-type sniffed (magic bytes), not trusted.
2. **Staging:** written to `staging/{jobId}/` (private prefix); 24 h purge.
3. **Container validation (ZIP):** PK magic; central directory parsed with entry-count cap (500) and **streaming** size caps (decompression bomb: cumulative decompressed bytes > 500 MB → abort); no directories with `..`, no absolute paths, no backslash-absolute, no symlink/hardlink entries (Zip Slip controls).
4. **Per-file:** extension **and** magic-byte check must agree with an allow-list (jpg, png, webp, gif, avif, tiff, bmp); reject 0-byte; decode-cap pre-check: dimensions ≤ 10,000 px per side (via header parse where possible, else post-decode guard) before heavy memory use.
5. **Decoding:** sharp with `limitInputPixels`; decode failure → typed `UPLOAD_IMAGE_DECODE`.
6. **Normalization:** strip all metadata (EXIF GPS, ICC, profiles) — no hidden data leaves staging (NFR-SEC-010/016).
7. **Commit:** storage writes + DB transaction; asset keys are random (FR-MEDIA-003) and never derived from the uploaded filename (filename is display-only, truncated, sanitized).
8. **Job state:** every rejection is a typed `UPLOAD_*` code with a human-readable message; audit event on failure (NFR-SEC-012).

Verification: dedicated attack-fixture suite (T-UPLOAD-015) — Zip Slip, symlink entry, 600 MB bomb, 501 files, 110 MB file, 9999×9999 image, spoofed `.jpg` containing a script, path-`..` entry — each must fail with its typed code and zero side effects.

## 7. Media Delivery Security (FR-MEDIA-*)

- Bucket is **private**; delivery only through `/media/{assetKey}` → DB lookup (`ix_pages_asset_key`) → storage stream. An unlisted key is 404. No signed URLs exposed to the browser in v1 (public content by design; unguessable keys are the access control for anonymous reading).
- `Content-Disposition: inline` with safe content-type; `X-Content-Type-Options: nosniff`; no directory listing possible (key lookup, not path).
- Immutable cache headers on variants (versioned keys, NFR-PERF-013) — also defeats cache-poisoning of *different* content (keys never change content).
- Error bodies for media: 404 with no asset metadata; no storage error passthrough (STORAGE_* codes, THREAT T-10).

## 8. Data & PII (NFR-SEC-014)

- PII = email + display name + (derived) reading behavior. Nothing else collected (no analytics SDKs, no trackers).
- Logs/traces: emails redacted at the logger root; user ids used only pseudonymously (NFR-OBS-006).
- Account deletion (FR-AUTH-005) cascades private data; audit rows retain provenance without identity.
- Backups contain PII → backup artifacts use the same secrets/disk hygiene as the DB (DEPLOYMENT.md §6).

## 9. Secrets Management (NFR-SEC-009, NFR-OPS-006)

- Inventory: `SESSION_SECRET`, `DATABASE_URL`, storage keys (`S3_ACCESS_KEY_ID/SECRET/ENDPOINT/BUCKET/REGION`), `MAIL_*` (VS-9), `OTEL_*` (optional), `APP_ORIGIN`.
- Delivery: host-injected env (compose `environment` from a host-side `.env` **outside** the repo); CI secrets via the provider's secret store.
- Rules: never in code, logs, responses, test fixtures, or the repo (including git history — pre-commit check); rotation procedure in RUNBOOK.md.
- Session secret: 256-bit; rotation invalidates all sessions (accepted, documented in RUNBOOK).

## 10. Supply Chain (NFR-SEC-013)

- `package-lock.json` committed; installs are `npm ci` only.
- CI: `npm audit --audit-level=high` blocking; Renovate-style pinned updates with review for new packages (CONTRIBUTING.md).
- Docker: pinned base images (node:24-alpine), layer caching, non-root, `npm ci` from lockfile.
- New dependency policy: must appear in the research doc registry (SELECTED/PLANNED) or get an ADR note — no drive-by packages.

## 11. Incident Response (summary — full procedure in RUNBOOK.md §8)

1. Detect: alerts (OBSERVABILITY.md §5) or manual.
2. Contain: rate-limit/edge rules first; disable user / roll back image if app-level.
3. Evidence: preserve logs (they lack PII by design — note the constraint), audit log is append-only.
4. Eradicate/Recover: patch, rotate affected secrets (RUNBOOK §8.4), restore from backup if data-tampering suspected.
5. Report: internal post-mortem; if content rights are implicated (e.g., unauthorized upload path), notify the rights holder per their agreement.

## 12. Security Verification Plan (what "done" means)

- Authorization matrix test: every route × {anonymous, reader, admin, disabled user} → expected status (T-SEC-003).
- Upload attack-fixture suite green (T-UPLOAD-015).
- OWASP ZAP baseline scan on the dev environment (T-SEC-007), no high findings.
- Threat-model verification pass: every row in THREAT_MODEL.md has a verification result (T-SEC-007 gate for GA).

## 13. Skills

These skills are advisory execution aids. A skill never lowers a control, a boundary, or a parameter value in this document; on any conflict this document is authoritative and the difference is recorded as a `spec-question` (AGENTS.md §6, §8). Routing per task family is in SKILLS.md §3; the skills deliberately excluded are listed in SKILLS.md §6.

- **`security-and-hardening`** — load it whenever a task creates a new trust boundary (§2, B1–B8) or a new input surface (upload intake, auth, admin); the §6 upload contract is the reference shape, not a starting suggestion.
- **`backend-contract-testing`** — conformance of the implemented surface to `API_CONTRACT.md`, including the uniform-error and status-code rules the §12 authorization matrix asserts.
- **`backend-structured-logging`** — the audit trail (§3 role changes, §4 A09, NFR-SEC-012) and the redaction rules in §8: PII never appears in logs or traces, and redaction is verified, not assumed.
