# StrangerLink — Realtime Failure Model

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-003](../adr/ADR-003-realtime-transport.md), [ADR-004](../adr/ADR-004-signaling-model.md), [STATE_MACHINE.md](../../STATE_MACHINE.md)

> **Recovery is not implemented.** This document defines the failure model that recovery
> must satisfy.

---

## 0. Position

Every failure below has a **defined behaviour**, a **user-visible state**, and a
**recovery path**. The rule that governs all of them:

> **The user is never left without information about what is happening.**

A silent spinner is a worse outcome than a clear failure.

---

## 1. Transport failures

### 1.1 WebSocket disconnect

| Property | Value |
| --- | --- |
| **Detection** | `onclose` / `onerror` on the client; socket teardown on the server |
| **Immediate behaviour** | The session is **not** ended. A reconnect window opens (15 s) |
| **User sees** | "Reconnecting…" with a neutral indicator |
| **Recovery** | Client reconnects with backoff and jitter; the server re-authorises and re-binds |
| **If recovered** | Sequence position is re-synchronised; the client re-renders from its buffer |
| **If not recovered** | `ACTIVE → FAILED`, reason `transport-lost` |
| **User sees on failure** | "Your connection was lost." + **Leave** |
| **Race** | R12 — a reconnect arriving before the old socket is closed supersedes it |

### 1.2 WebSocket reconnect

| Property | Value |
| --- | --- |
| **Trigger** | Transport loss within the reconnect window |
| **Backoff** | Exponential with jitter, capped |
| **Re-authorisation** | Required. A reconnect is not a continuation of the old socket's authority |
| **Session binding** | Re-established; a stale session id is rejected (R7) |
| **Supersession** | A second socket for the same identity supersedes the first (`SESSION_SUPERSEDED`) |
| **Messages sent while disconnected** | **Not queued for later delivery.** Holding message content beyond the session is not acceptable |

### 1.3 Stale connection

| Property | Value |
| --- | --- |
| **Definition** | A socket that has not responded to a ping within the heartbeat interval |
| **Detection** | Server-side heartbeat |
| **Behaviour** | `terminate()` — the socket is destroyed immediately rather than closed gracefully |
| **Consequence** | Any session on it enters the disconnect path (1.1) |
| **Prevention** | Connection count is a metric with an alert on abnormal growth |

### 1.4 Peer disappears

| Property | Value |
| --- | --- |
| **Detection** | The peer's socket closes, or the reconnect window expires |
| **Behaviour** | `ACTIVE → ENDING`, reason `peer-left` |
| **User sees** | "Your stranger left the chat." |
| **Race** | R3 — both peers disconnecting simultaneously produce exactly one session end |
| **Note** | The user may still submit a report against the ended session (FR-REPORT-002) |

---

## 2. Media failures

### 2.1 ICE timeout

| Property | Value |
| --- | --- |
| **Detection** | No working candidate pair within the gathering/setup timeout (5 s gather, 15 s setup) |
| **Behaviour** | `CONNECTING → FAILED`, reason `ice-timeout` |
| **User sees** | "Couldn't start the video call. Your internet connection may be blocking it." + **Retry video** / **Continue with text** / **Leave** |
| **Recovery** | One retry attempt is offered; no automatic loop |

### 2.2 TURN unavailable

| Property | Value |
| --- | --- |
| **Detection** | TURN allocation failure, or coturn unreachable |
| **Behaviour** | `CONNECTING → FAILED`, reason `turn-unavailable` |
| **User sees** | "Video is unavailable right now." + **Continue with text** / **Leave** |
| **Text chat** | Continues unaffected |
| **Operational** | Allocation-failure alert fires; see [RUNBOOK.md](../../RUNBOOK.md) RB-05 |

### 2.3 Browser permission denied

| Property | Value |
| --- | --- |
| **Detection** | `NotAllowedError` from `getUserMedia` |
| **Behaviour** | Media state → `denied`. **The session continues in text.** |
| **User sees** | "Camera access was blocked. You can still chat by text." + settings link + **Continue with text** |
| **Revoked mid-session** | Media state → `failed`; the session continues; the user is informed |
| **Dismissed prompt** | Treated as denied |

### 2.4 Camera disappears

| Property | Value |
| --- | --- |
| **Detection** | Track `ended` / `mute` event; `OverconstrainedError` on re-acquire |
| **Behaviour** | Media state → `failed`; the session continues in text |
| **User sees** | "Your camera stopped working." + **Continue with text** |

### 2.5 Network switch (Wi-Fi → cellular)

| Property | Value |
| --- | --- |
| **Detection** | `iceConnectionState` → `failed`, or `connectionState` → `disconnected` beyond a threshold |
| **Behaviour** | One `restartIce()` attempt |
| **If successful** | Session continues; an `ice-restart` metric is recorded; brief "Reconnecting…" |
| **If unsuccessful** | `FAILED` with a specific reason; **Continue with text** offered |
| **Rule** | **At most one automatic restart.** A restart loop is worse than a clear failure |

### 2.6 Tab suspended / backgrounded

| Property | Value |
| --- | --- |
| **Detection** | `visibilitychange`; track state change; heartbeat gap |
| **Behaviour** | Media may stop. The session may end by the idle timeout |
| **User sees on return** | Either a resumed session with a degraded indicator, or a clear "this chat ended" message |
| **Rule** | Never resume silently into a session the user has walked away from |

### 2.7 Mobile browser backgrounding

| Property | Value |
| --- | --- |
| **Behaviour** | As 2.6. Additionally: battery saver may throttle; data saver may block the relay |
| **Data saver blocking the relay** | Media fails with a specific state; text continues |
| **Rule** | The user is told which of these happened, in plain language |

---

## 3. Service failures

### 3.1 Web service down

| Property | Value |
| --- | --- |
| **Blast radius** | No new sessions, no reports via the web tier |
| **Existing sessions** | Continue — the realtime service is independent |
| **Report path** | May degrade. **Any degradation of report submission is a safety matter, not just an availability matter** |
| **Runbook** | RB-11 |

### 3.2 Realtime service down

| Property | Value |
| --- | --- |
| **Blast radius** | No new matches |
| **Existing sessions** | WebSocket connections drop; users are returned to a clean state |
| **Queue** | Lost; users are informed, not left hanging |
| **Runbook** | RB-12 |

### 3.3 Realtime instance restart

| Property | Value |
| --- | --- |
| **Behaviour** | In-flight sessions → `FAILED`, reason `server-restart` |
| **User sees** | "Something went wrong. Please start a new chat." + **Start a new chat** |
| **Deploy safety** | Graceful drain period so in-flight signaling completes before termination |

### 3.4 PostgreSQL unavailable

| Property | Value |
| --- | --- |
| **Queue and active sessions** | Continue — they are in-memory |
| **Ban checks** | **Fail closed.** No new matches are created |
| **Reports** | Fail visibly. Never silently dropped |
| **User sees** | "Something went wrong." + **Report a problem** (which will also fail, but the attempt is visible and logged) |
| **Runbook** | RB-04 |
| **Rule** | **Never bypass fail-closed behaviour to restore availability** |

### 3.5 coturn down

| Property | Value |
| --- | --- |
| **Blast radius** | Video and audio on restrictive networks |
| **Text chat** | Unaffected |
| **Runbook** | RB-05 |

### 3.6 Observability backend down

| Property | Value |
| --- | --- |
| **User impact** | None |
| **Operational impact** | No telemetry; alerts suppressed |
| **Rule** | The application must not block or fail on telemetry export failure |

---

## 4. Failure → UI state mapping

| Failure | UI state | Tone |
| --- | --- | --- |
| Peer left | "Your stranger left the chat." | Neutral, factual |
| Transport lost | "Your connection was lost." | Neutral |
| Reconnecting | "Reconnecting…" | Calm, transient |
| ICE timeout | "Couldn't start the video call." | Neutral, technical |
| TURN unavailable | "Video is unavailable right now." | Neutral |
| Permission denied | "Camera access was blocked. You can still chat by text." | Helpful, recoverable |
| Camera stopped | "Your camera stopped working." | Neutral |
| Session timeout | "This chat ended because it ran too long." | Neutral |
| Moderation disconnect | "This chat was ended by moderation." | Neutral, non-specific |
| Blocked by you | "You blocked this person." | Confirmatory |
| Server restart | "Something went wrong. Please start a new chat." | Neutral |
| Rate limited | "Please wait a few seconds before trying again." | Honest |
| Restricted | "You can't start new chats right now." | Neutral |
| Offline | "You appear to be offline." | Neutral |
| Stale session | "This chat has already ended." | Neutral |

**Never** "Connection lost" when the peer simply left. **Never** a generic spinner for more
than five seconds. **Never** moderation reasoning.

---

## 5. Recovery guarantees

| Guarantee | Detail |
| --- | --- |
| Bounded reconnect | 15 seconds |
| Bounded ICE setup | 15 seconds |
| Bounded ICE gathering | 5 seconds |
| One ICE restart | Maximum |
| Bounded queue wait | Queue timeout |
| Bounded session | 30 minutes |
| Bounded idle | 10 minutes |
| Bounded TURN credential | 5 minutes |
| Bounded message buffer | 16 out-of-order messages |

Every bound is finite. There is no unbounded wait anywhere in the system.

---

## 6. What recovery must never do

| Never | Why |
| --- | --- |
| Silently drop a report | Safety |
| Silently end a session without telling the user | Trust |
| Retry indefinitely | Resource exhaustion |
| Bypass authorization on reconnect | Security |
| Replay a stale session | Security |
| Queue messages held past the session | Privacy |
| Restart ICE in a loop | Battery and bandwidth |
| Present a moderation disconnect as a network error | Deception |

---

## 7. Implementation status

No recovery logic exists. Tracked as **T-SESSION-END-015** (reconnect),
**T-MEDIA-081** (media lifecycle), and **T-MEDIA-082** (ICE restart).
