# StrangerLink — Security

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [THREAT_MODEL.md](THREAT_MODEL.md), [ADR-001](docs/adr/ADR-001-web-framework.md), [ADR-004](docs/adr/ADR-004-signaling-model.md), [docs/security/CONTROLS.md](docs/security/CONTROLS.md)

> **No authentication, authorization, or database code is implemented.** Ports exist in
> [src/server/auth/](src/server/auth/) and [src/server/db/](src/server/db/) and throw
> `Not implemented`.

---

## 0. Governing rule

> **All authorization decisions are made server-side. The client is never trusted.**
> (NFR-SEC-001)

Every control in this document is written on the assumption that the browser is hostile.
In an anonymous stranger-chat product, the client *is* frequently hostile.

---

## 1. Cross-Site Scripting (XSS)

| Vector | Control |
| --- | --- |
| Chat message content | Rendered as text only; React's default escaping; **no `dangerouslySetInnerHTML` anywhere** — enforced by a lint rule |
| Report notes | Sanitised on input, rendered as text on output |
| Interests | From a closed server-controlled vocabulary; never free text |
| Session/participant IDs | Opaque UUIDs; never interpolated into HTML |
| Error messages | From a fixed allowlist; never reflect user input |
| URLs in messages | Inert by default; no auto-fetch; opened with `rel="noopener noreferrer"` |
| CSP | Strict Content-Security-Policy: no `unsafe-inline`, no `unsafe-eval` in production |

**Verification:** an automated XSS test suite sends payloads through every input and
asserts none execute. See [TESTING.md](TESTING.md).

---

## 2. Cross-Site Request Forgery (CSRF)

| Control | Detail |
| --- | --- |
| Token | CSRF token on all state-changing requests where cookies are used |
| SameSite | `SameSite=Lax` or stricter on all cookies |
| Origin check | Verified on every mutating request |
| Custom header | Mutating API requests require a custom header that a cross-origin form cannot set |
| WebSocket | Origin allowlist at handshake; a cross-origin WS upgrade is refused |

---

## 3. SQL Injection

| Control | Detail |
| --- | --- |
| Parameterised queries | **Only.** No string interpolation into SQL, ever |
| Single access point | All SQL lives behind repository ports in `src/server/db/`; a test asserts no other module imports a database driver |
| ORM/query builder | Used with parameter binding; raw SQL only inside the ports, only with bound parameters |
| Least privilege | Application role has no DDL, no superuser, no access to `AuditEvent` writes |
| Input validation | Zod schemas at every boundary before any query is built |

---

## 4. Insecure Direct Object Reference (IDOR)

| Risk | Control |
| --- | --- |
| Accessing another session | Every session-scoped request re-authorizes: the caller's authenticated identity must be a participant of that session |
| Accessing another report | Reports are only reachable by moderators with the right role |
| Accessing another participant's data | Participants have no readable data surface beyond their own |
| Enumerating sessions | IDs are `uuidv7()` (≥122 bits entropy), never sequential |
| Admin routes | Role-checked server-side on every request; never middleware alone (ADR-001) |

**Verification:** an authorization test matrix asserts that every endpoint rejects a
caller who is not the owner. See [docs/security/CONTROLS.md](docs/security/CONTROLS.md).

---

## 5. WebSocket authorization

| Control | Detail |
| --- | --- |
| Authentication timing | **At the HTTP upgrade handshake**, before the socket opens. An unauthenticated upgrade is refused |
| Token | Short-lived, bound to the participant identity |
| Origin | Allowlist checked at handshake |
| Identity binding | The socket is bound to exactly one participant identity for its lifetime |
| Per-message authorization | Every frame's `fromParticipantId` must equal the bound identity |
| Session authorization | Every session-scoped frame's `sessionId` must be a session the identity belongs to |
| Supersession | A second socket for the same identity supersedes the first (`SESSION_SUPERSEDED`) |
| Ban check | A banned identity is refused at connect |

---

## 6. Session hijacking

| Control | Detail |
| --- | --- |
| Token entropy | ≥ 128 bits, cryptographically random |
| Token lifetime | Short; refreshed |
| Binding | Bound to the participant identity and, for WebSocket, to the socket |
| Transmission | TLS only; `Secure`, `HttpOnly` where applicable |
| Rotation | On privilege change |
| No URL tokens | Session IDs never appear in URLs that could leak via referrer or logs |
| Stale session rejection | A reconnect to an ended session is refused (EC-08) |

**Note on `/chat/[sessionId]`:** the session ID in the URL is a *capability*. It is
`uuidv7()`, unguessable, and is additionally checked against the authenticated identity on
every request. A leaked URL is not sufficient.

---

## 7. Signaling injection

| Threat | Control |
| --- | --- |
| Impersonating a peer | `fromParticipantId` must equal the authenticated identity; mismatch closes the connection and raises a safety event |
| Addressing an arbitrary peer | `toParticipantId` is forbidden by schema; the recipient is always server-derived |
| Cross-session injection | The session must be one the identity belongs to |
| Replay | `messageId` idempotency per session |
| Reordering | `sequence` monotonicity per direction |
| Oversized payloads | `maxPayload` plus per-type size caps |
| Malformed frames | Zod validation before dispatch; invalid frames close the connection |

---

## 8. TURN credential abuse

| Threat | Control |
| --- | --- |
| Credential theft | Time-limited (minutes), per-session, HMAC-based |
| Credential reuse | Bound to a session and an expiry |
| Mass minting | The minting endpoint is authenticated and rate limited |
| Open relay | coturn in a dedicated segment; relay to private/loopback/link-local/metadata ranges blocked |
| Bandwidth abuse | Per-identity and per-server allocation quotas; bandwidth accounting with alerts |
| Static secret leakage | Secret in the server secret store only; never in a client, log, or error; rotated on a schedule |

See [ADR-006](docs/adr/ADR-006-turn-strategy.md).

---

## 9. Rate abuse

See [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) for the full schedule. Summary of the
security-relevant limits:

- WebSocket frames: 30/s per connection.
- Queue joins: 1 per 5 s per identity.
- Session creation: 10/minute per identity.
- Messages: 1/s per participant per session.
- Reports: 5/hour per identity.
- TURN credential mints: 1 per session, 5/hour per identity.

All server-side. All auditable as `SafetyEvent` of type `rate-limit-triggered`.

---

## 10. Open redirects

| Control | Detail |
| --- | --- |
| Redirect targets | Validated against an allowlist of internal paths |
| No user-supplied absolute URLs | Redirect parameters are internal path fragments only |
| Post-auth redirects | Re-validated server-side |
| External links | Only through the explicit "Open link" action, in a new tab |

---

## 11. Malicious links

| Control | Detail |
| --- | --- |
| Inert by default | Displayed as text with the scheme visible |
| No auto-fetch | The client never requests a URL from a message |
| No preview | Nothing is fetched |
| `rel="noopener noreferrer"` | On the explicit open |
| Punycode | Rendered as Unicode to expose homograph attacks |
| No short-link expansion | We do not resolve redirects |

---

## 12. Admin privilege escalation

| Control | Detail |
| --- | --- |
| Separate surface | Admin routes are a distinct authenticated area |
| Individual accounts | No shared logins |
| MFA | Required for any role with enforcement power |
| Roles | `moderator`, `senior-moderator`, `admin` — least privilege |
| Server-side checks | On every request; never middleware alone |
| No self-escalation | Role changes require a different actor and are audited |
| Audit | Every action audited with actor, action, target, reason, policy version |

---

## 13. Secret leakage

| Control | Detail |
| --- | --- |
| Storage | Managed secret store; injected at runtime |
| Never in | Client bundles, images, CI logs, error messages, source control |
| Scanning | Secret scanning in CI; image scanning for embedded secrets |
| Rotation | Documented schedule, including the TURN static secret |
| Client exposure | The client receives only what it needs: STUN servers and short-lived TURN credentials |
| `NEXT_PUBLIC_` discipline | Only non-sensitive configuration is prefixed for client exposure; enforced by review |

---

## 14. Log leakage

| Never logged | Detail |
| --- | --- |
| Message content | Does not exist durably; must never reach a log |
| Report notes | Redacted in application logs; visible only in the moderation surface |
| IP addresses | Hashed coarse signals only, in application logs |
| TURN credentials | Never |
| Session tokens | Never |
| Stack traces to clients | `INTERNAL` errors return a fixed string |
| SDP bodies | Never |

Log access is restricted and audited. Logs have their own retention tier (Tier 5).

---

## 15. Dependency risk

| Control | Detail |
| --- | --- |
| Scanning | `npm audit` / Dependabot in CI; blocks on critical |
| Pinning | Exact versions; deliberate upgrades behind codemods |
| Framework security releases | Treated as **safety incidents**; patched within 72 hours |
| Base images | Scanned and rebuilt on a schedule |
| Supply chain | Lockfile committed; no install from arbitrary URLs |
| Triage policy | Documented in [CONTRIBUTING.md](CONTRIBUTING.md) |

The Next.js May 2026 advisory class (middleware/proxy auth bypass) is the specific reason
ADR-001 forbids middleware-only authorization.

---

## 16. Transport security

| Control | Detail |
| --- | --- |
| HTTPS everywhere | TLS 1.2+; HSTS |
| WebSocket | `wss://` only; plaintext refused in every environment |
| Database | TLS in transit; SCRAM authentication |
| Internal service traffic | Authenticated and encrypted |
| Certificate management | Automated renewal; monitored expiry |

---

## 17. Security requirements traceability

| Requirement | Where addressed |
| --- | --- |
| NFR-SEC-001 | §0, ADR-001 |
| NFR-SEC-002 | §5 |
| NFR-SEC-003 | §6, ADR-002 |
| NFR-SEC-004 | §7, ADR-004 |
| NFR-SEC-005 | §7 |
| NFR-SEC-006 | §8, ADR-006 |
| NFR-SEC-007 | §13, §14 |
| NFR-SEC-008 | §12 |

---

## 18. Implementation status

Ports exist in [src/server/auth/](src/server/auth/) and [src/server/rate-limit/](src/server/rate-limit/).
No authentication, authorization, session issuance, or rate limiting is implemented.
Tracked as **T-SEC-071** in [TASKS.md](TASKS.md).
