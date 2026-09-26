# StrangerLink — Test Matrix

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [TESTING.md](../../TESTING.md), [QA.md](../../QA.md), [docs/TRACEABILITY.md](../TRACEABILITY.md)

---

## 0. Position

This matrix maps every testable property to a layer, a tool, and a slice. It exists so that
"we tested it" means something specific.

**All existing test files contain only `describe.todo` skeletons.** Nothing is implemented.

---

## 1. Matrix

### 1.1 Domain invariants — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| INV-1 one active session per participant | "prevents one participant from entering two active sessions" | VS-3 |
| INV-2 exactly two distinct participants | "rejects a session with identical participants" | VS-3 |
| INV-3 only documented transitions | "rejects an undocumented transition" | VS-3 |
| INV-4 terminal states absorbing | "does not reactivate a terminal session" | VS-3 |
| INV-5 no session between blocked participants | "does not create a session between blocked participants" | VS-6 |
| INV-6 no session for a banned participant | "does not create a session for a banned participant" | VS-7 |
| INV-7 session ids never client-supplied | "never accepts a client-supplied session id" | VS-3 |
| INV-8 report against a terminal session | "accepts a report against a terminal session" | VS-6 |

### 1.2 Matchmaking — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| FR-MATCH-004 departed participant | "does not match a participant who has left the queue" | VS-3 |
| FR-MATCH-003 blocked participants | "does not match blocked participants" | VS-3 |
| FR-MATCH-011 banned participants | "does not match a banned participant" | VS-3 |
| FR-MATCH-005 recent peers | "does not immediately rematch recent peers" | VS-3 |
| FR-MATCH-006 mode compatibility | "never matches incompatible modes" | VS-3 |
| FR-MATCH-007/008 preference fallback | "falls back to the general pool after the preference window" | VS-3 |
| FR-MATCH-009 concurrency (R1) | "resolves concurrent match attempts to one session" | VS-3 |
| FR-MATCH-010 atomicity | "creates a session for both peers or neither" | VS-3 |
| R2 cancel during match | "aborts a match when the participant cancels" | VS-3 |
| R9 expiry at match instant | "resolves an expiry that races a match" | VS-3 |
| R10 ban while waiting | "applies a ban issued while the participant waits" | VS-3 |

### 1.3 Queue — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| FR-QUEUE-001 one ticket | "returns the existing ticket for a second join" | VS-2 |
| FR-QUEUE-002 immediate cancel | "cancels immediately and releases the claim" | VS-2 |
| FR-QUEUE-006 bounded wait | "offers retry or exit on expiry, never auto-requeue" | VS-2 |
| R5 block during requeue | "re-checks blocks when requeuing" | VS-5 |

### 1.4 Chat — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| FR-CHAT-002 ordering | "orders messages by sequence" | VS-4 |
| FR-CHAT-003 length | "rejects a message over the length limit" | VS-4 |
| FR-CHAT-004 rate | "rate limits messages per session" | VS-4 |
| FR-CHAT-008 no persistence | "does not persist message content" | VS-4 |
| C1 duplicate sequence | "drops a duplicate sequence number" | VS-4 |
| C2 permanent gap | "renders available messages after the buffer window" | VS-4 |
| C3 message as session ends | "rejects a message sent as the session ends" | VS-4 |
| C4 stale sequence on reconnect | "treats the server sequence as authoritative" | VS-4 |
| C5 simultaneous sends | "handles simultaneous sends with independent sequences" | VS-4 |
| C6 peer dies mid-relay | "drops a message when the peer socket is gone" | VS-4 |

### 1.5 Reports — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| FR-REPORT-003 category validation | "rejects an unknown category" | VS-6 |
| FR-REPORT-004 fields | "captures exactly the documented fields" | VS-6 |
| FR-REPORT-005 no PII | "does not collect name, email, or phone" | VS-6 |
| FR-REPORT-006 dedup | "collapses a duplicate report" | VS-6 |
| FR-REPORT-007 rate limit | "rate limits report submission" | VS-6 |
| FR-REPORT-009 no reasoning | "returns acknowledgement without moderation reasoning" | VS-6 |
| FR-REPORT-010 P0 routing | "routes a minor-safety report to the P0 queue" | VS-6 |
| FR-ABUSE-008 credibility | "down-weights reports from an identity reporting many peers" | VS-6 |

### 1.6 Moderation and bans — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| FR-MOD-001 case per report | "creates a case for every report" | VS-12 |
| FR-MOD-002 severity | "assigns P0 to minor safety" | VS-12 |
| FR-MOD-004 reason required | "rejects an action without a reason code" | VS-12 |
| FR-MOD-005 audit | "writes an audit record for every action" | VS-12 |
| FR-MOD-006 no automation | "does not invoke automated classification" | VS-12 |
| FR-MOD-008 every entry point | "consults the ban port at every entry point" | VS-7 |
| FR-SAFE-005 progressive | "escalates progressively" | VS-7 |
| FR-ABUSE-006 shared-IP rule | "a shared-IP signal cannot trigger a standalone ban" | VS-13 |

### 1.7 Validation and telemetry — unit (Vitest)

| Property | Test | Slice |
| --- | --- | --- |
| Every signaling schema | "accepts a valid message and rejects a malformed one" | VS-8 |
| NFR-OBS-002 no content attributes | "the tracing helper rejects disallowed keys" | VS-14 |
| T-21 no log leakage | "the logging helper rejects disallowed keys" | VS-14 |
| T-12 no address in envelope | "the relayed envelope contains no address fields" | VS-8 |
| T-32 cardinality | "metric labels are enumerations only" | VS-14 |

### 1.8 Integration (Vitest + PostgreSQL container)

| Property | Test | Slice |
| --- | --- | --- |
| Repository ports | CRUD against a real database | VS-7 |
| Authorization matrix | "rejects every unauthorized caller" | VS-1 |
| IDOR | "rejects access to another participant's session" | VS-1 |
| SQL injection | injection payload suite | VS-1 |
| CSRF | "rejects a mutating request without a valid token" | VS-1 |
| Open redirect | "rejects an external redirect target" | VS-1 |
| Admin escalation | "a non-admin cannot reach any admin route" | VS-12 |
| Ban store down (T-34) | "fails closed when the ban store is unreachable" | VS-7 |
| Schema guard (T-30) | "no message-content column exists" | VS-7 |
| Retention (T-31) | "deletes expired rows per tier" | VS-15 |
| Rate limits | "enforces every documented limit per identity" | VS-13 |

### 1.9 Realtime protocol (Vitest + real `ws`)

| Property | Test | Slice |
| --- | --- | --- |
| Handshake auth | "refuses an unauthenticated upgrade" | VS-2 |
| Origin allowlist | "refuses a disallowed origin" | VS-2 |
| Envelope validation | "rejects a malformed frame" | VS-8 |
| T-01 impersonation | "rejects a message whose fromParticipantId is not the authenticated identity" | VS-8 |
| T-03 cross-session | "cannot deliver a message to a participant not in the session" | VS-8 |
| T-11 replay | "drops a duplicate messageId" | VS-8 |
| T-11 reordering | "handles an out-of-order sequence" | VS-8 |
| R7 stale session | "rejects a reconnect to a stale session id" | VS-8 |
| R12 supersession | "supersedes an older socket" | VS-8 |
| Payload cap | "rejects an oversized frame" | VS-8 |
| Rate limit | "rate limits frames per connection" | VS-2 |
| Zombie termination | "terminates a zombie socket" | VS-2 |

### 1.10 WebRTC browser (Playwright + Vitest browser mode)

| Property | Test | Slice |
| --- | --- | --- |
| Permission granted | "media becomes active after a gesture" | VS-9 |
| Camera denied (QA-09) | "camera denied shows a recoverable state and continues in text" | VS-9 |
| Microphone denied (QA-10) | "microphone denied shows a recoverable state" | VS-9 |
| Permission dismissed | "treats a dismissed prompt as denied" | VS-9 |
| Revoked mid-session | "continues in text when permission is revoked" | VS-9 |
| Device switching | "switches camera without ending the session" | VS-10 |
| Camera disappears | "shows a media failure state and continues" | VS-10 |
| Connection establishment | "establishes a peer connection" | VS-9 |
| ICE restart | "restarts ICE on network change" | VS-10 |
| TURN fallback (QA-14) | "connects via relay when direct fails" | VS-11 |
| ICE timeout | "shows a specific state on ICE timeout" | VS-10 |
| Track cleanup | "stops all tracks on session end" | VS-9 |
| No recording | "no code path calls MediaRecorder" (static analysis) | VS-9 |

### 1.11 End-to-end (Playwright, multi-context)

| Property | Test | Slice |
| --- | --- | --- |
| Full text chat | "delivers and orders messages between two peers" | VS-4 |
| Peer disconnect (QA-05) | "shows 'your stranger left the chat'" | VS-4 |
| Skip (QA-06) | "skips without a confirmation modal" | VS-5 |
| Requeue (QA-07) | "does not rematch a recent peer" | VS-5 |
| Report (QA-18) | "submits a report from an active session" | VS-6 |
| Report after disconnect (QA-19) | "accepts a report after the peer disconnects" | VS-6 |
| Block (QA-21) | "blocks and prevents rematch" | VS-6 |
| Block persists (QA-22) | "block survives reload" | VS-6 |
| Age gate bypass (QA-26) | "redirects direct navigation without consent" | VS-1 |
| Exit from every state (QA-08) | "exits from every session state" | VS-5 |
| Two tabs (QA-29) | "supersedes the older tab" | VS-5 |
| Stale session (QA-28) | "rejects a reload of an ended session" | VS-5 |
| Six disconnect states | "distinguishes all six states" | VS-4 |
| Rate limit (QA-24) | "shows an honest cooldown message" | VS-13 |
| Link handling (QA-42) | "renders a link inert and never fetches it" | VS-4 |
| Image paste (QA-43) | "ignores a pasted image" | VS-4 |
| Long message (QA-41) | "rejects an over-length message visibly" | VS-4 |
| Accessibility | "zero critical axe violations" | VS-0 |
| Keyboard journey (QA-36) | "completes the journey by keyboard alone" | VS-3 |
| Report accessibility (QA-38) | "reaches and submits a report by keyboard" | VS-6 |
| Storage blocked (QA-40) | "degrades gracefully when storage is blocked" | VS-1 |

### 1.12 Load and stress

| Property | Tool | Slice |
| --- | --- | --- |
| WebSocket connection ramp | Load tool (TBD) | VS-15 |
| Match throughput | Load tool | VS-15 |
| Message flood | Load tool | VS-13 |
| Queue join/leave storm | Load tool | VS-3 |
| TURN saturation | Load tool + coturn metrics | VS-11 |
| Report flood | Load tool | VS-12 |
| Realtime restart under load | Deploy test | VS-15 |

---

## 2. Coverage by requirement class

| Class | Requirements | Automated tests | Manual/drill | Total |
| --- | --- | --- | --- | --- |
| P0 safety | 30 | 26 | 4 | 30 |
| P1 safety | 48 | 42 | 6 | 48 |
| P2 | 46 | 38 | 8 | 46 |
| **Total** | **124** | **106** | **18** | **124** |

---

## 3. CI gates

| Gate | Blocks release |
| --- | --- |
| Typecheck | Yes |
| Lint (incl. `dangerouslySetInnerHTML`, `server-only`) | Yes |
| Unit | Yes |
| Integration | Yes |
| Bundle budget | Yes |
| axe critical violations | Yes |
| Security tests | Yes |
| Critical dependency CVE | Yes |
| Load test | No (informational until VS-15) |

---

## 4. Implementation status

Skeletons exist in `tests/unit/`, `tests/integration/`, `tests/realtime/`, and
`tests/e2e/`, containing only `describe.todo` calls. No test is implemented.
