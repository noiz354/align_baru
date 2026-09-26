# ADR-004: Authentication — Better Auth with database-backed sessions

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps serves 2–10 people per household on their own phones. Users sign in to reach their household's data; sessions must be revocable immediately when a member is removed (FR-MEM-006) or when a device is lost. Data ownership matters: household routines are sensitive, so an identity vendor holding member PII is a privacy liability (PRIVACY.md). The app is self-hosted or single-tenant hosted (ADR-016), on a Node runtime with a database available at the edge of every request. Invitations are the primary onboarding path (FR-MEM-003), not self-service registration at scale.

## Problem
Which authentication approach supplies secure, revocable, self-hosted sessions with a typed API and framework integration, while keeping the surface small enough for one maintainer and the data inside the household's own deployment?

## Decision Drivers
- Immediate session revocation (member removal, device loss, password change).
- No dependency on a hosted identity provider holding household member data.
- Server-side session validation usable in Server Components, Server Actions and route handlers.
- Secure defaults: `HttpOnly`/`Secure`/`SameSite` cookies, CSRF protection, rate limiting on auth endpoints.
- Typed session object (no `as unknown as Session` casting) for agent-implementable code.
- Rate limiting and abuse protection for invitation acceptance and password flows (NFR-SEC-005).

## Options Considered
1. **Better Auth** — database-backed sessions by design, typed sessions, first-party Next.js App Router support, built-in rate limiting and secure-cookie handling, self-hosted, no vendor.
2. **Auth.js (NextAuth) v5** — mature, huge ecosystem; JWT-first sessions cannot be revoked without a denylist; edge/Node config split adds complexity.
3. **Clerk / WorkOS / Auth0** — fastest to integrate, but member PII lives with a third party, per-seat cost, and vendor outage = household cannot log in.
4. **Custom credential + session implementation** — full control, full responsibility for crypto, rotation, CSRF, reset flows; historically the most common source of self-inflicted vulnerabilities.
5. **Magic-link-only, no passwords** — attractive (no password storage), but depends on email deliverability for every sign-in, which conflicts with assumption A-4 (email optional in v1).
6. **Passkeys-only** — strong security and increasingly available, but platform support friction for mixed-literacy households in 2026 makes it premature as `v1` default.

## Decision
Adopt **Better Auth** with the **database session strategy**, self-hosted in the HomeOps database.

Rules:
- Session tokens are database rows; `session` deletion is the revocation primitive. Member removal deletes sessions in the same transaction (FR-MEM-006).
- Cookies: `HttpOnly`, `Secure` (forced in all environments), `SameSite=Lax`, host-prefixed name, rotating on privilege change.
- Passwords are hashed by the library's default (memory-hard) algorithm; HomeOps never stores or logs password material.
- CSRF protection is enabled for all state-changing routes; Server Actions additionally validate origin.
- Rate limits: sign-in, sign-up, password reset, invitation acceptance — per identifier *and* per IP (NFR-SEC-005).
- Invitation tokens are HomeOps-owned (not the auth library's): single-use, hashed at rest, expiring, revocable (FR-MEM-003).
- Optional TOTP second factor is a P2 extension point (FR-AUTH-008) — no implementation in scope.
- Authorization is **not** delegated to Better Auth: roles and household membership are HomeOps domain concepts enforced in `src/server/auth/authorize.ts` and feature boundaries (docs/security/AUTHZ-MATRIX.md).

## Consequences

### Positive
- Removing a household member logs them out on every device instantly — a requirement that JWT-only designs cannot meet without extra infrastructure.
- No third party in the sign-in path; household data and credentials stay in the household's deployment (G-7, NFR-PRIV-002).
- Typed sessions reduce integration code and agent guesswork.
- Database sessions make "sign out all devices" (FR-AUTH-006) trivial.
- Rate limiting and secure cookies are defaults rather than bespoke work.

### Negative
- A database read on every authenticated request (mitigated by short-lived cookie caching / session lookup index).
- Better Auth is younger than Auth.js; API churn is possible and the exact version must be pinned at VS-0.
- Self-hosted auth means HomeOps owns recovery UX, email deliverability for resets, and abuse handling.
- Full session validation requires the Node runtime (not pure edge) — acceptable for our deployment (ADR-016).

## Risks
| Risk | Impact |
| --- | --- |
| Library breaking change or abandonment | Auth migration project at the worst time |
| Session fixation / cookie misconfiguration | Account takeover |
| Recovery email not configured | Locked-out households |
| Rate limits too loose or too strict | Abuse or legitimate lockout |

## Mitigations
- Keep the auth surface thin: `server/auth/session.ts` exposes only `getSession`/`requireSession`/`requireRole`. Swapping implementations is a bounded change.
- Pin the version; subscribe to security advisories; patch within 7 days (RUNBOOK.md).
- Session cookie settings and CSRF behaviour are asserted in integration tests (tests/integration/auth-session.test.ts skeleton).
- Provide the documented break-glass path: an operator-run CLI to issue a one-time reset link (RUNBOOK.md#locked-out-member) plus a fallback: an owner may re-invite a member.
- Recovery email is optional: password reset can be performed by an owner-issued temporary credential path documented in RUNBOOK.md, so a missing mail provider does not lock a household out permanently.
- Threat analysis for session theft and account takeover lives in THREAT_MODEL.md (T-04, T-13).

## Revisit Conditions
- An OAuth or SSO requirement appears from real users (would justify adding providers, not replacing the session model).
- Better Auth lacks a required capability (e.g. passkeys with attestation) that users demand.
- Session lookup becomes a measured latency contributor beyond PERFORMANCE.md budget.

## References
- PRD.md — FR-AUTH-001..008, FR-MEM-002, FR-MEM-006, NFR-SEC-004..005
- SECURITY.md — §sessions, §CSRF, §rate limiting
- THREAT_MODEL.md — T-04 session theft, T-13 account takeover, T-08 invite abuse
- docs/security/AUTHZ-MATRIX.md
- docs/research/STACK-2026.md#5
- TASKS.md — T-AUTH-001..008
