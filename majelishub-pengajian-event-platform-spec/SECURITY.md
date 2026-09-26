# SECURITY

Security requirements and controls for a system that holds **personal contact data, attendance
records and voice recordings**, and whose entrance workflow is operated by untrained volunteers on
their own devices.

Requirements: NFR-SEC-001…012 · Threats: `THREAT_MODEL.md` · QR: `docs/security/QR-SECURITY.md` ·
Authz: `docs/security/AUTHZ-MATRIX.md` · Privacy: `PRIVACY.md`

---

## 1. Trust model

| Principal | Trust level | Notes |
|---|---|---|
| Participant browser | **Untrusted** | Participant supplies their own claims; capability tokens are bearer credentials |
| Volunteer/operator device | **Untrusted** | Shared phones, other apps, borrowed devices; the session is a credential |
| Organizer browser | Untrusted | Powerful session; must be re-authenticated for destructive actions where practical |
| Application server (`web`) | Trusted code, untrusted input | All input validated; authorization centralised |
| Worker | Trusted code | Processes hostile media; runs ffmpeg under resource limits |
| PostgreSQL | Trusted store | Constraints are part of the security model |
| Object storage | Trusted storage, but **access is only via presigned URLs** | Buckets private; keys never exposed to clients except via signed URLs |
| STT provider (optional) | Third party | Receives audio **only** if a hosted provider is explicitly configured |
| Email provider | Third party | Receives contact data and message text; never receives tokens for uncontrolled channels |
| Platform admin | Powerful, audited | All actions logged; no silent access to participant data |

**Assumption we explicitly reject:** that a volunteer's phone is uncompromised, or that a
participant's screenshot stays private. Controls are designed so that a leaked *participant* token is
worth at most one attendance record for one event (`docs/security/QR-SECURITY.md`).

## 2. Authentication

| Surface | Mechanism |
|---|---|
| Participant registration | No account. Contact channel + explicit consent; then a signed capability link |
| Participant capability | Signed, short-lived (default 30 days, event-scoped), single-purpose token in the URL path; revocable (token re-issue invalidates the old one) |
| Operator/organizer/reviewer | Better Auth session (ADR-0005); passkeys encouraged, MFA available for admin roles |
| Check-in device | Operator session + **device binding** to one event/venue shift; switching requires an explicit audited action |
| Provider webhooks | HMAC signature over the raw request body + timestamp window (±5 min) + replay protection |
| Job execution | In-process; no authenticated internal HTTP surface exists |

Session rules: cookies `HttpOnly; Secure; SameSite=Lax` (strict where feasible), session rotation
on privilege change, revocation list for admin sessions, idle timeout 30 days for participants and
8 hours for organizer/admin surfaces, and no session in `localStorage`.

## 3. Authorization

- **Centralised guard**: every route handler and Server Action starts with
  `requirePermission(permissionKey, scope)` — there is no "public by default" path except the
  explicitly listed public read operations (`API.md` §2).
- **Scope resolution**: actor → memberships → `TenantScope { organizationId, mosqueIds? }`. A
  permission is always evaluated *for a scope*, never globally.
- **Separation of duties that matters**:
  - `transcript.review` ≠ `transcript.approve` (a reviewer can prepare; approval is a named,
    recorded act).
  - `moderation.decide` is not held by default organizers (platform-level trust).
  - `speaker.verify` is platform-admin only.
  - `member.grant` cannot grant a role the actor does not hold authority over (no self-escalation).
- Full matrix: `docs/security/AUTHZ-MATRIX.md`.
- **UI hiding is never a control.** A control that exists only in the client is a bug.

## 4. Organization isolation (IDOR/BOLA)

Controls, layered (ADR-0017):

1. Type-level `TenantScope` requirement on every scoped repository method.
2. Composite foreign keys so a row cannot reference another tenant's parent.
3. Row-Level Security (P1) as a backstop, with `SET LOCAL app.organization_id` per transaction.
4. **Existence privacy:** cross-org fetches return `404`, not `403`, so an attacker cannot enumerate
   object existence across tenants.
5. **Isolation test suite** that enumerates every route from the manifest and attempts cross-org
   access — a new endpoint cannot be released without passing it.

## 5. Registration abuse

| Abuse | Control |
|---|---|
| Mass fake registrations | Rate limits per contact hash and IP; contact verification for suspicious volumes; per-event review by the organizer; capacity limits |
| Registration by bots | No public API keys; a lightweight challenge on anomalous volume (documented as P2: proof-of-work or a provider CAPTCHA — avoided in MVP for accessibility) |
| Enumerating event capacity/times | Capacity exposed only when trustworthy; no per-registration information leak |
| Registering as someone else | Not preventible (no identity verification) — but attendance still requires physical presence, and the product never exposes personal data based on registration alone |
| Invitation link sharing | Invitations are single-use with an expiry; sharing is bounded by design |
| Contact spam via notifications | Preferences + unsubscribe + rate limits; the platform never sends marketing |

## 6. QR security (summary)

Full treatment: `docs/security/QR-SECURITY.md`. In brief:

1. The QR contains **only an opaque token**; no PII, no database id (ADR-0006).
2. Tokens are 128-bit random, stored **hashed** (SHA-256), compared in constant time.
3. A token authorises **one check-in for one event**; the first valid scan wins; later scans return
   `ALREADY_CHECKED_IN` (no duplicate attendance).
4. Tokens are revocable and re-issuable (lost phone) with audit; all currently valid tokens for a
   registration are invalidated on re-issue.
5. Screenshot/forwarded tokens are treated as a **documented residual risk**: the blast radius is one
   attendance record; an abnormal duplicate rate raises `DUPLICATE_SCAN_RATE_HIGH` and the organizer
   can require the manual path for that event.
6. The short code carries the same properties (hashed, per-event unique) and the same restrictions.
7. Token values never appear in logs, traces, metrics, or notification payloads (see §11).

## 7. Web application security

| Risk | Control |
|---|---|
| XSS | No raw HTML rendering of user content; Markdown subset rendered server-side with a strict allow-list; React's escaping as the default; a CSP with `script-src 'self'` (nonce-based where needed) and no `unsafe-inline` |
| CSRF | SameSite cookies + origin/referer validation on state-changing requests + no state-changing GETs; Server Actions validated the same way |
| Clickjacking | `frame-ancestors 'none'` (plus `X-Frame-Options: DENY`) |
| Open redirect | No user-supplied redirect targets; all post-action navigation is to server-generated paths |
| SSRF | Server never fetches user-supplied URLs (materials are links rendered to the client, not fetched server-side) |
| Injection (SQL) | Parameterised queries only; Drizzle/`sql` template with bound parameters; no string concatenation into SQL (lint rule) |
| Mass assignment | `.strict()` validation schemas; explicit field mapping to domain commands |
| Prototype pollution | No deep merge of user objects; explicit field assignment |
| Cache poisoning / leakage | Authenticated responses are `no-store`; public pages may be cached with tenant-agnostic projections only; `Vary: Cookie` where applicable |
| Error leakage | Central error mapper; internal ids/exceptions never returned; `requestId` for support |
| Dependency risk | Pinned versions, monthly review, `npm audit --omit=dev` gate, SBOM per release, patch SLA ≤ 72 h for criticals |
| Headers | HSTS (preload-eligible), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, Permissions-Policy restricting camera/mic/geolocation to self |

## 8. Upload and media security

Audio uploads are hostile input by default (`THREAT_MODEL.md` T-20…T-24):

1. **Size limits** per chunk (≤ 8 MB) and per session (≤ 500 MB configurable), enforced before
   buffering where possible.
2. **Content-type verification by sniffing** (magic bytes) — the declared type is a hint, not a fact.
   Allow-list: WebM/Matroska, Ogg, MP4/M4A, WAV. Anything else rejected.
3. **Stored outside the web root** in object storage; never served from the application origin with
   an `audio/*`-trusted content type derived from user input. Downloads use presigned URLs with
   `Content-Disposition: attachment` for exports.
4. **Processing is sandboxed**: ffmpeg runs in the worker container with CPU/memory/time limits, no
   network access beyond what it needs, a non-root user, and a pinned version. Processing is
   atomically rejected if it exceeds limits.
5. **No media parsing in the web process**, and no client-supplied filename ever used in a storage
   key (keys are derived from ids and sequences).
6. **Storage exhaustion** guarded by per-organization quotas (P1) and by the recording chunk limits;
   an alert fires on abnormal growth (`OBSERVABILITY.md` §Alerts).
7. **EXIF/metadata**: audio containers may carry metadata; on the derived assets we strip/normalise
   metadata (recording device, timestamps are dropped from the published artefact — they can be
   personal data).
8. Quarantine semantics: a chunk that fails verification is rejected and recorded (hash mismatch),
  never stored as "probably fine".

## 9. Token and secret handling

| Secret | Storage | Rotation |
|---|---|---|
| Check-in token | SHA-256 hash only (`checkin_tokens.token_hash`) | Re-issue per registration; global pepper rotates with a key-version column (P1) |
| Capability link token | HMAC-signed payload with a server secret; short expiry | Secret rotation with dual-key acceptance window |
| Invitation token | Hash only, single-use, expiry | Per invitation |
| Application secrets (DB, storage, providers) | Environment/secret manager; never in the repo; validated at boot | Documented in `OPERATIONS.md` §Rotation |
| Session secrets | Better Auth secret, rotated with session invalidation plan | Quarterly or on suspicion |
| Provider API keys | Environment; scoped to the minimum capability; separate keys per environment | Documented |

Rules: secrets never in logs (allow-list), never in error messages, never in client bundles
(build-time check), never in `git` history (secret scanning in CI).

## 10. Admin, moderation and escalation

- Platform admin capabilities are enumerated: speaker verification, moderation decisions, audit
  query, retention runs, provider configuration. Nothing else.
- Admin cannot read participant contact details in bulk; there is **no** "browse all participants"
  surface, and every individual access in a support context requires a reason and is audited.
- Role changes require an audit event and are reversible; emergency revocation (session kill) is one
  action.
- Moderator actions are appealable with a recorded decision trail (`CONTENT.md` §8).
- No impersonation feature in MVP (documented as a deliberate omission: it is a common support
  shortcut and a common breach vector).

## 11. Logging, telemetry and privacy

- Allow-listed attributes only; `logger`/`tracer` are the only sanctioned interfaces
  (`OBSERVABILITY.md` §Allow-list).
- **Never logged:** tokens/short codes, contact values, participant names, transcript text, feedback
  text, audio bytes, presigned URLs, provider payloads, IP addresses (hashed with a rotating salt
  where required for abuse detection).
- Correlation ids are opaque (`requestId`, `eventId`, `sessionId`), not personal.
- Telemetry retention differs from audit retention (`RETENTION.md`).

## 12. Audit logging

| Action class | Examples | Required fields |
|---|---|---|
| Authorization changes | role grant/revoke, membership removal | actor, target user, roles, reason |
| Attendance integrity | manual check-in, correction, bulk action | actor, event, registration ref, reason |
| Token lifecycle | re-issue, revocation | actor, registration ref, reason |
| Content integrity | transcript approval, publish, unpublish, takedown | actor, content id, revision id, reason |
| Verification | speaker verification/revocation | verifier, evidence note, status |
| Data protection | export, data-subject access/deletion, retention run | actor, scope, reason, affected counts |

Properties: append-only (no update/delete paths), written in the same transaction as the action,
queryable by authorized roles, exportable with an audit of the export itself, retained 7 years
(`RETENTION.md` §Audit). Anonymous feedback submissions are the one documented exception where no
actor is recorded (ADR-0016).

## 13. Rate limiting

Durable (Postgres-backed at MVP scale), per the table in `API.md` §1. Critical: Better Auth's
default limiter is in-memory and resets on deploy — it **must** be replaced before production
(ADR-0005). Limits are enforced at the perimeter for public endpoints and per-actor for
authenticated ones, and are observable (`rate_limit_rejections_total{route}`).

## 14. Incident response

Summary (full procedure in `docs/security/INCIDENT-RESPONSE.md`):

1. **Detect** (alert or report) → 2. **Contain** (revoke sessions/tokens, disable a channel/provider)
   → 3. **Assess** (what data, whose, how many) → 4. **Notify** (UU PDP: supervisory authority and
   affected individuals within **72 hours** where required) → 5. **Fix** → 6. **Learn** (post-mortem,
   new test, ADR if a control was wrong).

## 15. Security acceptance criteria

1. Isolation suite green: every scoped endpoint rejects cross-org access with 404.
2. A QR payload contains no PII/UUID and matches the token pattern (unit test).
3. No plaintext token column exists; nothing logs a token (lint + test).
4. `INTERNAL` policy audio and unpublished transcripts are unreachable publicly via any path,
   including presigned-URL signing denial (security test).
5. Duplicate concurrent check-ins converge to one attendance record (concurrency test C2).
6. Cross-site scripting payloads in every user-controlled field render inert (test across title,
   description, transcript text, comment, materials label).
7. CSP blocks inline script and third-party script injection (header assertion + browser test).
8. Cross-tenant existence is not disclosed (response-code matrix test).
