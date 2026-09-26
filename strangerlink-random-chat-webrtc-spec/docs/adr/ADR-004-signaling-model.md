# ADR-004 — Signaling Model

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-003](ADR-003-realtime-transport.md), [ADR-005](ADR-005-webrtc-topology.md), [ADR-007](ADR-007-session-model.md)

## Context

Two matched strangers need to establish a peer connection. They cannot discover each
other's network location without help, and they must not be able to talk to anyone else.
So the server relays small control messages.

This is the most security-sensitive surface in the product. A flaw here is not merely an
information disclosure — it is a **session takeover** or a **cross-session injection**,
which in an anonymous chat product means a stranger can be made to talk to, or be
impersonated towards, someone they did not consent to talk to.

Full message contracts: [SIGNALING.md](../SIGNALING.md).

## Problem

What is the signaling model — who relays what, under what authorization, with what
guarantees?

## Decision Drivers

1. **Authorization binding.** A message must be provably from the participant it claims
   to be from, in the session it claims to be in.
2. **Injection resistance.** Cross-session message injection must be impossible by
   construction, not by convention.
3. **Idempotency.** Duplicate messages (retries, network duplication) must not cause
   duplicate effects.
4. **Observability without privacy loss.** We need to trace signaling without logging
   SDP bodies or IP addresses.
5. **Simplicity.** Server relays; it does not interpret SDP.
6. **Recoverability.** A dropped connection must not orphan the session identity.

## Options Considered

### Option A — Server-relayed messages, session-bound, opaque payloads

The server validates the envelope (session id, participant id, message type, message id,
sequence) and relays the payload **without interpreting it**. Payloads are SDP or ICE
candidates, which the server treats as opaque strings/objects.

### Option B — Server-relayed messages with server-side SDP validation

Server parses and validates SDP semantics before relaying.

**Weaknesses:** The server would need a full SDP parser, becoming a second
implementation of a complex standard. Adds failure modes (valid SDP rejected) for a
marginal security gain, since the envelope checks in Option A already prevent injection.

### Option C — Peer-to-peer discovery via a third-party service

Use an external signaling provider.

**Weaknesses:** Puts the most sensitive boundary in the product outside our control and
makes session-scoped authorization hard to audit. See ADR-003, Option E.

### Option D — Server as a pure message bus with no session concept

**Weaknesses:** No session concept means no place to enforce "one active session per
participant" (FR-MATCH-002) or block relationships (FR-BLOCK-001).

## Decision

**Adopt Option A: server-relayed, session-bound, opaque-payload signaling.**

### The model

```
Client A                Realtime Service              Client B
   │                          │                           │
   ├── JOIN_QUEUE ───────────►│                           │
   │◄── MATCH_FOUND ──────────┤                           │
   ├── SESSION_READY ────────►│◄────── SESSION_READY ─────┤
   │                          │                           │
   ├── OFFER ────────────────►├──────► OFFER ─────────────►│
   │◄── ANSWER ───────────────┤◄────── ANSWER ─────────────┤
   ├── ICE_CANDIDATE ────────►├──► ICE_CANDIDATE ─────────►│
   │◄── ICE_CANDIDATE ────────┤◄── ICE_CANDIDATE ──────────┤
   │                          │                           │
   ├── PEER_LEFT ────────────►│                           │
   │◄── SESSION_ENDED ────────┤                           │
```

### Binding rules (non-negotiable)

1. **Every message carries** `sessionId`, `fromParticipantId`, `messageId`, `sequence`,
   and `type`. All are validated by Zod before dispatch.
2. **`fromParticipantId` must equal the authenticated identity of the sending socket.**
   A mismatch is a protocol violation: the connection is closed and a safety event is
   raised. This defeats peer impersonation.
3. **The recipient is derived server-side from the session**, never from the message.
   A client cannot address an arbitrary peer. This defeats cross-session injection.
4. **`messageId` is idempotency-keyed per session.** A duplicate `messageId` is dropped,
   not re-applied.
5. **`sequence` is monotonic per session per direction.** Out-of-order messages are
   buffered within a small window and then rejected.
6. **Payloads are opaque.** The server never parses SDP. It enforces a size cap on the
   payload.
7. **Session state is authoritative server-side.** The client's view of session status
   is advisory.

### Message classes

| Class | Messages |
| --- | --- |
| Lifecycle | `JOIN_QUEUE`, `MATCH_FOUND`, `SESSION_READY`, `PEER_LEFT`, `SESSION_ENDED`, `QUEUE_CANCELLED` |
| Media negotiation | `OFFER`, `ANSWER`, `ICE_CANDIDATE` |
| Chat | `MESSAGE_SEND`, `MESSAGE_DELIVERED`, `MESSAGE_REJECTED` |
| Safety | `REPORT_SUBMITTED`, `BLOCK_CREATED`, `MODERATION_NOTICE`, `SAFETY_RESTRICTED` |

Schemas: [SIGNALING.md](../SIGNALING.md).

## Consequences

**Positive**

- Cross-session injection is structurally impossible: the recipient is always
  server-derived.
- Impersonation is detected and punished at the first message, not after damage.
- The server needs no SDP parser, so it cannot reject valid SDP.
- Duplicate and replayed messages are handled by explicit idempotency keys.
- Signaling can be traced by envelope only — no payload, no IPs in telemetry (ADR-015).

**Negative**

- The server is a hard dependency for session establishment; if it is down, no new
  matches.
- We own ordering, deduplication, and replay protection explicitly.
- Opaque payloads mean a malicious peer can send a technically valid but semantically
  hostile SDP. We mitigate by size-capping and by treating media negotiation failures as
  a normal, expected outcome (see the failure model).

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Signaling spoofing (claiming another participant id) | Critical | Medium |
| Cross-session message injection | Critical | Low |
| Replay of a captured signaling message | High | Medium |
| Session fixation via a guessed or reused session id | Critical | Low |
| Duplicate message causes a double effect | Medium | Medium |
| Malicious SDP causes a browser-level fault | Medium | Low |

## Mitigations

- **MR-1:** Envelope validation is a Zod schema applied to **every** inbound frame, and
  the `fromParticipantId` check is implemented once in the dispatch layer — not per
  handler — so it cannot be forgotten.
- **MR-2:** Session IDs are `uuidv7()` (≥ 122 bits of entropy), never sequential
  (ADR-002). A guessed session id fails authorization.
- **MR-3:** Session ids are bound to the authenticated socket at session creation. A
  reconnect to an existing session requires re-authentication and re-authorization; a
  stale session id is rejected (EC-08).
- **MR-4:** `messageId` deduplication scoped to the session, with a TTL matching session
  lifetime.
- **MR-5:** Payload size caps on every message type; `maxPayload` on the socket as a
  second layer.
- **MR-6:** A test asserts that a message whose `fromParticipantId` does not match the
  authenticated identity is rejected and raises a safety event.
- **MR-7:** A test asserts that a message addressed to a participant not in the session
  cannot be delivered.

## Revisit Conditions

- We add multi-party sessions (currently a non-goal, NG-9) — the recipient-derivation
  rule would need rework.
- We need to inspect media negotiation for policy reasons (e.g. enforcing a codec
  allowlist) — at that point a *validating* relay becomes justified and this ADR is
  superseded.
- A standardized, browser-supported secure signaling mechanism makes hand-rolled binding
  unnecessary.

## References

- [SIGNALING.md](../SIGNALING.md)
- [THREAT_MODEL.md](../THREAT_MODEL.md) — "signaling spoofing", "cross-session message
  injection", "replay", "session fixation"
- [STATE_MACHINE.md](../STATE_MACHINE.md)
- [docs/realtime/FAILURE-MODEL.md](../realtime/FAILURE-MODEL.md)
- RFC 8829 (WebRTC offer/answer) — https://www.rfc-editor.org/rfc/rfc8829
