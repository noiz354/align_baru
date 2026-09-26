# ADR-006 — TURN Strategy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-005](ADR-005-webrtc-topology.md), [ADR-014](ADR-014-anonymity-model.md)

## Context

A meaningful fraction of StrangerLink users are on mobile networks behind CGNAT, or on
corporate/hotel networks with strict egress rules. For those users, direct P2P media will
fail and a TURN relay is the only way audio/video works at all.

TURN is also the single most abusable component in a WebRTC product:

- A leaked TURN credential turns our infrastructure into a **free bandwidth source** for
  anyone.
- A TURN server is a **network position** — it can be used to relay traffic to arbitrary
  destinations if not restricted.
- TURN relays media, which in this product is media between strangers, so it is a
  privacy-relevant component.

We must therefore decide not just *whether* to run TURN, but how to authenticate it,
scope it, restrict it, and pay for it.

## Problem

What TURN strategy — server, credential model, network placement, quotas, and
relay-destination policy — should StrangerLink adopt?

## Decision Drivers

1. **Reachability.** Audio/video must work for users behind CGNAT and strict firewalls.
2. **Credential security.** Credentials must not be long-lived or reusable.
3. **Cost control.** Bandwidth is the dominant variable cost; it must be bounded.
4. **Network safety.** The relay must not become an open proxy into internal networks.
5. **Availability.** TURN failure must degrade gracefully and be visible.
6. **Operability.** One small team must run it.
7. **Privacy.** TURN sees media, so its placement and logging matter.

## Options Considered

### Option A — Self-hosted coturn with time-limited REST credentials

coturn with `use-auth-secret`, a realm, and HMAC-based time-limited credentials derived
per session.

**Strengths:** Full control over credential lifetime, quotas, and relay policy. No
per-user cost. Standard, production-proven.

**Weaknesses:** We operate it: certificates, firewall, port range, kernel tuning,
monitoring.

### Option B — Managed TURN (e.g. Metered, Cloudflare Calls)

**Strengths:** No operations, global regions, high availability.

**Weaknesses:** Per-GB cost that scales with usage. Less control over relay-destination
policy and credential lifetime. Third party in the media path.

### Option C — Free/public TURN (e.g. OpenRelay)

**Strengths:** Free.

**Weaknesses:** Unacceptable. No availability guarantee, no credential control, no quota,
and an unknown third party in the media path. **Rejected outright.**

### Option D — No TURN at all

**Strengths:** Zero cost and zero attack surface.

**Weaknesses:** Audio/video silently fails for a large share of mobile users. Rejected —
it makes FR-MEDIA-002 a lie for exactly the users who most need it.

## Decision

**Adopt Option A: self-hosted coturn with time-limited REST credentials.**

### Server configuration commitments

| Setting | Commitment | Rationale |
| --- | --- | --- |
| `use-auth-secret` + `static-auth-secret` | Required | HMAC time-limited credentials; no static username/password in any client |
| `realm` | Required | WebRTC requires long-term credentials; anonymous access will not work |
| `lt-cred-mech` (`-a`) | Required | Long-term credential mechanism is mandatory for WebRTC |
| `fingerprint` (`-f`) | Required | WebRTC expects FINGERPRINT in STUN messages |
| `listening-port` | 3478 UDP + TCP | Standard |
| `tls-listening-port` | 5349 | TURNS for restrictive networks |
| `alt-listening-port` / `alt-tls-listening-port` | 80 / 443 | Firewalls that block 3478/5349 |
| `relay-ip` / `external-ip` | Explicitly set | Prevents surprises behind NAT |
| `min-port` / `max-port` | 49152–65535 (or a narrower range) | Must match firewall rules exactly |
| `no-multicast-peers` | Set | Multicast relay is never needed |
| `no-stun-backward-compatibility` | Set | Removes RFC 3489 legacy attack surface |
| `response-origin-only-with-rfc5780` | Set | Restricts response origin behaviour |
| `stale-nonce` | 600s | Bounds nonce lifetime |
| `user-quota` / `total-quota` | Set | Bounds allocations per user and per server |
| `no-tcp-relay` | Set | TCP relay (RFC 6062) is unnecessary for UDP media and is attack surface |
| `cert` / `pkey` + `no-sslv3`, `no-tlsv1`, `no-tlsv1_1` | Required | TLS 1.2+ only |
| `proc-user` / `proc-group` | Non-root | Least privilege |

### Credential model

- The server computes a TURN username of the form `<expiry-unix-timestamp>:<opaque-id>`
  and a password = `base64(HMAC-SHA1(static-auth-secret, username))`.
- Credentials are minted **on demand** by an authenticated API call, scoped to a single
  session, with a lifetime measured in **minutes, not hours**.
- Credentials are **never** stored, never logged, and never placed in a URL.
- The static auth secret lives only in the server's secret store and is rotated on a
  schedule.

### Network placement

- coturn runs in a **dedicated network segment** with:
  - no access to application servers, databases, or management interfaces;
  - outbound restricted to the public internet (for peer relay);
  - **relay to internal/local ranges blocked** (no RFC 1918, loopback, link-local, or
    cloud-metadata destinations). This prevents the relay being used as an SSRF pivot.
- Separate from the signaling service.

### Quotas and abuse control

- Per-identity allocation quota and per-server total allocation quota.
- Bandwidth accounting per identity, with an alert threshold.
- A TURN credential request is rate limited per identity (FR-ABUSE-004).
- Allocation lifetime is bounded; idle allocations are reaped.

### Observability

- TURN usage (allocations, relayed bytes, credential requests) is a first-class metric.
- coturn logs go to a separate, access-controlled log stream.
- **coturn logs never contain media content** (they cannot — they contain session
  metadata), and we do not enable verbose logging in production.

## Consequences

**Positive**

- Audio/video works for the users who need it most.
- Credential theft has a bounded blast radius: minutes, one session, one identity.
- The relay cannot be used as an SSRF pivot into internal networks.
- Bandwidth is attributable and alertable per identity.

**Negative**

- We operate coturn: certificates, firewall, port ranges, kernel tuning, monitoring.
- Bandwidth is a real, variable cost that scales with video adoption.
- TURNS on 443 can conflict with the web tier's own TLS termination and needs care.
- Short-lived credentials mean an extra round trip before media setup.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Static auth secret leaks → free bandwidth for attackers | Critical | Medium |
| TURN credential API is abused to mint credentials at scale | High | Medium |
| coturn outage breaks video for restrictive networks | Medium | Medium |
| Relay port range mismatch with firewall → silent failures | High | Medium |
| Relay used to reach internal services | High | Low |
| Bandwidth cost spike from a single abusive identity | Medium | Medium |

## Mitigations

- **MR-1:** The static auth secret is stored in the server secret store only, is never
  in a client bundle, never in a log, and never in an error message. Rotation is a
  documented operational procedure ([OPERATIONS.md](../OPERATIONS.md)).
- **MR-2:** The credential-minting endpoint requires an authenticated, session-bound
  caller, is rate limited, and mints credentials with a lifetime in minutes (FR-ABUSE-004,
  NFR-SEC-006).
- **MR-3:** coturn is monitored; an allocation-failure or availability alert fires, and
  the client surfaces a **specific** "video relay unavailable" state rather than a
  generic error (NFR-SAFE-001).
- **MR-4:** The relay port range is declared once in configuration and asserted by a
  deployment smoke test ([DEPLOYMENT.md](../DEPLOYMENT.md)).
- **MR-5:** Relay-destination policy blocks private/loopback/link-local/metadata ranges;
  verified by a test.
- **MR-6:** Per-identity bandwidth accounting with alerting; an identity exceeding the
  threshold is rate-limited and reviewed, not silently cut off.

## Revisit Conditions

- Operating coturn becomes a sustained burden for the on-call rotation → evaluate managed
  TURN (Option B) with a cost model.
- Bandwidth cost exceeds the budget in [PERFORMANCE.md](../PERFORMANCE.md) → tighten
  quotas, or restrict video availability.
- We move a region to TURN-only per ADR-014 → re-evaluate capacity sizing.
- coturn has a security advisory affecting our deployed version → patch immediately;
  this is treated as a safety incident.

## References

- coturn `turnserver` flags and WebRTC usage notes — https://github.com/coturn/coturn
- TURN security best practices (network isolation, relay-destination restriction,
  protocol hardening) — https://www.enablesecurity.com/blog/turn-security-best-practices/
- RFC 5766 (TURN), RFC 6062 (TCP relay), RFC 5389 (STUN)
- [WEBRTC.md](../WEBRTC.md), [PRIVACY.md](../PRIVACY.md)
- [docs/research/STACK-2026.md](../research/STACK-2026.md)
