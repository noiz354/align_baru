# StrangerLink — WebRTC Architecture

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-005](docs/adr/ADR-005-webrtc-topology.md), [ADR-006](docs/adr/ADR-006-turn-strategy.md), [SIGNALING.md](SIGNALING.md)

> **No WebRTC implementation exists.** No `RTCPeerConnection` is created anywhere in this
> repository. The coordinator port in
> [src/features/media/peer-connection.coordinator.ts](src/features/media/peer-connection.coordinator.ts)
> throws `Not implemented`.

---

## 1. The two planes

This distinction is maintained everywhere — in code, in docs, and in review.

### Signaling Plane

- **Transport:** WebSocket over TLS (`wss://`) through our realtime service.
- **Carries:** queue join, match found, SDP offer/answer, ICE candidates, peer left,
  session ended, chat messages, safety messages.
- **Properties:** authenticated, origin-checked, schema-validated, rate limited, size
  capped.
- **Authorization lives here.** The media plane carries no authorization information.

### Media Plane

- **Transport:** WebRTC, SRTP over DTLS, directly between browsers, or via a coturn relay.
- **Carries:** audio and video RTP.
- **Properties:** encrypted in transit; **no authorization information**; never recorded.
- **Privacy:** peer public IP addresses may be revealed during direct P2P. See
  [ADR-014](docs/adr/ADR-014-anonymity-model.md).

```
SIGNALING PLANE                        MEDIA PLANE

Client A                                Client A
   │                                       │
   ├── signaling ──── Server ──── signaling─┤
   │                    │                  │
   │                    │                  └──── WebRTC Media ────┘
   │                                                 (direct)
   │                                       Client B
   │
   └── when direct fails ───────────────────────────────────────┐
                                                                 ▼
TURN FALLBACK                              Client A ──► TURN Relay ──► Client B
```

---

## 2. Topology

**Peer-to-peer, two-party, with TURN fallback.** No SFU, no MCU, no media server
(ADR-005).

---

## 3. Connection lifecycle

### 3.1 `getUserMedia`

| Aspect | Commitment |
| --- | --- |
| Trigger | **Explicit user gesture only.** Never on page load, never on match (FR-MEDIA-003) |
| Constraints | Video mode requests `{ video: true, audio: true }`; audio mode requests `{ audio: true }` |
| Default state | Both camera and microphone are **off** at match |
| Ideal vs exact | Use `ideal` constraints so the browser can fall back rather than fail outright |
| Failure handling | `NotAllowedError` → permission denied state; `NotFoundError` → no device state; `NotReadableError` → device busy state |

### 3.2 Camera and microphone permissions

| State | User-visible behaviour |
| --- | --- |
| Prompt shown | Neutral; the user initiated it |
| Granted | Media state → `active` |
| Denied | Specific, recoverable state: "Camera access was blocked. You can still chat by text." with a link to browser settings and a "Continue with text" action |
| Dismissed | Treated as denied |
| Revoked mid-session | Media state → `failed`; the session continues in text |

**A permission denial never ends the session.** The user can always continue with text
(FR-MEDIA-004).

### 3.3 `RTCPeerConnection`

| Aspect | Commitment |
| --- | --- |
| Configuration | `iceServers` assembled from STUN plus time-limited TURN credentials (ADR-006) |
| Bundle policy | `max-bundle` |
| RTCP mux | Required |
| ICE candidate pool | Pre-gathered on mode selection to reduce setup latency |
| Trickle ICE | Yes — candidates are exchanged as they are gathered |
| DTLS | Required (SRTP key exchange) |

### 3.4 ICE

| Phase | Detail |
| --- | --- |
| Gathering | Host, server-reflexive (via STUN), and relay (via TURN) candidates |
| Exchange | Trickle, via the signaling plane, one candidate per message |
| Pairing | Browser-controlled; we do not implement ICE ourselves |
| Selection | Highest-priority working pair |
| Restart | `restartIce()` on network change or connection loss |
| Timeout | Bounded; on expiry the state is `FAILED` with reason `ice-timeout` |

**Privacy note:** host and server-reflexive candidates reveal addresses. This is the
residual risk documented in ADR-014 and disclosed to users.

### 3.5 SDP

| Aspect | Commitment |
| --- | --- |
| Role | The offerer creates the offer; the answerer responds |
| Transport | Relayed opaquely through the signaling plane; the server never parses it (ADR-004) |
| Size cap | Enforced by the schema and by `maxPayload` |
| Renegotiation | Supported for enabling media after a text-only start |

### 3.6 STUN

| Aspect | Commitment |
| --- | --- |
| Purpose | Discovering the public IP:port mapping for candidate gathering |
| Servers | Public STUN servers are acceptable for discovery only |
| Sees | The client's public mapping; does not relay media |
| Count | Two STUN servers for redundancy |

### 3.7 TURN

| Aspect | Commitment |
| --- | --- |
| Purpose | Relay when direct connectivity fails |
| Server | Self-hosted coturn (ADR-006) |
| Credentials | Time-limited REST credentials, minted per session, minutes-long lifetime |
| Transports | UDP 3478, TCP 3478, TURNS 5349, plus 443/80 alternates |
| Quotas | Per-identity allocation quota and per-server total quota |

---

## 4. NAT traversal

```
                    ┌─────────────────────┐
                    │  Attempt direct P2P  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │  Host    │    │  srflx   │    │  Relay   │
        │(same LAN)│    │  (STUN)  │    │  (TURN)  │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
             └───────────────┴───────────────┘
                             │
                    ┌────────▼─────────┐
                    │  ICE picks the   │
                    │  best working    │
                    │  pair            │
                    └──────────────────┘
```

Most mobile users are behind CGNAT and will frequently land on the relay path. This is
expected, budgeted for, and monitored (TURN share of sessions is a metric).

---

## 5. Device switching

| Capability | Commitment |
| --- | --- |
| Enumeration | `enumerateDevices()`, filtered to `videoinput` and `audioinput` |
| Switching | `RTCRtpSender.replaceTrack()` with a track from the new device |
| Labels | Browser-provided; we do not invent device names |
| Availability | Only offered when the browser exposes more than one device |
| During a call | Supported without renegotiation where `replaceTrack` suffices |

---

## 6. Connection state

| State | Meaning | UI |
| --- | --- | --- |
| `new` | Connection created | — |
| `connecting` | ICE in progress | Neutral "connecting" indicator |
| `connected` | Media flowing | Normal |
| `disconnected` | Temporary loss; ICE restart may recover | "Reconnecting…" |
| `failed` | Unrecoverable | Specific failure state; text chat continues |
| `closed` | Torn down | Session ending |

The UI must distinguish `disconnected` (transient) from `failed` (terminal). Collapsing
them is the single most common WebRTC UX failure.

---

## 7. ICE restart

| Trigger | Behaviour |
| --- | --- |
| `iceConnectionState` → `failed` | `restartIce()` is attempted once |
| Network change (Wi-Fi → cellular) | `restartIce()` |
| `connectionState` → `disconnected` for longer than a threshold | `restartIce()` |
| Restart succeeds | Session continues; an `ice-restart` metric is recorded |
| Restart fails | `FAILED` with a specific reason; text chat continues if possible |

**At most one automatic restart.** A restart loop is worse than a clear failure.

---

## 8. Network failure

| Failure | Behaviour |
| --- | --- |
| ICE timeout | `FAILED`, reason `ice-timeout`; user told the network may be blocking the call |
| TURN unavailable | `FAILED`, reason `turn-unavailable`; user told video is unavailable right now |
| All candidates fail | `FAILED`; text chat continues |
| Sustained packet loss | Surfaced as a degraded indicator, not a disconnect |
| Network switch | ICE restart; if it fails, `FAILED` |

Media failure **never silently ends the session** (FR-MEDIA-007). The user is always told
what failed.

---

## 9. Mobile browser behaviour

| Constraint | Handling |
| --- | --- |
| Backgrounding | The session may end by timeout; the user is informed on return |
| Tab suspension | Media tracks may stop; detected via track state and surfaced |
| Battery saver | May throttle; degraded indicator rather than disconnect |
| Data saver | May block relay; the TURN fallback fails and the user is told |
| Screen lock | Video stops; on unlock, media state is re-evaluated |
| Orientation change | Layout reflows; the PiP repositions |
| CGNAT | Relay path is common; budgeted |
| Interruption (phone call) | Media paused; on resume, state is re-evaluated |

---

## 10. Security and privacy

| Property | Commitment |
| --- | --- |
| Encryption | DTLS-SRTP; no plaintext RTP |
| Recording | **Never.** No `MediaRecorder`, no stream capture, no upload path (FR-MEDIA-008) |
| Authorization | None in the media plane; all authorization is in the signaling plane |
| IP exposure | Public addresses may be revealed during direct P2P — ADR-014 |
| TURN placement | Dedicated network segment (ADR-006) |
| Track cleanup | All tracks are stopped on session end, in every exit path |

A repository-level rule: **no code path may call `MediaRecorder`, capture a stream, or
upload media.** Adding one requires a new ADR and a privacy impact assessment.

---

## 11. What is not implemented

| Component | Status |
| --- | --- |
| `PeerConnectionCoordinator` port | Shell only; throws `Not implemented` |
| `getUserMedia` wrapper | Not written |
| ICE server assembly | Not written |
| Offer/answer creation | Not written |
| Trickle ICE handling | Not written |
| Device enumeration | Not written |
| `restartIce` | Not written |
| TURN credential minting | Not written |

All tracked in [TASKS.md](TASKS.md) under VS-8, VS-9, VS-10, and VS-11.
