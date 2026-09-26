# ADR-005 — WebRTC Topology

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-006](ADR-006-turn-strategy.md), [ADR-014](ADR-014-anonymity-model.md)

## Context

StrangerLink supports optional audio and video between two matched strangers. The
product is explicitly **pairwise** — no group chat, no rooms, no broadcast (NG-9).

Media has to get from one browser to the other. The choices are:

1. **Peer-to-peer** with STUN-assisted NAT traversal, and TURN as a fallback relay.
2. **Server-relayed** through an SFU/MCU.
3. **TURN-only**, never allowing direct P2P.

The privacy stakes are unusually high here. In a normal video product, peers know each
other's names and consent to a relationship. In StrangerLink, the peer is a **stranger**.
Direct P2P connectivity means each browser can learn the other's **public IP address** —
and in an anonymous product, an IP address is an identity-adjacent datum that enables
geolocation, harassment off-platform, and, in the worst case, physical risk.

This ADR is therefore a **privacy decision as much as a technical one**. The IP-exposure
analysis is in [PRIVACY.md](../PRIVACY.md) and the anonymity model is ADR-014.

## Problem

What media topology should StrangerLink use, and how do we handle the IP-exposure
consequence of direct P2P?

## Decision Drivers

1. **Participant count.** Two, always two.
2. **Privacy.** IP exposure to a stranger is a real harm, not a theoretical one.
3. **Cost.** TURN relay bandwidth is the dominant variable cost.
4. **Latency.** P2P is lower latency than relayed.
5. **Operability.** One small team; no media server fleet.
6. **Failure behaviour.** Media failure must be visible and recoverable, never a silent
   hang.
7. **Mobile reality.** A large share of users are on mobile networks with CGNAT, where
   direct P2P frequently fails.

## Options Considered

### Option A — Full P2P with STUN, TURN as fallback (standard WebRTC)

STUN discovers the public mapping; direct media if possible; TURN relay otherwise.

**Strengths:** Lowest latency, lowest bandwidth cost, standard, no media server.

**Weaknesses:** **Both peers learn each other's public IP addresses.** On mobile CGNAT
this is often a shared carrier-grade NAT address (low identifiability), but on fixed
lines it is a household address (high identifiability).

### Option B — TURN-only (relay all media, no host/srflx candidates to peers)

All media flows through coturn. Peers never exchange candidates that reveal addresses.

**Strengths:** Strongest privacy; symmetric, predictable network behaviour; works behind
symmetric NAT and strict firewalls; simplifies the failure model.

**Weaknesses:** Highest bandwidth cost (every media stream is relayed twice). Higher
latency. coturn becomes a single point of failure and a cost centre.

### Option C — SFU / MCU

Media flows through a server that can mix, record, and selectively forward.

**Strengths:** Enables group calls, recording, and server-side moderation of media.

**Weaknesses:** Enormous operational and architectural commitment for a two-party
product. Introduces a server that *could* record — a privacy and trust liability we
explicitly do not want (FR-MEDIA-008). Rejected.

### Option D — Hybrid: attempt P2P, fall back to TURN, and additionally suppress
host-candidate leakage where the browser permits

Standard P2P, but with a deliberate configuration choice about which candidates are
exchanged, plus an explicit, documented acknowledgement of the residual exposure.

## Decision

**Adopt Option D — hybrid — as the direction, with the concrete IP-exposure policy
recorded in [ADR-014](ADR-014-anonymity-model.md).**

Specifically:

1. **Topology is peer-to-peer** for two-party sessions. No SFU, no MCU, no media server.
2. **STUN** is used for ICE candidate gathering. Public STUN servers are acceptable for
   discovery only.
3. **coturn** provides TURN fallback with time-limited REST credentials (ADR-006).
4. **Media never touches our application servers.** Only the signaling plane does.
5. **No recording, ever** (FR-MEDIA-008). There is no code path that captures media.
6. **The residual IP-exposure of direct P2P is documented, disclosed in the privacy
   notice, and mitigated** — see ADR-014 for the exact policy and its trade-offs.

### Why not TURN-only (Option B)

TURN-only is the strongest privacy posture and we take it seriously. It is rejected as
the *default* because it makes every session cost full relay bandwidth, which for a
product whose core loop is "connect two strangers and let them leave in 20 seconds" is a
poor cost/failure trade-off at launch. **ADR-014 records the specific conditions under
which we move to TURN-only** (e.g. a region where IP exposure has caused documented
harm, or a mode explicitly labelled "maximum privacy").

### Media plane vs signaling plane

This distinction is maintained everywhere in the codebase and documentation:

```
Signaling Plane (always through our server, TLS, authenticated, rate limited)
  Client A ══ wss ══ Realtime Service ══ wss ══ Client B

Media Plane (direct between browsers, SRTP, DTLS)
  Client A ════════ WebRTC media ════════ Client B
                    (via TURN relay when direct fails)
```

The signaling plane is where authorization lives. The media plane carries no
authorization information and must never be assumed to be private.

## Consequences

**Positive**

- No media server to build, run, or secure.
- Media latency is minimal for the common case.
- The privacy cost of P2P is bounded, documented, and mitigable rather than hidden.
- Media failure is a normal, testable outcome rather than an exotic one.

**Negative**

- coturn bandwidth is a real cost that scales with video usage.
- Users on restrictive networks will rely on TURN more often than the marketing story
  implies.
- IP exposure is a genuine, documented residual risk. We do not get to claim anonymity
  at the network layer.
- ICE and reconnection logic is client complexity we must own and test.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Peer IP exposure enables off-platform harassment | High | Medium |
| TURN bandwidth cost becomes unsustainable | Medium | Medium |
| coturn outage degrades video for restrictive networks | Medium | Medium |
| Media failure is presented to the user as a generic error | Medium | High |
| A future contributor adds a recording path "for moderation" | Critical | Low |

## Mitigations

- **MR-1:** ADR-014 records the IP-exposure policy, its user-facing disclosure, and the
  conditions for moving to TURN-only.
- **MR-2:** TURN usage is a first-class metric with cost alerting (NFR-OBS-001,
  [OBSERVABILITY.md](../OBSERVABILITY.md)).
- **MR-3:** coturn runs in a dedicated network segment with quotas (ADR-006) and is
  monitored; a TURN outage raises an alert and the client shows a specific state.
- **MR-4:** Every media failure mode has a distinct, named UI state (see
  [DESIGN.md](../DESIGN.md) and NFR-SAFE-001) so "the network is bad" is never confused
  with "your peer left".
- **MR-5:** A repository-level rule: no code path may call `MediaRecorder`, capture a
  stream, or upload media. Enforced by a lint rule and by review. Adding it requires a
  new ADR and a privacy impact assessment.

## Revisit Conditions

- We need group sessions → an SFU becomes justified and this ADR is superseded (NG-9
  would also need revisiting).
- Documented harm from IP exposure in a launch region → move that region to TURN-only.
- TURN bandwidth cost exceeds the threshold in [PERFORMANCE.md](../PERFORMANCE.md) →
  revisit the hybrid policy, possibly restricting video to regions with good P2P
  connectivity.
- A browser ships a native "anonymous WebRTC" mode that suppresses candidate leakage.

## References

- [WEBRTC.md](../WEBRTC.md)
- [ADR-006](ADR-006-turn-strategy.md)
- [ADR-014](ADR-014-anonymity-model.md)
- [PRIVACY.md](../PRIVACY.md)
- [docs/realtime/FAILURE-MODEL.md](../realtime/FAILURE-MODEL.md)
- RFC 8825 (WebRTC overview), RFC 8445 (ICE) — https://www.rfc-editor.org/
