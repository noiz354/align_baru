# StrangerLink — API Contracts

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [SIGNALING.md](SIGNALING.md), [SECURITY.md](SECURITY.md), [DATA_MODEL.md](DATA_MODEL.md)

> **No handlers exist.** These are the planned boundaries. Every one is documented with the
> same twelve fields. Implementations are ports that throw `Not implemented`.

---

## 0. Contract format

Every boundary specifies:

**Operation · Requirement · Caller · Authentication · Authorization · Input · Output ·
Failure States · Validation · Rate Limits · Idempotency · Privacy Considerations**

---

## 1. Authentication boundaries

### `POST /api/session/identity` — Create a participant identity

| Field | Value |
| --- | --- |
| **Operation** | Create a pseudonymous participant identity |
| **Requirement** | FR-ENTRY-004, NFR-PRIV-002, T-SESSION-001 |
| **Caller** | Browser, after age gate and consent |
| **Authentication** | None — there are no accounts. The consent attestation is presented, not a credential |
| **Authorization** | Consent must be present and current (`consentVersion` must match) |
| **Input** | `{ consentVersion: number }` |
| **Output** | `{ participantId: string, identityToken: string, expiresAt: string }` |
| **Failure states** | `CONSENT_REQUIRED` (400), `CONSENT_VERSION_MISMATCH` (409), `RATE_LIMITED` (429), `INTERNAL` (500) |
| **Validation** | Zod: `consentVersion` is a positive integer |
| **Rate limits** | 5 per minute per IP-derived signal |
| **Idempotency** | Not idempotent — each call creates a new identity |
| **Privacy** | No personal data is accepted. The identity is a `uuidv7`. Nothing is written to durable storage |

### `POST /api/session/verify` — Verify an identity token

| Field | Value |
| --- | --- |
| **Operation** | Validate an identity token and return the participant's status |
| **Requirement** | NFR-SEC-002, T-BAN-051 |
| **Caller** | Browser; WebSocket handshake |
| **Authentication** | Bearer identity token |
| **Authorization** | Token must be valid and unexpired |
| **Input** | — (token in header) |
| **Output** | `{ participantId: string, status: 'ACTIVE' \| 'RESTRICTED' \| 'BANNED', retryAfterMs?: number }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403, banned), `INTERNAL` (500) |
| **Validation** | Token format |
| **Rate limits** | 30 per minute per identity |
| **Idempotency** | Idempotent |
| **Privacy** | Returns status only. No ban reason is disclosed to the caller |

---

## 2. Queue boundaries

### `POST /api/queue/join` — Join the queue

| Field | Value |
| --- | --- |
| **Operation** | Enter the matchmaking queue |
| **Requirement** | FR-QUEUE-001 … FR-QUEUE-006, T-QUEUE-011 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Identity must be `ACTIVE`; consent current; no active session; mode enabled |
| **Input** | `{ mode: ChatMode, interestIds: string[], language: string \| null, regionConstraint: string \| null }` |
| **Output** | `{ ticketId: string, joinedAt: string, expiresAt: string, mode: ChatMode }` |
| **Failure states** | `CONSENT_REQUIRED` (400), `MODE_DISABLED` (403), `RESTRICTED` (403 with `retryAfterMs`), `ALREADY_IN_SESSION` (409), `ALREADY_QUEUED` (200, returns the existing ticket), `RATE_LIMITED` (429), `INTERNAL` (500) |
| **Validation** | Zod: `mode` enum; `interestIds` ≤ 5 and all in the active vocabulary; `language` BCP-47; `regionConstraint` coarse code |
| **Rate limits** | 1 per 5 seconds per identity |
| **Idempotency** | Idempotent per participant — a second join returns the existing ticket |
| **Privacy** | Interests and language are matching inputs only. Queue entries are **never persisted** |

### `POST /api/queue/leave` — Leave the queue

| Field | Value |
| --- | --- |
| **Operation** | Cancel a queue entry |
| **Requirement** | FR-QUEUE-002, FR-QUEUE-007, T-QUEUE-011 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Identity must own the ticket |
| **Input** | `{ ticketId: string }` |
| **Output** | `{ left: true }` |
| **Failure states** | `UNAUTHENTICATED` (401), `NOT_FOUND` (404 — already matched or expired), `INTERNAL` (500) |
| **Validation** | Zod: `ticketId` is a uuid |
| **Rate limits** | 10 per minute per identity |
| **Idempotency** | Idempotent — leaving twice returns success |
| **Privacy** | Releases the in-memory entry. No durable record of the cancelled queue entry is created |

### `GET /api/queue/status` — Queue status

| Field | Value |
| --- | --- |
| **Operation** | Report whether the participant is queued, matched, or idle |
| **Requirement** | FR-QUEUE-005 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Own identity only |
| **Input** | — |
| **Output** | `{ state: 'idle' \| 'waiting' \| 'matched', waitedMs?: number, sessionId?: string }` |
| **Failure states** | `UNAUTHENTICATED` (401) |
| **Validation** | — |
| **Rate limits** | 30 per minute per identity |
| **Idempotency** | Idempotent (read) |
| **Privacy** | Returns only the caller's own state |

---

## 3. Session boundaries

### `GET /api/session/[sessionId]` — Session state

| Field | Value |
| --- | --- |
| **Operation** | Retrieve session state for an authorised participant |
| **Requirement** | FR-MATCH-002, NFR-SEC-003, T-SESSION-004 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | **The authenticated identity must be a participant of this session.** Re-checked on every request, never middleware alone |
| **Input** | — (sessionId in path) |
| **Output** | `{ sessionId, status, mode, role: 'A' \| 'B', createdAt, endedAt?, endReason? }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `SESSION_ENDED` (410), `SESSION_SUPERSEDED` (409), `INTERNAL` (500) |
| **Validation** | `sessionId` is a uuid |
| **Rate limits** | 60 per minute per identity |
| **Idempotency** | Idempotent (read) |
| **Privacy** | Returns no peer identifier, no peer metadata, no content. Only the caller's own role |

### `POST /api/session/[sessionId]/end` — End a session

| Field | Value |
| --- | --- |
| **Operation** | End the caller's session |
| **Requirement** | FR-CHAT-009, NFR-SAFE-004, T-SESSION-END-013 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Participant of the session |
| **Input** | `{ reason: 'skip' \| 'leave' }` |
| **Output** | `{ ended: true, endReason: SessionEndReason }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `ALREADY_ENDED` (200, idempotent) |
| **Validation** | Zod: `reason` enum |
| **Rate limits** | 10 per minute per identity |
| **Idempotency** | Idempotent — ending an ended session succeeds |
| **Privacy** | Records `endReason` only. No content |

---

## 4. Safety boundaries

### `POST /api/report` — Submit a safety report

| Field | Value |
| --- | --- |
| **Operation** | Submit a safety report for a session |
| **Requirement** | FR-REPORT-001 … FR-REPORT-010, T-REPORT-006 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | **The reporter must have been a participant of the session — including a session that has already ended.** A banned identity may still report |
| **Input** | `{ sessionId: string, category: ReportCategory, note?: string }` |
| **Output** | `{ reportId: string, received: true }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403 — not a participant), `VALIDATION_FAILED` (400), `RATE_LIMITED` (429), `DUPLICATE` (200, returns the existing report id), `INTERNAL` (500) |
| **Validation** | Zod: `category` enum; `note` ≤ 1000 chars, sanitised |
| **Rate limits** | 5 per hour per identity |
| **Idempotency** | Idempotent on `(sessionId, category)` — a duplicate returns the existing report |
| **Privacy** | Collects **no** name, email, phone, or account. The note is length-bounded and the UI warns against including personal information. The response contains **no** moderation reasoning |

**This endpoint must never be disabled.** There is no kill switch for reporting
(ADR-016).

### `POST /api/block` — Create a block

| Field | Value |
| --- | --- |
| **Operation** | Block the peer from the caller's session |
| **Requirement** | FR-BLOCK-001 … FR-BLOCK-006, T-BLOCK-017 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Participant of the session |
| **Input** | `{ sessionId: string, scope: 'session' \| 'platform' }` |
| **Output** | `{ blockId: string, created: true }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `SESSION_ENDED` (410 — block is still created), `RATE_LIMITED` (429), `INTERNAL` (500) |
| **Validation** | Zod: `scope` enum |
| **Rate limits** | 10 per hour per identity |
| **Idempotency** | Idempotent per (blocker, blocked, scope) |
| **Privacy** | Records two session identities and a scope. No reason, no note, no personal data |

### `POST /api/turn/credentials` — Mint TURN credentials

| Field | Value |
| --- | --- |
| **Operation** | Mint short-lived TURN credentials for the caller's session |
| **Requirement** | NFR-SEC-006, FR-ABUSE-004, T-TURN-091 |
| **Caller** | Browser |
| **Authentication** | Identity token |
| **Authorization** | Participant of an active session in a media mode; identity must not be banned or restricted |
| **Input** | `{ sessionId: string }` |
| **Output** | `{ username: string, password: string, urls: string[], ttlSeconds: number }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `SESSION_NOT_ACTIVE` (409), `RESTRICTED` (403), `RATE_LIMITED` (429), `INTERNAL` (500) |
| **Validation** | Zod: `sessionId` uuid; session mode must be a media mode |
| **Rate limits** | 1 per session, 5 per hour per identity |
| **Idempotency** | Idempotent per session — returns the existing credential until it expires |
| **Privacy** | Credentials are never stored, never logged, and never placed in a URL. TTL is minutes |

---

## 5. Admin boundaries

All admin endpoints share these properties:

| Field | Value |
| --- | --- |
| **Authentication** | Individual admin account; MFA required for any enforcement role |
| **Authorization** | Server-side role check on **every** request. Middleware is never the sole gate (ADR-001) |
| **Audit** | Every action writes an `AuditEvent` in the same transaction |
| **Rate limits** | Per admin, per action type |
| **Privacy** | No endpoint returns chat content or media — neither exists |

### `GET /admin/moderation/cases` — Case queue

| Field | Value |
| --- | --- |
| **Requirement** | FR-MOD-001, FR-MOD-002 |
| **Caller** | Moderator |
| **Authorization** | Role `moderator` or above |
| **Input** | Query: `{ severity?, status?, assignedTo?, cursor?, limit? }` |
| **Output** | `{ cases: ModerationCase[], nextCursor?: string }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403) |
| **Privacy** | Cases carry session metadata and report category/note. **Never content** |

### `POST /admin/moderation/cases/[caseId]/action` — Apply an outcome

| Field | Value |
| --- | --- |
| **Requirement** | FR-MOD-003, FR-MOD-004, FR-MOD-005, T-MOD-042 |
| **Caller** | Moderator or senior moderator |
| **Authorization** | `ban` requires `senior-moderator`; role changes require `admin` and a different actor |
| **Input** | `{ action: ModerationOutcome, reasonCode: string, targetIdentityId?: string, durationMs?: number }` |
| **Output** | `{ actionId: string, applied: true }` |
| **Failure states** | `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `CASE_ALREADY_ACTIONED` (409), `VALIDATION_FAILED` (400 — `reasonCode` is required) |
| **Idempotency** | Idempotency key required |
| **Privacy** | The audit record contains actor, action, target, reason code, and policy version. **No content** |

### `GET /admin/bans` · `POST /admin/bans/[banId]/revoke` — Ban management

| Field | Value |
| --- | --- |
| **Requirement** | FR-SAFE-004, FR-MOD-008 |
| **Authorization** | Read: `moderator`. Revoke: `senior-moderator`. An appeal is reviewed by a moderator other than the issuer where staffing allows |
| **Input** | Revoke: `{ reasonCode: string }` |
| **Output** | `{ revoked: true }` |
| **Privacy** | Ban records contain no name, email, phone, or IP |

### `GET /admin/metrics` — Safety metrics

| Field | Value |
| --- | --- |
| **Requirement** | NFR-OBS-001 |
| **Authorization** | `moderator` or above |
| **Output** | Aggregate safety metrics only |
| **Privacy** | **No chat content, no report notes, no individual timelines** |

---

## 6. Cross-cutting rules

| Rule | Detail |
| --- | --- |
| Authorization | Server-side, on every request, never middleware alone |
| Validation | Zod schema per boundary; the schema is the type |
| Errors | Fixed allowlist strings; never a stack trace, query, hostname, or IP |
| Rate limits | Per identity for authenticated actions; per IP-derived signal for unauthenticated |
| Idempotency | Required on every mutating boundary; key documented above |
| Correlation | Every request carries a trace id |
| No content | No boundary accepts or returns chat content or media |
| Reporting | `POST /api/report` has no kill switch and no maintenance mode that disables it |

---

## 7. Implementation status

Route shells exist in [src/app/](src/app/). No handler, no validation wiring, and no
authorization exists. Tracked across VS-1 … VS-15 in [TASKS.md](TASKS.md).
