# THREAT_MODEL.md — HomeOps Threat Model

> 2026-09-26 · Status: **ANALYSED, NOT IMPLEMENTED** · Method: lightweight STRIDE-flavoured analysis per trust boundary.
> Controls referenced here are specified in SECURITY.md; verification is planned in TESTING.md and QA.md; work is assigned in TASKS.md.
> Scope note: a household app holds *routine* data (who cleans what, when the house is empty before trash day, when nobody is home for a service visit). The realistic adversary is a curious or hostile account holder, a stolen session, or a bot on the open internet — not a nation state.

## 1. Assets

| Asset | Why it matters |
| --- | --- |
| Household membership + roles | Control over who sees and changes household data |
| Household content (rooms, chores, schedules, issues, photos) | Reveals routines, presence patterns, home problems |
| Member identities (names, emails) | PII; small population means easy re-identification |
| Sessions and credentials | Direct account takeover path |
| Invitation tokens | Unauthorised entry into a household |
| Push subscriptions | Can be abused to spam/phish a member's device |
| Backup archives | Full data set in one file |
| Operator secrets (DB URL, VAPID private key, cron secret) | Infrastructure compromise |

## 2. Trust boundaries

```text
[ Internet ] ──▶ (B1 edge: HTTPS, headers, reverse proxy)
                     │
                     ▼
                [ B2 app process: session, validation, authz, actions ]
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
[ B3 Postgres ]            [ B4 outbound channels: push service, email provider ]
        │                          │
        ▼                          ▼
[ B5 operator host / backups ]   [ B6 member device: service worker, browser storage ]
```

Boundary-specific notes:
- **B1→B2**: all user input; unauthenticated surface is login/invite/health only.
- **B2→B3**: queries are household-scoped by construction (ADR-005).
- **B2→B4**: third parties receive only the minimum payload (redacted push text, deep link) — never household content (NFR-PRIV-008).
- **B6**: the member's device is *semi-trusted*: it holds a session cookie and cached shell. It is assumed it could be lost or shared.

## 3. Threat catalogue

Each row: **Threat · Boundary · Attack scenario · Impact · Likelihood · Planned mitigation · Verification · Requirement · Task**

### T-01 — IDOR (insecure direct object reference)
- **Boundary:** B2 (app authorization) and B3 (query scoping)
- **Scenario:** A member changes an id in a URL or action payload (`/rooms/<uuid>`, `choreOccurrenceId`) to an id belonging to another household, hoping the server trusts the client's identifier.
- **Impact:** Cross-household read/write of household data (severe)
- **Likelihood:** Medium (the classic web-app bug; trivial to attempt, easy to introduce)
- **Mitigation:** Every read/write resolves the entity *through* a household-scoped port using the session-derived context; the raw id is never used with the household filter; `NOT_FOUND` is returned (not `FORBIDDEN`) to avoid existence disclosure.
- **Verification:** tests/integration/household-isolation.test.ts rows per port; QA-08 scenario; review checklist item in docs/security/AUTHZ-MATRIX.md.
- **Requirement:** NFR-SEC-001, NFR-SEC-002, FR-HH-003, FR-HH-004
- **Task:** T-SEC-001, T-SEC-002

### T-02 — Cross-household access via aggregate composition
- **Boundary:** B2/B3
- **Scenario:** A join across tables where one side is filtered and the other is not (e.g. "list completions for occurrence" where the occurrence belongs to household A but the query filters only by `occurrence_id` from the request).
- **Impact:** Cross-household disclosure via a side channel (severe)
- **Likelihood:** Low–Medium (requires a composition mistake; more likely in read models)
- **Mitigation:** Child entities are addressed through their parent's repository so the parent's scope applies; dashboard read models take a context and never accept ids from input; a review rule requires naming the scoping path for every new query.
- **Verification:** isolation tests per read model, not just per table; code review gate.
- **Requirement:** FR-HH-003, NFR-SEC-002
- **Task:** T-SEC-002, T-DASH-001

### T-03 — Privilege escalation (role/agency abuse)
- **Boundary:** B2
- **Scenario:** A `MEMBER` or `HELPER` calls an administrative action directly (crafted request to `changeMemberRole`, `removeMember`, `archiveHousehold`, `exportHouseholdData`) or exploits a missing role check on a lesser-known path (e.g. `HELPER` creating recurring definitions).
- **Impact:** Unauthorised control over the household; data exfiltration (severe)
- **Likelihood:** Medium (actions are discoverable; UI hiding invites probing)
- **Mitigation:** Role checks in the operation layer from the authorization matrix; `HELPER` capability set explicitly enumerated; last-owner protection; audit log on rejections.
- **Verification:** Negative-path integration tests per role (`tests/integration/security/authorization-matrix.test.ts` skeleton); manual QA per role.
- **Requirement:** FR-MEM-010, NFR-SEC-001, NFR-SEC-009
- **Task:** T-AUTH-005, T-SEC-003

### T-04 — Session theft (device loss, XSS-adjacent, shared device)
- **Boundary:** B6 → B2
- **Scenario:** An attacker obtains the session cookie (stolen phone, malicious extension, shared computer) and uses it to read/act as the member.
- **Impact:** Full account access within that household (high)
- **Likelihood:** Medium (phones are lost; households share devices)
- **Mitigation:** `HttpOnly`+`Secure`+`SameSite` cookies; DB-backed sessions with `signOutAllDevices`; session rotation on privilege change; no long-lived JWTs; short session lifetime with sliding renewal; audit visibility of new sign-ins.
- **Verification:** cookie attribute assertions in integration tests; manual QA of sign-out-all; review of session configuration at deploy.
- **Requirement:** FR-AUTH-002, FR-AUTH-003, FR-AUTH-006
- **Task:** T-AUTH-002, T-AUTH-004

### T-05 — CSRF on state-changing operations
- **Boundary:** B1 → B2
- **Scenario:** A member visits a malicious page that submits a form to HomeOps (e.g. `completeTrashCollection`, `removeMember`) using the ambient cookie.
- **Impact:** Unauthorised mutations (moderate–high)
- **Likelihood:** Low (SameSite=Lax blocks most cases) but high-consequence if it lands
- **Mitigation:** SameSite=Lax cookies; auth-library CSRF tokens; Server Action origin verification; no state-changing `GET`s; no cross-origin CORS with credentials.
- **Verification:** integration test asserting a cross-origin POST is rejected; review of every new action's method and origin behaviour.
- **Requirement:** FR-AUTH-004, NFR-SEC-004
- **Task:** T-AUTH-003

### T-06 — XSS via user content
- **Boundary:** B2 → B6
- **Scenario:** A member submits markup in a chore title, issue description, comment or room name; another member's browser executes it (e.g. via a rich preview or raw HTML injection).
- **Impact:** Session theft, defacement, wormable within a household (high)
- **Likelihood:** Low (React escaping + no raw HTML) but catastrophic if a bypass exists
- **Mitigation:** No `dangerouslySetInnerHTML`; no user-content markdown rendering in v1; strict CSP with nonces and no `unsafe-inline`; comment/title length caps; URL fields validated to internal paths only.
- **Verification:** XSS payload corpus in E2E (planned: a content-injection spec added by T-SEC-004; `tests/e2e` holds the QA-mirrored specs today); CSP report check; dependency advisories (React RSC patches ≥ 19.2.4).
- **Requirement:** NFR-SEC-003, NFR-SEC-006
- **Task:** T-SEC-004, T-PLAT-006

### T-07 — SQL injection
- **Boundary:** B2 → B3
- **Scenario:** A crafted filter value (search, username, room name) reaches SQL as a string concatenation.
- **Impact:** Full database compromise (severe)
- **Likelihood:** Low (ORM parameterisation by default); rises if raw SQL is added carelessly
- **Mitigation:** Drizzle/parameterised queries only; `sql` template tags for raw fragments; no dynamic identifiers; input validation; the ban on ad-hoc `drizzle-orm` imports outside `src/server/db` keeps the surface auditable.
- **Verification:** Code-review rule + a unit test asserting filters use parameters; dependency on the typing of `sql` helpers.
- **Requirement:** NFR-SEC-003, P-7
- **Task:** T-PLAT-005, T-SEC-004

### T-08 — Invite-token abuse
- **Boundary:** B1 → B2
- **Scenario:** An invitation link leaks (forwarded chat, shared screenshot, shoulder surfing) and an unauthorised person joins the household; or tokens are brute-forced/enumerated if low-entropy.
- **Impact:** Unauthorised household access (high)
- **Likelihood:** Medium (chat forwarding is normal behaviour)
- **Mitigation:** High-entropy tokens; stored hashed; single-use; short expiry (default 7 days, max 30); revocation; optional email binding; audit trail (`InvitationCreated`/accepted); rate limits on acceptance; UI states who joined and lets an owner revoke membership.
- **Verification:** QA invite scenarios; integration tests for reuse/expiry/binding.
- **Requirement:** FR-MEM-003, FR-MEM-004, NFR-SEC-005
- **Task:** T-AUTH-006, T-MEM-002

### T-09 — Sensitive data in logs/traces/metrics
- **Boundary:** B2 → B5 (operator infrastructure)
- **Scenario:** A developer logs a household object (or an error includes a payload) and household content lands in stdout, a log aggregator, or a trace attribute.
- **Impact:** Privacy breach invisible to users (high)
- **Likelihood:** Medium (default developer behaviour is `console.log(obj)`)
- **Mitigation:** Structural redaction: the logger accepts only allow-listed typed fields (ADR-015); no household/member labels in metrics; error mapping strips payloads; PRIVACY.md logging restrictions are a review checklist item.
- **Verification:** Log-shape unit tests; grep-based review checklist; injectable redaction test in VS-15.
- **Requirement:** NFR-PRIV-003, NFR-OBS-006
- **Task:** T-OBS-001, T-PRIV-002

### T-10 — Notification abuse
- **Boundary:** B2 → B4 → B6
- **Scenario:** (a) A member floods another member with alerts/notifications (repeated low/critical toggles, spam issue comments); (b) a compromised session registers an attacker-controlled push endpoint; (c) a "test notification" endpoint is abused to spam.
- **Impact:** Harassment, annoyance, device-level phishing surface (moderate)
- **Likelihood:** Low–Medium (household-internal abuse is real but limited; endpoints are validated)
- **Mitigation:** Per-member daily caps with overflow digest; intent idempotency (`(alert, member, channel, window)`); rate limits on test notifications and level changes; subscription registration bound to the session member and validated keys; payloads contain no sensitive detail and no user-authored content (NFR-PRIV-008); revocation on member removal.
- **Verification:** policy unit tests for caps/dedupe; abuse scenario in QA-11/QA-12.
- **Requirement:** FR-ALERT-013, FR-NOTIF-006, FR-NOTIF-007
- **Task:** T-NOTIF-005, T-NOTIF-007

### T-11 — Malicious uploads
- **Boundary:** B2 → B3/B5
- **Scenario:** A member (or a compromised session) uploads a non-image with an image MIME type, an oversized file, an image containing script/EXIF-laden payload, or many files to exhaust storage.
- **Impact:** Stored XSS via content-type confusion, storage exhaustion, privacy leak via EXIF GPS (moderate–high)
- **Likelihood:** Low–Medium
- **Mitigation:** MIME allow-list + content sniffing; size/count caps; EXIF stripping (including GPS) on ingest; server-generated storage keys; serving only through an authenticated route with `nosniff` and `Content-Disposition` control; storage outside the web root; rate limits; quota visibility.
- **Verification:** upload E2E with malformed inputs; manual QA; review of the serving route's headers.
- **Requirement:** NFR-SEC-008, NFR-PRIV-006
- **Task:** T-SEC-006, T-ISSUE-006

### T-12 — Secrets exposure
- **Boundary:** B2/B5
- **Scenario:** Secrets are committed, baked into the image, printed in a crash report, exposed via a `NEXT_PUBLIC_` mistake, or leaked from a backup stored unencrypted.
- **Impact:** Database takeover, push spoofing, infrastructure compromise (severe)
- **Likelihood:** Low–Medium
- **Mitigation:** env/secret-store only; `.env*` git-ignored; secret scanning in CI; only genuinely public values in `NEXT_PUBLIC_*`; redaction-typed logs; encrypted backup storage; documented rotation and revocation steps.
- **Verification:** CI secret scan; deploy checklist; quarterly rotation reminder in OPERATIONS.md.
- **Requirement:** NFR-SEC-007, P-10
- **Task:** T-PLAT-021, T-OPS-004

### T-13 — Account takeover via recovery/credential attacks
- **Boundary:** B1 → B2
- **Scenario:** Credential stuffing against a weak reused password; brute force against sign-in; abuse of password-reset flow (enumeration, token interception); SIM/email takeover of the recovery channel.
- **Impact:** Full household access (severe)
- **Likelihood:** Medium (password reuse is endemic)
- **Mitigation:** Strong password policy; rate limits per IP and per account; uniform error messages; single-use short-lived reset tokens; no security questions; optional TOTP (P2); new-device sign-in visible in audit/activity; member removal kills sessions.
- **Verification:** Negative tests for enumeration and rate limits; manual QA of reset flow; review of reset token TTL.
- **Requirement:** FR-AUTH-005, FR-AUTH-007, NFR-SEC-005
- **Task:** T-AUTH-007, T-AUTH-008

### T-14 — Backup exposure or loss
- **Boundary:** B5
- **Scenario:** A `pg_dump` lands in a public bucket, on the same disk as the app, or is never tested; a ransomware/ransomware-style encryption or host wipe destroys both app and backups.
- **Impact:** Total data loss or full data breach (severe)
- **Likelihood:** Low (but consequence is maximal)
- **Mitigation:** Off-host, access-controlled, encrypted backup storage; least-privilege credentials for backup jobs; weekly restore drill with logged outcomes; retention window documented; host hardening in DEPLOYMENT.md.
- **Verification:** Documented restore drill evidence (RUNBOOK.md#restore-from-backup); checklist sign-off.
- **Requirement:** NFR-REL-001
- **Task:** T-OPS-001, T-OPS-003

### T-15 — Denial of service / resource exhaustion
- **Boundary:** B1 → B2/B3
- **Scenario:** Expensive dashboard/activity queries hammered by an authenticated client; unbounded uploads filling disk; a runaway scheduler job holding locks; connection-pool exhaustion from repeated slow requests.
- **Impact:** Household app unavailable (moderate)
- **Likelihood:** Low–Medium (accidental more likely than malicious)
- **Mitigation:** Bounded list sizes with keyset pagination; indexed hot paths (DATA_MODEL.md §4); per-operation rate limits; job timeouts and batch limits; bounded DB pool; health readiness reflects degradation; Node memory limits documented.
- **Verification:** Performance tests against budgets (PERFORMANCE.md); load smoke in T-PERF-002.
- **Requirement:** NFR-PERF-005, NFR-REL-005
- **Task:** T-PERF-001, T-PERF-002, T-PLAT-012

### T-16 — Malicious or careless household member (insider risk)
- **Boundary:** B2 (authorised user)
- **Scenario:** A member deletes another member's completions, closes others' issues without work, snoozes everything, or exports data before leaving.
- **Impact:** Data integrity loss, inter-personal harm (moderate)
- **Likelihood:** Medium in the real world (household dynamics)
- **Mitigation:** Append-only records for completions/transitions/activity (destructive edits are visible); soft-delete + archive rather than hard delete; role separation for administrative acts; audit log; exports restricted to `OWNER` and rate limited; no member can erase the history of others' work.
- **Verification:** Behaviour tests for "cannot delete history"; QA scenario.
- **Requirement:** FR-ACT-002, FR-MEM-010, NFR-SEC-009
- **Task:** T-ACT-001, T-SEC-003

### T-17 — PWA/service worker tampering or stale-shell confusion
- **Boundary:** B6
- **Scenario:** A stale service worker serves an old shell that mishandles a new API shape, producing confusing failures; or a device-level tamper modifies cached pages.
- **Impact:** Wrong data shown or actions silently failing (moderate)
- **Likelihood:** Medium (deployment churn is normal)
- **Mitigation:** Versioned caches and pruning on activation; "Updated — reload" affordance; network-first for navigations and data; staleness banner; no trusted decisions made from cached content; device tampering is out of scope (treated as a compromised client → session revocation).
- **Verification:** E2E offline/staleness spec; manual PWA QA.
- **Requirement:** FR-PWA-002, FR-PWA-004
- **Task:** T-PWA-003, T-PWA-004

## 4. Threats explicitly accepted (with rationale)

| Accepted risk | Why acceptable |
| --- | --- |
| A member can see all household data (no per-room or per-chore privacy) | The product premise is a shared household; adding intra-household ACLs would complicate every operation and is a stated non-goal |
| No encryption at rest beyond the host's/DB provider's | Managed by deployment (ADR-016); a home server realistically has full-disk encryption or not — documented, not assumed |
| No MFA in v1 | Optional TOTP is P2 (FR-AUTH-008); rate limits and revocation cover the realistic threat for a household |
| No WAF/rate-limit at the edge in the default deployment | Application-level limits are durable and sufficient at this scale; Caddy can add coarse limits if needed |
| Push payloads reveal *that* something needs attention (if the household chooses minimal payloads) | The household controls verbose vs minimal payload mode (NFR-PRIV-008) |

## 5. Review protocol

1. Every new operation adds a row to docs/security/AUTHZ-MATRIX.md **and** a line here if it introduces a new boundary, asset, or attack path.
2. Every security-relevant task (T-SEC-*, T-AUTH-*, T-PRIV-*) lists the threat IDs it addresses.
3. Re-run this analysis at VS-14 (Security + Privacy slice) and whenever a new integration (email provider, object storage) is added — each adds a boundary.
4. A threat without a mitigation **and** a verification method is an unfinished threat, not an accepted one.
