# ADR-003 — Realtime Transport

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-004](ADR-004-signaling-model.md), [ADR-007](ADR-007-session-model.md)

## Context

StrangerLink has exactly one realtime requirement: a **signaling plane** that carries
small control messages between two matched clients and the server — queue join, match
found, SDP offer/answer, ICE candidates, peer left, session ended.

Media does **not** flow through this transport. Media is peer-to-peer WebRTC (ADR-005).
So the realtime transport carries only control messages, and those messages are small
and infrequent (a handful per session, with a burst during ICE).

Requirements on the transport:

- Small, well-typed messages with strict validation (NFR-SEC-004).
- Per-connection and per-message rate limits (NFR-SEC-001).
- Authentication **before** any protocol message is processed (NFR-SEC-002).
- Cross-session message injection must be impossible (NFR-SEC-005).
- Low client bundle cost against the JS budget (NFR-PERF-001).
- A failure model we can reason about and test
  ([docs/realtime/FAILURE-MODEL.md](../realtime/FAILURE-MODEL.md)).

## Problem

Which transport and library should carry the signaling plane?

## Decision Drivers

1. **Protocol control.** We define the message contract; the transport must not impose
   its own framing that we cannot validate.
2. **Security surface.** Origin checks, payload caps, handshake-time auth.
3. **Bundle size.** Client JS budget is tight.
4. **Failure model clarity.** We must be able to reason about and test disconnect,
   reconnect, stale connection, and duplicate messages.
5. **Operational simplicity.** One small team.
6. **Concurrency ceiling.** Thousands of concurrent waiting participants, not millions.

## Options Considered

### Option A — `ws` (raw WebSocket)

Minimal RFC 6455 implementation. ~80M weekly downloads. Roughly 3–5× the raw throughput
of Socket.IO in comparative benchmarks, p99 ~5 ms. Provides ping/pong, `maxPayload`,
`close()` vs `terminate()`. Provides **no** rooms, no auto-reconnect, no fallback.

### Option B — Socket.IO

Adds rooms, namespaces, acks, auto-reconnect, HTTP long-polling fallback, and a Redis
adapter. ~45 KB gzipped client. Custom protocol framing on top of WebSocket.

### Option C — uWebSockets.js

C++ implementation; roughly 10× the connection capacity of `ws`, ~1 ms p99, lowest
per-connection memory. Native build.

### Option D — Server-Sent Events + HTTP POST

Simple, auto-reconnecting, firewall-friendly. Unidirectional from server.

### Option E — Managed realtime (Ably / Pusher)

No infrastructure. Per-connection cost.

## Decision

**Adopt `ws` over TLS (`wss://`) as the signaling transport, in a dedicated realtime
service separate from the Next.js application.**

Non-negotiable configuration:

| Concern | Commitment |
| --- | --- |
| Transport | `wss://` only; plaintext `ws://` is rejected in every environment |
| Authentication | Performed during the **HTTP upgrade handshake**, not on the first message. An unauthenticated socket is closed before it opens. |
| Origin | Checked against an explicit allowlist during the handshake |
| Payload | `maxPayload` set to a small cap (signaling frames are tiny; 64 KiB is generous). Oversized frames terminate the connection. |
| Heartbeat | Protocol-level ping/pong; zombie sockets are `terminate()`d |
| Message validation | Every inbound frame parsed and validated with a Zod schema before dispatch |
| Rate limiting | Per-connection token bucket for frames; per-identity limits for queue join, session creation, and reports |
| Graceful shutdown | Drain period before pod termination so in-flight signaling completes |

### Why a separate realtime service

Keeping WebSocket handling in its own process means: the long-lived connection lifecycle
is isolated from request/response rendering; a socket flood cannot exhaust the web tier;
and the realtime service can be scaled and restarted independently. This is recorded in
[ARCHITECTURE.md](../ARCHITECTURE.md).

## Consequences

**Positive**

- Complete control over framing, validation, and rate limits — every inbound byte is
  schema-checked before it reaches domain logic.
- Small client bundle; no inherited protocol overhead.
- The failure model is ours, so it is testable: reconnect, stale connection, and
  duplicate-message handling are explicit and covered by tests.
- Flood isolation: a socket flood hits the realtime tier only.

**Negative**

- **We implement reconnection, backoff, and heartbeat ourselves.** This is real work and
  a real source of bugs if done carelessly.
- No HTTP long-polling fallback: environments that block WebSocket upgrades will not
  work. Accepted, and recorded as a limitation in
  [docs/realtime/FAILURE-MODEL.md](../realtime/FAILURE-MODEL.md).
- Cross-instance routing is manual if we ever run more than one realtime instance —
  which is the trigger for the Redis decision.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Hand-rolled reconnection logic has a bug that strands users in a dead session | High | Medium |
| WebSocket flood exhausts realtime instances | High | Medium |
| Zombie sockets accumulate and leak memory | Medium | High |
| A hostile origin is allowed through | High | Low |
| We outgrow a single instance and have no cross-instance routing | Medium | Medium |

## Mitigations

- **MR-1:** Reconnect behaviour is implemented once in a single module
  (`src/features/signaling/`) and is covered by dedicated tests in `tests/realtime/`
  including "reconnect to a stale session id is rejected" (EC-08).
- **MR-2:** Layered limits: per-connection frame rate, per-identity action rate, and a
  global connection cap per instance with an alert. Documented in
  [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md).
- **MR-3:** Heartbeat with `terminate()` for zombies; connection count is a metric
  (NFR-OBS-001) with an alert on abnormal growth.
- **MR-4:** Origin allowlist is configuration, not code, and is asserted in a test.
- **MR-5:** Running more than one realtime instance requires adopting cross-instance
  routing **and** the Redis decision in the same change. This is an explicit gate, not an
  afterthought. See ADR-002's conditional Redis entry.

## Revisit Conditions

- We need to support networks that block WebSocket upgrades → reconsider Socket.IO's
  fallback, or add an SSE+POST transport.
- Connection count per instance exceeds the measured ceiling in load testing
  ([TESTING.md](../TESTING.md)) → consider uWebSockets.js **with** load-test evidence.
- We run multiple realtime instances → adopt Redis for routing and shared rate limits.
- A future WebTransport-based transport becomes viable across our target browsers.

## References

- `ws` — https://github.com/websockets/ws
- RFC 6455 (The WebSocket Protocol) — https://www.rfc-editor.org/rfc/rfc6455
- [SIGNALING.md](../SIGNALING.md)
- [docs/realtime/FAILURE-MODEL.md](../realtime/FAILURE-MODEL.md)
- [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md)
- [docs/research/STACK-2026.md](../research/STACK-2026.md)
