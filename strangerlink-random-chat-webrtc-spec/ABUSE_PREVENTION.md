# StrangerLink — Abuse Prevention

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [SAFETY.md](SAFETY.md), [THREAT_MODEL.md](THREAT_MODEL.md), [ADR-012](docs/adr/ADR-012-ban-enforcement.md)

> **No rate limiting, fingerprinting, or enforcement is implemented.** Ports exist in
> [src/server/rate-limit/](src/server/rate-limit/) and throw `Not implemented`.

---

## 1. Position

Abuse prevention in an anonymous product is a **cost-raising** exercise, not an
elimination exercise. A determined attacker with a fresh browser and a VPN is not
stoppable. What we can do is make abuse expensive enough that casual abusers stop, while
keeping the cost of legitimate use at zero.

The corollary is a hard rule: **abuse controls must be proportional.** A control that
blocks a legitimate user to stop one abuser is a bug.

---

## 2. Rate limits

All limits are enforced **server-side** (NFR-SEC-001).

### 2.1 Connection and transport

| Limit | Value | Scope |
| --- | --- | --- |
| WebSocket frames | 30/s, burst 60 | Per connection |
| `maxPayload` | 64 KiB | Per frame |
| WebSocket connections | 1 active per identity | Per identity |
| Concurrent connections from one IP | Bounded, generous | Per IP-derived signal |
| Connection attempts | 10/minute | Per IP-derived signal |

### 2.2 Actions

| Action | Limit | Scope |
| --- | --- | --- |
| `JOIN_QUEUE` | 1 per 5 s | Per identity |
| Session creation | 10/minute | Per identity |
| `MESSAGE_SEND` | 1/s, burst 5 | Per participant per session |
| Messages per session | 300 total | Per session |
| `REPORT_SUBMITTED` | 5/hour | Per identity |
| `BLOCK_CREATED` | 10/hour | Per identity |
| TURN credential mint | 1 per session, 5/hour | Per identity |
| `OFFER`/`ANSWER` | 10 per session | Per session |
| `ICE_CANDIDATE` | 100 per session | Per session |

### 2.3 Cooldowns

| Trigger | Cooldown |
| --- | --- |
| 3+ rapid join/leave cycles within 60 s | 30 s |
| 5+ rapid join/leave cycles within 60 s | 5 minutes |
| Repeated rate-limit hits | Progressive: 1 min → 10 min → 1 h |
| Immediate skip after every match (5+ in a row) | 60 s + review flag |

Cooldowns are shown honestly to the user: "Please wait a few seconds before trying again."
They are never disguised as network errors.

---

## 3. Session limits

| Limit | Value | Rationale |
| --- | --- | --- |
| Active sessions per participant | **1** | INV-1; prevents multi-session harassment |
| Session duration | 30 minutes | Bounded exposure |
| Messages per session | 300 | Flooding |
| Message length | 2000 chars | Paste flooding |
| Requeue without a session | Bounded; then an exit is offered | Prevents infinite loops |

---

## 4. Queue cooldown and flooding

Queue flooding is the cheapest attack available: join, get matched, skip instantly,
repeat.

| Defense | Detail |
| --- | --- |
| Join rate limit | 1 per 5 s per identity |
| Cooldown ladder | Progressive, as above |
| Immediate-skip detection | 5 consecutive skips with zero messages triggers a cooldown and a review flag |
| Queue capacity cap | Bounded per instance; when full, new joins are queued or refused with a clear message |
| Consecutive-requeue cap | After a configurable number, an exit is offered |

---

## 5. IP and device risk signals

### 5.1 What we use

| Signal | Form | Permitted use |
| --- | --- | --- |
| IP-derived risk signal | **One-way hash**, coarse | Rate limiting and cooldowns **only** |
| Connection pattern | Counters | Rate limiting |
| Allocation usage | Counters | TURN quotas |

### 5.2 What we do not use

| Not used | Why |
| --- | --- |
| **Device fingerprinting** | Invasive; a privacy cost disproportionate to the benefit; also trivially evadable |
| Canvas/WebGL/font fingerprinting | Same |
| Battery/audio/sensor APIs for identification | Same |
| Persistent cookies for tracking | No accounts; no cross-session tracking |
| IP bans | Collateral damage on CGNAT and shared connections (ADR-012) |
| Device bans | Requires fingerprinting we do not do |

**This is a deliberate, documented decision.** Fingerprinting is the obvious "solution" to
ban evasion and we are choosing not to build it, because the privacy cost to every user
outweighs the enforcement benefit against a determined attacker, who will evade it anyway.

### 5.3 The rule that makes this safe

> **A shared-IP signal can only ever trigger a rate limit or a cooldown. It can never
> trigger a standalone ban.**

This is enforced at code level (ADR-012 MR-2). An innocent user behind a carrier-grade NAT
must never be banned because of their neighbour.

---

## 6. CAPTCHA

**Used only where a specific, documented abuse pattern justifies it** (FR-ABUSE-007).

| When | Where |
| --- | --- |
| Sustained connection-attempt flooding from a signal | Before allowing a new WebSocket connection |
| Repeated cooldown violations | Before allowing a queue join |
| Never | On the first visit, on every report, or as a default gate |

A CAPTCHA on the first visit would be a friction tax on legitimate users to stop a
hypothetical abuser. We do not do that.

---

## 7. Progressive restrictions

| Stage | Trigger | Restriction | Duration |
| --- | --- | --- | --- |
| 1 | First minor violation | In-session warning | Session |
| 2 | Second violation, or one corroborated report | Disconnect | — |
| 3 | Repeat within a window | Cannot join queue | 24 h |
| 4 | Further repeat | Cannot join queue | 7 d |
| 5 | Severe violation | Ban | Indefinite pending review |
| 6 | Confirmed evasion | Extended ban | Reviewed |

Escalation is auditable. De-escalation happens through the appeal path.

---

## 8. Ban evasion

Detection uses **signals we already hold for rate limiting** — not new collection.

| Signal | Use |
| --- | --- |
| IP-derived risk signal reuse | Correlation, not proof |
| Rapid reconnect patterns | Detection |
| TURN allocation overuse | Detection |
| Repeat-report patterns | Detection |
| Behavioural similarity (message rate, skip cadence) | Weak signal; review flag only |

**No signal alone is sufficient to ban.** Correlation across signals plus a human review
is required for an evasion determination.

We accept and disclose that a determined user can return under a new identity.

---

## 9. Threat-specific defenses

### 9.1 Spam

- Message rate limits and per-session caps.
- Identical-content detection (3+ repeats rejected).
- URL-burst detection.
- Queue cooldown for rapid join/leave.

### 9.2 Botting

- WebSocket handshake authentication before the socket opens.
- Connection-attempt rate limits.
- CAPTCHA on sustained flooding.
- Behavioural review flags (immediate-skip cadence, zero-message sessions).
- No CAPTCHA on first visit.

### 9.3 Rapid reconnect abuse

- One active session per identity (INV-1); a new connection supersedes the old
  (`SESSION_SUPERSEDED`).
- Bounded reconnect window; expiry ends the session.
- Reconnect rate limits.
- Stale session IDs rejected.

### 9.4 Report abuse

- Report rate limit (5/hour).
- Deduplication on (session, category).
- **Credibility weighting:** an identity that reports many distinct peers has its reports
  down-weighted and is flagged for review, rather than each report being actioned.
- Reports are never auto-actioned into a ban.

### 9.5 Credential abuse

- TURN credentials are per-session and minutes-long.
- The credential-minting endpoint is authenticated and rate limited.
- No static credentials anywhere.
- Session tokens are short-lived and bound to the socket.

### 9.6 Session flooding

- One session per participant.
- Session creation rate limit.
- Session duration cap.
- Requeue caps.

### 9.7 WebSocket flooding

- `maxPayload` cap.
- Per-connection frame rate limit.
- Connection cap per instance with alerting.
- Zombie socket termination via heartbeat.
- Realtime service isolated from the web tier (ADR-016).

### 9.8 Signaling abuse

- Every frame schema-validated.
- `fromParticipantId` must match the authenticated identity.
- Recipient is server-derived.
- `messageId` idempotency; `sequence` monotonicity.
- Protocol violations close the connection and raise a safety event.

### 9.9 TURN abuse

- Time-limited credentials.
- Per-identity and per-server allocation quotas.
- Bandwidth accounting with alerting.
- coturn in a dedicated network segment with relay-destination restrictions.
- Banned identities cannot mint credentials.

### 9.10 Harassment

- One session per participant.
- Recent-peer avoidance.
- Block enforcement.
- Report → disconnect → restriction ladder.
- Session duration cap.

### 9.11 Stalking behaviour

| Signal | Response |
| --- | --- |
| The same identity repeatedly matched with the same peer | Recent-peer avoidance prevents it structurally |
| Repeated requeue attempting to find a specific person | Review flag; restriction if confirmed |
| Off-platform contact attempts in chat | Report; the user is advised not to share contact details |

**Honest limitation:** if a user voluntarily shares contact details, we cannot prevent
off-platform contact. The safety notice says so.

### 9.12 Malicious links

- Links are inert by default.
- No auto-fetch, no preview.
- No short-link expansion.
- Punycode rendered as Unicode so homographs are visible.
- Opening requires an explicit tap, in a new tab with `rel="noopener noreferrer"`.

### 9.13 Sexual exploitation risks

| Measure | Detail |
| --- | --- |
| 18+ only | Age gate before any capability |
| No attachments | The primary vector for illegal content is absent |
| No media recording | No evidence artifact is created or stored |
| P0 escalation | "Minor safety" and "Illegal content" categories bypass normal triage |
| Immediate termination | Any in-session indication ends the session |
| No private channels | No way to move a conversation off the public session |
| No user discovery | There is no search, no profiles, no directory |

**The absence of attachments and the absence of any off-platform channel are the two
strongest structural defenses available to this product.** They are deliberate non-features
(NG-3, and the "no contact outside the platform" rule).

---

## 10. Defense summary

| Defense | Phase |
| --- | --- |
| Server-side rate limits | VS-13 |
| Queue cooldown ladder | VS-13 |
| Session and concurrency caps | VS-3 / VS-7 |
| IP-derived risk signals (hash, rate-limit only) | VS-13 |
| Progressive restrictions | VS-7 |
| CAPTCHA (conditional) | VS-13 |
| Temporary bans | VS-7 |
| Moderation review | VS-12 |
| Recent-peer avoidance | VS-3 |
| TURN quotas and short-lived credentials | VS-11 |
| Inert links, no attachments | VS-4 |

---

## 11. What we deliberately do not build

| Not built | Why |
| --- | --- |
| Device fingerprinting | Privacy cost outweighs benefit; evadable anyway |
| IP bans | Collateral damage |
| Cross-session behavioural profiling | Data minimisation |
| Automated content classification | Privacy cost; false positives |
| A "trust score" shown to users | Would create popularity dynamics (NG-1) |
| Reputation systems | Same |
| Shadowbanning without disclosure in policy | Users must be able to understand and appeal enforcement |

---

## 12. Implementation status

Tracked in [TASKS.md](TASKS.md) as **T-ABUSE-061** (rate limiting ports) and
**T-ABUSE-062** (cooldown and progressive restriction). Neither is implemented.
