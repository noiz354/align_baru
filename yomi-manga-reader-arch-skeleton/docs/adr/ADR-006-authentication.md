# ADR-006: Authentication

Status: Accepted
Date: 2026-09-26

## Context

Email+password auth with server-side revocable sessions, admin role, rate limiting, CSRF defense, and a password-reset path. The app is a self-hosted single instance (ADR-009); there is no identity provider to lean on, and no JWT convenience we actually need.

## Decision Drivers

1. Server-side revocation (logout, disable, expiry) — mandatory (FR-AUTH-003/006/009).
2. No state in the client beyond an opaque cookie (XSS-resilient; NFR-SEC-002).
3. Modern password hashing (Argon2id — NFR-SEC-001).
4. Simple operational story (one table, one cookie, one sweep).
5. CSRF-safe by default in the SameSite=Lax + Origin-check model (NFR-SEC-004).

## Options Considered

### Option A — DB-backed sessions (PostgreSQL `sessions` table) + Argon2id

Opaque 256-bit token in an HttpOnly cookie; row in `Session` (DATA_MODEL §2) with idle + absolute expiry; sliding extension on activity; revocation = row delete. Hashing via `argon2` npm (Argon2id, m=64 MiB, t=3, p=4).

### Option B — JWT in HttpOnly cookie

Stateless, fast. Rejected: revocation requires a denylist (re-introduces state, weaker), token lifetime is fixed (no sliding), leakage of a long-lived token is unrecoverable, and "stateless" saves nothing for a single-instance app with a nearby database.

### Option C — Session store in Redis

Rejected: Redis is explicitly out of the default stack (brief); a PG table handles our session volume (thousands of sessions) trivially and backs up with everything else (NFR-DATA-004).

### Option D — OAuth/OIDC provider (Auth.js etc.)

Rejected for v1: the product is self-hosted and user accounts are local by design (NO-5 single instance). OAuth is a documented future option (Revisit When); the port boundary (`PasswordHasher`, `SessionRepository`) keeps it cheap to add.

## Decision

**Option A.** Components:
- `PasswordHasher` port (features/auth) ← `server/auth` implements with `argon2` (Argon2id; params fixed at m=65536 KiB, t=3, p=4; re-hash-on-login upgrade path when params change).
- `SessionRepository` port ← `server/auth` implements on PostgreSQL.
- Cookie: `yomi_session`, HttpOnly, Secure, SameSite=Lax, Path=/, 256-bit random token.
- Expiry: 30 d idle (sliding, updated at most hourly), 90 d absolute (FR-AUTH-006).
- Sweep: lazy (check on access) + nightly job (ops, T-OBS-005 area) for housekeeping.
- Guards: Next middleware does presence check for redirects only; **authoritative** authN/authZ re-runs in every route handler/service call (defense in depth — middleware is not the boundary).
- Rate limits: login 10/min/IP + 5/min/account; register 5/h/IP; reset 3/h/IP (NFR-SEC-005) — in-app limiter (edge backstop optional, DEPLOYMENT.md).
- Password reset: single-use token, 60 min expiry, hash stored, 1 active per user (DATA_MODEL §17); email via `MailPort` (T-AUTH-009; provider SMTP at VS-9).

## Consequences

### Positive
- Revocation is immediate and certain (logout, disable, token rotation).
- Zero client-side secrets; XSS cannot read the session.
- One table; sessions survive app restarts; backups include auth state.
- Argon2id is the 2026 recommended KDF for Node.

### Negative
- Every request pays a session lookup (indexed point query; budgeted ≤ 20 ms p95, NFR-PERF-014 — measured, not assumed).
- Session table grows (bounded by 90 d absolute; swept nightly).

## Risks

- **R1:** Session lookup becomes a hot-path cost. → `ix_sessions_token` unique index; consider in-process micro-cache (60 s) only if measured (not v1).
- **R2:** Argon2 native build failure on a platform. → Fallback `@node-rs/argon2` (OPTIONAL in research doc); both satisfy Argon2id — port unchanged.
- **R3:** Cookie fixation / replay. → Token rotated on login (new row, old deleted); absolute expiry caps replay window; Secure flag required in prod (env-gated, T-SEC-001).

## Mitigations

Rotation on login; constant-time token compare (library default); uniform error responses for unknown email vs wrong password (no user enumeration, T-SEC-003); auth-failure counters (NFR-OBS-007); authorization matrix test suite (T-LIB-009, T-ADMIN coverage in T-SEC-003).

## Revisit When

- Multi-device session management is requested (add session list UI — feature, not ADR).
- An OAuth requirement appears (e.g., "sign in with Google" for a hosted instance) → new ADR on identity federation.
- Session volume > 10M rows (ridiculous for this product) → C store re-evaluation.

## References

- docs/research/2026-stack-validation.md (password hashing, refs [18][19])
- DATA_MODEL.md §2/§17, SECURITY.md §3, THREAT_MODEL.md (T-05/T-06/T-07), API_CONTRACT.md (auth operations)
