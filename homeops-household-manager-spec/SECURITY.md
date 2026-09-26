# SECURITY.md — Security Principles & Controls

> 2026-09-26 · Status: **SPECIFIED, NOT IMPLEMENTED**
> Threat-by-threat analysis with test and task mapping: THREAT_MODEL.md · Roles per operation: docs/security/AUTHZ-MATRIX.md · Data handling: PRIVACY.md.
> Scope: a self-hosted household app holding household routines, member names, home problems and photos. Small user count is **not** a reason to relax anything here.

## 1. Security principles

| # | Principle | Implementation stance |
| --- | --- | --- |
| P-1 | **Household isolation is the primary boundary.** | Every scoped read/write goes through a port requiring `HouseholdContext` (ADR-005). No unscoped query helper exists. |
| P-2 | **Server-side authorization always.** | UI hiding is cosmetic. Every operation checks the caller's membership + role server-side before touching data (API.md §13). |
| P-3 | **Least privilege.** | Four coarse roles (`OWNER`/`ADMIN`/`MEMBER`/`HELPER`); administrative operations (roles, removal, archive, export) require elevated roles. |
| P-4 | **Deny by default.** | Unknown route → 404/redirect; unknown operation → typed error; unknown enum value → validation failure. |
| P-5 | **Validate at the boundary, trust nothing inside.** | Zod schemas at every action/route; closed enums; unknown keys rejected; IDs are opaque uuids, never sequential. |
| P-6 | **Encode on output.** | React escapes by default; `dangerouslySetInnerHTML` is forbidden. User content is never rendered as markup. |
| P-7 | **Parameterise all SQL.** | Drizzle parameterisation or `sql` template tags; string-concatenated SQL is a build-blocking review finding. |
| P-8 | **Sessions are secure and revocable.** | DB-backed sessions; `HttpOnly`+`Secure`+`SameSite=Lax`; rotation on privilege change; delete-to-revoke (ADR-004). |
| P-9 | **State-changing requests are CSRF-protected.** | Auth library CSRF + Server Action origin checks; no `GET` mutations, ever. |
| P-10 | **Secrets never touch the repo, the image, or the logs.** | Env/secret store only; `.env.example` holds names, not values; redaction is structural (ADR-015). |
| P-11 | **Fail safe and loud internally, quiet externally.** | Users get a friendly message + correlation id; operators get the detail via logs/metrics. No stack traces, no internals. |
| P-12 | **Audit what matters.** | Login events, invitations, role changes, removals, exports, deletion requests (NFR-SEC-009). |
| P-13 | **Least data, least retention.** | Data minimisation and retention windows are security controls too (PRIVACY.md). |
| P-14 | **Patch promptly.** | Security releases applied within 7 days of a fix being available (RUNBOOK.md#dependency-security-patch). |

## 2. Household isolation

| Control | Detail |
| --- | --- |
| Structural | `household_id` on every scoped table; ports require context; no cross-household joins in application code. |
| Context minting | `server/auth/context.ts` is the only place a `HouseholdContext` is created from a session. (Jobs construct one explicitly per household id.) |
| Composition | Feature services receive context from the caller and pass it down; they never accept a `householdId` argument from input. |
| Scheduler | Iterates households and constructs contexts explicitly; has no "all rows" queries except retention/metrics aggregates that return counts only. |
| Tested | Each port gets a row in tests/integration/household-isolation.test.ts asserting household B data is unreachable. |
| Logging | Log lines may carry `householdId` (opaque) but never names, titles, notes, or photos (ADR-015). |

## 3. Authentication & session controls

| Control | Detail |
| --- | --- |
| Credentials | Handled by Better Auth (ADR-004); memory-hard password hashing; HomeOps never stores password material. |
| Session cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed where possible, `Path=/`, bounded lifetime, rotated on privilege change. |
| Revocation | Deleting session rows is the primitive; member removal revokes in the same transaction (FR-MEM-006). |
| Sign-out | Current device and all devices (FR-AUTH-006). |
| Recovery | Single-use, short-lived reset tokens; "request reset" never reveals account existence. |
| Second factor | Optional TOTP (P2, FR-AUTH-008); not implemented in v1. |
| Auth rate limits | Sign-in 10/15 min/IP and 5/15 min/account; sign-up 5/hour/IP; reset 5/hour/IP; invite acceptance 10/hour/IP. |
| Failure messaging | Uniform `AUTH_INVALID_CREDENTIALS` for both wrong-email and wrong-password cases. |
| Audit | `AuthSignInSucceeded`/`Failed`, `AuthSessionRevoked`, `RoleChangeRejected` → `audit_log` (no credentials, no tokens). |

## 4. Authorization model

- Roles: `OWNER` > `ADMIN` > `MEMBER` > `HELPER` (coarse, documented in docs/security/AUTHZ-MATRIX.md).
- Every operation in API.md names its required role; the matrix is the single source of truth for review.
- Special rules:
  - Cannot remove the last `OWNER` (I-MEM-001).
  - `HELPER` may complete assigned work and report issues but may not manage household settings, members, or roles.
  - Cross-cutting actions (remove member) cascade deliberately: sessions revoked, subscriptions deleted, open work reassigned, alerts rerouted — all in one transaction.
- No client-side authorization decisions are trusted; a client that hides a button has not protected anything.

## 5. Input validation & output encoding

| Layer | Rule |
| --- | --- |
| Actions/routes | Zod parse of `{input, session-derived context}`; reject unknown keys; enforce enums, lengths, ranges, and cross-field consistency (e.g. threshold ordering). |
| Business rules | Enforced in domain code (invariants in docs/domain/INVARIANTS.md), not only in schemas. |
| SQL | Parameterised always; `LIKE` input is escaped; no dynamic identifiers from user input. |
| Output | React auto-escaping; URLs from user input are validated against the allow-list of internal paths; no raw HTML. |
| Files | MIME allow-list, size limits, content sniffing where feasible, safe `Content-Disposition`, no user-controlled filenames in storage keys. |
| Free text | Stored and displayed as text; never used to build queries, file paths, or notification payloads. |

## 6. CSRF, CORS and clickjacking

| Control | Detail |
| --- | --- |
| CSRF | Auth library CSRF on auth endpoints; Server Actions verify origin; no state changes over `GET`; SameSite=Lax cookies. |
| CORS | No cross-origin API. If one is ever added, it is explicit allow-list based — never `*` with credentials. |
| Clickjacking | `frame-ancestors 'none'` (+ `X-Frame-Options: DENY` for legacy). |
| Third-party embedding | None. No external scripts are loaded; no analytics (PRIVACY.md). |

## 7. Security headers (set globally)

| Header | Value | Notes |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Only after HTTPS is verified in the deployment checklist |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'nonce-…'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` | Nonce-based; no `unsafe-inline`; `img-src blob:` needed for client-side photo compression previews |
| `X-Content-Type-Options` | `nosniff` | Always |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Deep links never leak ids to third parties |
| `Permissions-Policy` | `camera=(self), geolocation=(), microphone=(), payment=()` | Camera allowed only because photo attachment is a feature; geolocation explicitly denied |
| `Cross-Origin-Opener-Policy` | `same-origin` | |
| `Cache-Control` (authenticated HTML) | `no-store` | Household data must never be cached by shared proxies |

## 8. Rate limiting

| Class | Limit (per actor/ip) | Rationale |
| --- | --- | --- |
| Sign-in / sign-up / reset | see §3 | Credential stuffing, enumeration |
| Invite create / accept | 20/day/household; 10/hour/IP | Invite-token abuse (T-08) |
| Uploads | 40/hour/member, 5 MB/file | Storage abuse, malicious content |
| Exports | 1/day/household | Bulk data exfiltration via a compromised session |
| Notifications test | 3/day/member | Notification abuse (T-10) |
| Mutations (general) | per-operation in API.md | Double-tap protection and abuse ceilings |
| Scheduler trigger | 6/hour global, shared secret | External abuse of the cron surface |

Implementation: durable `rate_limit_bucket` table (DATA_MODEL.md) so limits survive restarts and multiple instances.

## 9. File handling (photos)

| Control | Detail |
| --- | --- |
| Allow-list | `image/jpeg`, `image/png`, `image/webp` (HEIC converted client-side); everything else rejected. |
| Size | ≤ 5 MB per file; ≤ 5 files per issue; dimensions bounded on upload. |
| Storage | Outside the web root; storage keys are server-generated uuids (never user filenames); directory listing disabled. |
| Serving | Through an authenticated, household-scoped route; `Content-Disposition: inline` only for allowed image types; `nosniff`. |
| Processing | Strip EXIF (including GPS) on ingest; generate a bounded preview. |
| Retention | Deletion cascades with the parent record; soft-delete with a grace period, then purge (DATA_MODEL.md 2.8). |
| Decision pending | Filesystem volume vs object storage: **proposed ADR-017** (must be accepted before VS-11). |

## 10. Secret management

| Item | Storage | Rotation |
| --- | --- | --- |
| Database URL / credentials | Environment (secret store on managed hosts) | On suspicion; documented in RUNBOOK.md |
| Session/encryption keys | Environment; distinct per environment | Annually and on personnel change |
| VAPID keys (push) | Environment; public key exposed to the client intentionally | Regenerate only with subscriber re-registration plan |
| Scheduler trigger secret | Environment | Quarterly |
| Email provider key (optional) | Environment | Per provider policy |

Rules: no secrets in git (`.env*` ignored; `.env.example` lists names only); no secrets in Docker images or client bundles (only `NEXT_PUBLIC_*` may reach the client, and none are secrets); no secrets in logs or error messages (structural redaction, ADR-015).

## 11. Audit logging

Recorded events (append-only `audit_log`, 12-month retention): sign-in success/failure (actor id or hashed identifier, IP truncated), sign-out-all, password reset requested/completed, invitation created/revoked/accepted, role change (including rejected attempts), member removed/left, household archived, data exported, deletion requested, scheduler secret rejected.

Not recorded: request bodies, page views, household content, free text, photos.

## 12. Dependency & supply-chain security

- Dependabot (or equivalent) enabled; security updates applied within 7 days (P-14).
- Lockfile committed; CI installs with `npm ci` only.
- No postinstall scripts from untrusted packages; new dependencies require a STACK-2026.md entry and a DECISIONS.md note (AGENTS.md §1).
- Container base images pinned by tag (`node:24-bookworm-slim`) and rebuilt monthly; image scanning in CI (informational in v1, blocking once stable).
- Build provenance: images tagged with git SHA; deploy records the SHA (DEPLOYMENT.md).

## 13. Operational security (self-hosting)

Documented in DEPLOYMENT.md and RUNBOOK.md: SSH keys only (no password auth, no root login), firewall exposing only 80/443, unattended OS upgrades, DB not exposed publicly, backups stored off-host with encryption at rest, weekly restore drill, log retention policy.

## 14. Security-relevant non-goals (v1)

No SSO/OAuth providers · no passkeys · no enterprise audit exports · no SIEM integration · no WAF · no bug-bounty programme. Hosting is single-tenant enough that these are disproportionate; each becomes a candidate ADR if the product ever serves strangers.
