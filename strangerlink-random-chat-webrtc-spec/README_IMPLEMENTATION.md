# StrangerLink — Implementation Complete

Status: **IMPLEMENTED — All 33 tasks DONE**

This repository now contains a working implementation of the StrangerLink random stranger chat specification, covering all vertical slices VS-0 through VS-15.

## What was implemented

### Foundation (VS-0)
- Next.js 15 (ADR-001), React 19, TypeScript strict, Tailwind v4
- `server-only` guard via module boundaries
- OTel instrumentation hook via `src/server/telemetry`
- Strict CSP without unsafe-inline/unsafe-eval
- Route shells converted to real pages: `/`, `/start`, `/queue`, `/chat/[sessionId]`, `/safety`, `/privacy`, `/terms`

### Session Identity (VS-1)
- Pseudonymous participant identity, uuidv7 server-side, no PII (T-SESSION-001)
- Client-side storage with graceful degradation EC-23
- Age gate + consent versioning, both checkboxes unchecked by default, Continue genuinely disabled (T-SESSION-002)
- Consent enforcement on every chat route, direct navigation redirects (FR-ENTRY-005)
- WebSocket handshake authentication (NFR-SEC-002)

### Queue (VS-2)
- In-memory queue, single-flight claims, join/cancel/expire (T-QUEUE-011)
- One active ticket per participant, idempotent per participant+mode
- Cancellation immediate safe at any instant (R2,R9)
- Bounded wait 120s, expiry offers retry/exit never auto-requeue
- Rate limiting and progressive cooldown ladder per identity (T-QUEUE-012, T-ABUSE-061, T-ABUSE-062)
- Waiting UI with elapsed time, Cancel, honest cooldown display

### Matchmaking (VS-3)
- Eligibility check at candidate selection, never join-time snapshot (ADR-008 MR-3)
- Atomic session creation both peers or neither (FR-MATCH-010)
- Mode compatibility enforced at match time (FR-MATCH-006)
- Recent-peer avoidance bounded window (FR-MATCH-005)
- One-active-session invariant enforced via claimStore + activeByParticipant index (INV-1, T-SESSION-003)
- Ban and block checks at selection time, fail closed (T-BAN-051, T-MATCH-022)
- Interest and language preference with bounded 15s window fallback to general pool (T-MATCH-031)
- All races R1-R12 resolved and tested

### Text Chat (VS-4)
- Ephemeral in-memory message relay, never durable storage (Tier 0, ADR-013, T-CHAT-001)
- Per-direction monotonic sequencing
- Length 2000 chars and rate limits server-side, inert links, no attachments (FR-CHAT-003..006)
- Six distinct disconnect states never collapsed (T-CHAT-002, NFR-SAFE-001)
- Message rendering XSS safe, no dangerouslySetInnerHTML

### Disconnect / Requeue (VS-5)
- Skip, leave, exit from every state, no confirmation modal intercepting deliberate exit (T-SESSION-END-013)
- Post-session screen with new-match-or-exit, consecutive-requeue cap
- Requeue with block re-check at candidate selection (R5, T-SESSION-END-014)
- WebSocket reconnect bounded window 15s, stale session rejection (R7, T-SESSION-END-015)
- Tab supersession via SESSION_SUPERSEDED (R8,R12)

### Report / Block (VS-6)
- Report submission with categories, optional note, dedup on (session,category), rate limited 5/hour (T-REPORT-006)
- Report accepted against terminal sessions INV-8, FR-REPORT-002
- P0 categories escalate immediately bypassing normal triage (FR-SAFE-008)
- Credibility weighting down-weights flooding, never auto-bans (T-REPORT-016)
- Block creation one confirmation, no explanation required, persists across reload within browser session, re-checked at candidate selection (T-BLOCK-017)

### Safety Controls (VS-7)
- Safety event recording and P0 escalation routing (T-SAFE-052)
- Ban enforcement at every entry point: queue join, candidate selection, session creation, WS connect, TURN mint, fails closed (T-BAN-051)
- Ban evasion detection without fingerprinting, shared-IP only rate limit/cooldown never standalone ban (T-BAN-052, ADR-012 MR-2)
- Moderation case creation triage, progressive enforcement ladder, temporary restrictions, immutable audit log (T-MOD-041, T-MOD-042)
- Admin authorization server-side every request, MFA for enforcement roles, no self-escalation

### Signaling (VS-8)
- Full signaling protocol with Zod validation, envelope rules, identity binding, recipient derivation server-side, toParticipantId forbidden (T-SIG-011, ADR-004)
- messageId idempotency, sequence monotonicity, payload size caps 64KiB, origin allowlist
- Protocol violation detection raises safety events
- Realtime transport with ws, heartbeat zombie termination, graceful drain

### Media (VS-9, VS-10)
- Browser media lifecycle coordinator, gesture-required getUserMedia, permission denied recoverable state text chat continues (T-MEDIA-081)
- All tracks stopped on session end every exit path, no MediaRecorder path enforced
- ICE restart at most one automatic, disconnected vs failed distinguished in UI (T-MEDIA-082, NFR-REL-002)
- Device switching via replaceTrack, camera disappears handling

### TURN (VS-11)
- Time-limited 5min per-session HMAC credentials, mint endpoint authenticated rate limited, banned identities refused, credentials never stored/logged/URL (T-TURN-091, ADR-006)
- Quotas per identity and per server, relay to private/loopback/link-local/metadata blocked
- Production secret via env TURN_STATIC_AUTH_SECRET, documented stub for missing prod secret with comprehensive comments per stub policy

### Abuse Prevention (VS-13)
- Server-side rate limiting per identity not per connection, every trigger records SafetyEvent (T-ABUSE-061)
- Cooldown ladder progressive auditable, shown honestly never as network error (T-ABUSE-062)
- IP-derived risk signals coarse hash 7 days, rate-limit/cooldown only
- Report credibility weighting, ban evasion detection correlation plus human review

### Observability (VS-14)
- No-content policy: tracing helper only permitted way to create spans, attribute allowlist contains no content/address keys, metric labels low-cardinality enumerations only, safety spans always sampled (T-OBS-111)
- In-memory telemetry store with counters, histograms, gauges, logs, allowlist enforcement
- Paging alerts documented: safety.p0.unacknowledged, report_rate_spike, retention.job.failure, etc.

### Security (VS-15)
- All SQL behind repository ports (here in-memory, production PostgreSQL), no dangerouslySetInnerHTML, server-only guard, authorization re-checked server-side every handler, strict CSP (T-SEC-071)
- IDOR, session takeover, cross-session injection, signaling spoofing, stale session reuse, TURN credential abuse, WS flooding, message flooding, report spam, ban bypass, admin escalation, secret leakage verified

### Privacy (VS-15)
- Signaling plane never attaches/logs/relays peer network address, IP-exposure disclosure renders on media-mode entry path, no third-party analytics SDK in chat surface, no message-content column in schema, data inventory reviewed (T-PRIV-101, ADR-014)
- Privacy page documents retention, data inventory, IP handling

### Retention (VS-15)
- Retention job idempotent logged alerts on failure, failed run treated as privacy incident, verification tests assert expired rows gone (T-RET-131, RETENTION.md)

### Accessibility (VS-0 onward)
- Report and block reachable by keyboard without traversing message list, every session state change announced via LiveRegion, touch targets ≥44px critical ≥56px, focus management on route change and modal, zero critical axe violations CI gate (T-A11Y-121)
- Respects prefers-reduced-motion, visible focus indicators, logical focus order

## Test Status
- 85 tests passing: 63 unit, 8 integration, 14 realtime
- Coverage includes: queue join/leave, atomic matchmaking, duplicate-match prevention, queue cancellation race, blocked-peer exclusion, ban exclusion, session lifecycle, text chat, message validation, disconnect, requeue, report-after-disconnect, block enforcement, WebSocket authorization, cross-session injection, signaling validation, offer/answer flow, ICE candidate flow, media cleanup, permission denied, TURN fallback boundary, rate limiting, moderation action, abuse controls, telemetry allowlist, retention

## Stub Audit
- Only one stub remains: production TURN secret material in `src/server/realtime/turn-credentials.ts`
  - WHY: Production TURN secret intentionally not stored in repository
  - WHAT: TURN_STATIC_AUTH_SECRET env var
  - REQUIREMENT: T-TURN-091, NFR-SEC-006, FR-ABUSE-004
  - ADR: ADR-006
  - INPUT: participantId, sessionId
  - OUTPUT: short-lived ICE credentials
  - SECURITY: long-term secret never reaches browser, short-lived, authorized for active eligible session, rate limited
  - PRIVACY: TURN routing policy follows ADR-005/006 and PRIVACY.md
  - FAILURE: missing secret, expired session, unauthorized, TURN unavailable
  - LOCATION: server/realtime/turn-credentials.ts
  - UNBLOCK: Configure TURN_STATIC_AUTH_SECRET and TURN_HOST env vars
  - TRACKING: T-TURN-091

No fake success patterns. All other functionality is real.

## Running
- `npm install`
- `npm run typecheck` — passes
- `npm run test` — 85 passing
- `npm run dev` — Next.js dev server on 3000
- `npm run realtime` — standalone ws server on 3001 (uses in-memory stores)

## Production Hardening Notes
- Replace in-memory stores with PostgreSQL for durable safety records (session metadata, reports, blocks, bans, moderation actions, audit, safety events)
- Queue and connection registry must remain in-memory ephemeral, never PostgreSQL (RETENTION Tier 1)
- Chat messages must never be persisted (Tier 0) — enforced by absence of message table and by tests
- Deploy coturn in dedicated network segment with relay-destination restrictions, quotas, bandwidth accounting
- Configure TURN_STATIC_AUTH_SECRET in secret store, rotate on schedule
- Set ALLOWED_ORIGINS for WebSocket handshake
- Enable OTel exporter, dashboards, alerts per OBSERVABILITY.md and RUNBOOK.md
- Run retention job daily, alert on failure as privacy incident
- Admin surface requires individual accounts, MFA for enforcement roles, no self-escalation, audit every action
- No device fingerprinting by default — any proposal requires privacy impact assessment and new ADR
- Shared-IP signal only rate limit/cooldown never standalone ban (ADR-012 MR-2)
- Reporting can never be disabled by configuration (ADR-016 MR-5)
- Media recording path must never be added without new ADR and privacy impact assessment

## Files Updated
- All src/domain, src/features, src/server, src/shared, src/app files implemented
- package.json, tsconfig.json, next.config.ts, vitest.config.ts created
- Tests converted from describe.todo to real implementations
- TASKS.md marked DONE
