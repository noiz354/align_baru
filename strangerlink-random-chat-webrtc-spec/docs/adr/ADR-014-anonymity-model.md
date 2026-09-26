# ADR-014 — Anonymity Model & IP Exposure

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + Trust & Safety + Legal
- **Related:** [ADR-005](ADR-005-webrtc-topology.md), [ADR-006](ADR-006-turn-strategy.md), [ADR-012](ADR-012-ban-enforcement.md)

## Context

"Maintain privacy" and "avoid requiring public profiles" are explicit product
requirements. But anonymity is not one property — it is several, and they fail
differently.

In this product, a user's anonymity could be broken by:

1. **A required account or profile** — we do not have one (NG-4, NFR-PRIV-001).
2. **A durable identifier that persists across sessions** — we do not have one by design.
3. **Their IP address being visible to the stranger they are talking to** — this is the
   hard one, and it is a direct consequence of how WebRTC works.
4. **Our own records** — mitigated by ADR-013.
5. **Their own disclosures** — the user typing "I'm in Padang, I go to X university".
   Unfixable, and a reason to keep the product's promise narrow.

Item 3 deserves the most attention. In standard WebRTC, ICE candidate exchange means each
peer learns the other's **host candidates** (local interface addresses) and **server
reflexive candidates** (public IP:port mappings as seen by a STUN server). The public
address is the sensitive one: it supports geolocation to city or neighbourhood level,
correlates sessions from the same network, and can be a vector for off-platform
harassment or, in the worst case, physical risk.

The severity depends on the network. Behind CGNAT (most mobile), the reflexive candidate
is a shared carrier address — low identifiability, though it still narrows geography. On
a fixed home line, it is the household's address — high identifiability.

## Problem

What is the anonymity model, and specifically: **should peer IP addresses be directly
exposed by P2P connectivity?**

## Decision Drivers

1. **User safety.** IP exposure to a stranger is a real harm in a harassment product.
2. **Honesty.** We must not claim more anonymity than we deliver (NFR-SAFE-003).
3. **Cost.** TURN-only relays all media and is expensive.
4. **Reachability.** Some users can only connect via TURN.
5. **Feasibility.** What can a browser actually be configured to do?
6. **Consistency.** The model must be the same in the UI, the privacy notice, and the
   code.

## Options Considered

### Option A — Direct P2P only (standard WebRTC)

Full ICE with host and srflx candidates exchanged.

**Strengths:** Simplest, cheapest, best latency.

**Weaknesses:** Both peers learn each other's public IP. Maximum exposure.

### Option B — TURN-only

All media relayed; peers never exchange address-revealing candidates.

**Strengths:** Strongest privacy; symmetric network behaviour; works behind symmetric
NAT.

**Weaknesses:** Full relay bandwidth cost; higher latency; coturn is a single point of
failure; cost scales with video usage.

### Option C — Hybrid

Standard P2P with TURN fallback, plus a deliberate configuration stance on candidate
handling and a documented, disclosed residual exposure.

### Option D — Hybrid with a per-session "maximum privacy" mode

Hybrid by default; an explicit user-selectable mode that forces TURN-only for that
session.

## Decision

**Adopt Option C now, with Option D recorded as the path to a stronger posture.**

### The anonymity model

| Layer | Property | Status |
| --- | --- | --- |
| **Identity** | No account, no profile, no email, no phone | Guaranteed |
| **Session identity** | Pseudonymous; dies with the browser session | Guaranteed |
| **Our records** | Tiered retention; no chat content ever | Guaranteed (ADR-013) |
| **Moderator visibility** | Minimum necessary; no content, no media | Guaranteed (ADR-010) |
| **Network address** | **Public IP may be visible to the peer during a direct P2P media session** | **Residual risk — disclosed** |
| **Local interface addresses** | Host candidates may be exchanged during ICE | Residual risk — disclosed |

### What we commit to

1. **Our servers never expose a peer's IP address to the other peer.** The signaling
   plane relays only the messages the clients themselves exchange. The server does not
   annotate messages with addresses.
2. **The residual exposure is disclosed in plain language** in the privacy notice and in
   the pre-session safety notice: "During a video or audio call, the other person may be
   able to see your approximate location."
3. **TURN is always available** so that users on restrictive networks are not forced into
   a worse posture (ADR-006).
4. **The "maximum privacy" mode (Option D) is PLANNED**, not built. It would force
   TURN-only for a session at the cost of bandwidth and latency.
5. **We do not collect device fingerprints** to strengthen anonymity or enforcement
   ([ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md)).

### Why not TURN-only by default

Cost and failure concentration. Relaying every media stream doubles bandwidth and makes
coturn a hard dependency for all video. For a product whose core loop is short, frequent
sessions, that is a poor trade at launch. **ADR-014 is explicitly designed to be
revisited** — the conditions are below.

### The honest statement we will publish

> StrangerLink does not require an account and does not show a profile. During text chat,
> the other person cannot see your name, email, or location. During an audio or video
> call, the other person may be able to determine your approximate location from your
> internet connection. If that matters to you, use text chat.

This copy is a requirement, not a nice-to-have: it is referenced from
[PRIVACY.md](../PRIVACY.md) and [DESIGN.md](../DESIGN.md).

## Consequences

**Positive**

- The identity layer is genuinely strong: no account, no profile, no persistent handle.
- The one residual exposure is named, disclosed, and mitigable rather than hidden.
- TURN availability means restrictive-network users are not left with a broken product.
- No fingerprinting means no surveillance infrastructure to defend.

**Negative**

- We cannot honestly claim "complete anonymity". A user in a video call can be
  geolocated approximately.
- The "maximum privacy" mode does not exist yet.
- Users who do not read the notice will not know about the exposure.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| IP exposure enables off-platform harassment | High | Medium |
| IP exposure enables physical harm in a high-risk region | Critical | Low |
| Users believe they are fully anonymous | High | High |
| A future contributor adds address annotations to signaling "for debugging" | High | Medium |
| Cost pressure forces a change to the hybrid policy without a privacy review | Medium | Medium |

## Mitigations

- **MR-1:** The disclosure copy above is shipped in the privacy notice **and** in the
  pre-session safety notice for media modes. A test asserts the notice renders on the
  media-mode entry path.
- **MR-2:** A code rule: the signaling plane must not attach, log, or relay any network
  address metadata about a peer. Enforced by review and by a test asserting the relayed
  envelope contains no address fields.
- **MR-3:** TURN-only mode is PLANNED and its trigger conditions are explicit (below).
- **MR-4:** Region-specific hardening: if a launch region has documented IP-exposure harm,
  that region moves to TURN-only. This is a configuration change with a documented
  decision, not a code change.
- **MR-5:** Any change to the hybrid policy requires a privacy impact assessment and a new
  ADR. Cost pressure alone is not a sufficient reason.

## Revisit Conditions

- A launch region reports documented harm from IP exposure → move that region to TURN-only.
- Video usage grows to the point that TURN-only is affordable → adopt TURN-only globally
  and retire the residual-risk disclosure.
- A browser ships native candidate suppression or an "anonymous WebRTC" mode → adopt it
  and close the residual risk.
- Regulatory guidance on IP addresses as personal data in the launch jurisdictions
  changes → revisit with Legal.

## References

- [PRIVACY.md](../PRIVACY.md)
- [ADR-005](ADR-005-webrtc-topology.md)
- [ADR-006](ADR-006-turn-strategy.md)
- [ADR-012](ADR-012-ban-enforcement.md)
- [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md)
- RFC 8445 (ICE) — https://www.rfc-editor.org/rfc/rfc8445
