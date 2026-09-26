# ADR-012 — Ban Enforcement

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + Trust & Safety
- **Related:** [ADR-010](ADR-010-moderation-model.md), [ADR-014](ADR-014-anonymity-model.md), [ADR-013](ADR-013-retention-policy.md)

## Context

A ban is the strongest enforcement tool this product has, and it is unusually weak here.

In a normal product, a ban attaches to an account — an email, a phone number, a payment
instrument. StrangerLink has **no accounts** (NG-4). A participant is a pseudonymous
session identity that dies when the browser tab closes. So the obvious question is:
**what exactly do we ban?**

The options are all imperfect:

- Ban the session identity → the user reloads the page and gets a new one.
- Ban an IP address → punishes everyone behind that NAT, including entire mobile carrier
  networks and shared household connections; also trivially evaded with a VPN.
- Ban a device fingerprint → invasive fingerprinting, which we have deliberately excluded
  by default, and also evadable.
- Ban nothing → abusers return immediately.

We must be honest about this. A ban in an anonymous product is a **friction increase**,
not an absolute barrier. The goal is to make re-entry costly enough that casual abusers
stop, while accepting that a determined abuser will return.

We must also not over-ban. An IP ban that blocks a carrier-grade NAT range bans thousands
of innocent users. Proportionality (FR-SAFE-005) applies to bans more than to anything
else.

## Problem

What is banned, at what scope, enforced where, and for how long?

## Decision Drivers

1. **Effectiveness.** Bans must raise the cost of return.
2. **Proportionality.** Innocent users must not be caught (FR-SAFE-005).
3. **Privacy.** Ban records must not become a surveillance database.
4. **Enforceability.** A ban that is only checked in one place is not a ban.
5. **Auditability.** FR-MOD-004, FR-SAFE-006.
6. **Honesty.** We must not claim bans are unbreakable.

## Options Considered

### Option A — Ban the pseudonymous session identity only

**Strengths:** Precise, no collateral damage.

**Weaknesses:** Trivially evaded by reloading. Near-useless on its own.

### Option B — Ban the IP address

**Strengths:** Survives reload.

**Weaknesses:** Massive collateral damage on CGNAT and shared connections; trivially
evaded by VPN; a privacy liability (we are storing IPs and acting on them).

### Option C — Ban a device fingerprint

**Strengths:** Survives reload and IP change.

**Weaknesses:** Requires invasive fingerprinting, which
[ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md) explicitly rejects by default. Evadable.
A serious privacy cost.

### Option D — Layered: identity ban (primary) + risk-signal-weighted restrictions
(secondary) + IP-level rate limits only where a specific pattern justifies it

The session identity is the ban subject. Additional signals — IP-derived rate limits,
cooldowns, allocation quotas — raise the cost of return without banning innocent
co-tenants.

## Decision

**Adopt Option D: layered enforcement with the pseudonymous session identity as the ban
subject.**

### Ban subjects and scopes

| Scope | Subject | Use | Duration |
| --- | --- | --- | --- |
| **Session identity** | `SessionIdentity` id | Default ban scope | Bounded, per severity ladder |
| **Risk class** | Hashed IP-derived risk signal | Rate limiting and cooldown **only**, never a standalone ban | Rolling window |
| **IP range** | — | **Not used.** Rejected for collateral damage | — |
| **Device fingerprint** | — | **Not used by default.** Requires a privacy impact assessment | — |

### Enforcement points

A ban is checked at **every** entry point, not just session creation (FR-MOD-008):

| Point | Check |
| --- | --- |
| Queue join | Active ban → reject |
| Candidate selection | Ban or restriction on either party → never match |
| Session creation | Active ban → reject |
| Report submission | Allowed even when banned (a banned user must still be able to report) |
| WebSocket connect | Banned identity → refuse |
| TURN credential mint | Banned identity → refuse |

### Progressive enforcement ladder

| Step | Trigger | Action | Duration |
| --- | --- | --- | --- |
| 1 | First confirmed minor violation | Warning shown in-session | Session |
| 2 | Second violation, or one report with corroborating signals | Immediate disconnect | — |
| 3 | Repeat within a window | Temporary restriction (cannot join queue) | 24 h |
| 4 | Further repeat | Temporary restriction | 7 d |
| 5 | Severe violation (minor safety, threats, illegal content) | Immediate ban, bypass ladder | Indefinite pending review |
| 6 | Confirmed ban evasion | Extended ban | Indefinite |

Warning copy never discloses confidential moderation reasoning (NFR-SAFE-002).

### What a ban record contains

`Ban { id, subjectType, subjectId, reasonCode, severity, source (report | automated-signal | admin), createdBy, createdAt, expiresAt, appealStatus, policyVersion }`

It does **not** contain: name, email, phone, IP address (a hashed risk signal is held
separately and is not part of the ban record), or device fingerprint.

### Ban evasion

Detection uses **risk signals already collected for rate limiting**, not new collection:
hashed IP-derived signals, rapid-reconnect patterns, allocation quotas, and repeat-report
patterns. See [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md). We do **not** introduce
invasive fingerprinting to catch evasion.

### Appeals

A banned user can appeal. Appeals are reviewed by a moderator other than the one who
issued the ban where staffing allows. Appeal outcomes are audited.

## Consequences

**Positive**

- No collateral damage to innocent users behind shared NATs.
- No invasive fingerprinting.
- Enforcement is checked at every entry point, so a stale session cannot be exploited.
- Every ban is auditable with a reason code and a policy version.

**Negative**

- A determined abuser can re-enter within minutes by clearing storage and changing
  network. **We do not hide this.**
- Risk-signal-based restriction has false positives, and a wrongly restricted user has a
  poor experience.
- Appeals add operational load.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Banned user trivially re-enters | High | High |
| Innocent user restricted by a shared-IP signal | Medium | Medium |
| Ban checked in some places but not others | High | Medium |
| Ban records retained indefinitely → surveillance database | High | Medium |
| Appeal process becomes a moderation-bypass channel | Medium | Medium |
| Ban evasion detection drifts into invasive fingerprinting | High | Medium |

## Mitigations

- **MR-1:** A single `BanEnforcementPort` is the only module permitted to answer "is this
  identity restricted?", and it is called at every enforcement point above. A test
  asserts each enforcement point consults it.
- **MR-2:** Risk-signal restrictions are **proportional**: a shared-IP signal alone can
  only trigger a rate limit or cooldown, never a ban. This is a code-level rule.
- **MR-3:** Ban records have an expiry or a mandatory review date; indefinite bans are
  reviewed on a schedule (ADR-013).
- **MR-4:** Appeals are audited and their outcomes are a metric (NFR-OBS-001). A high
  appeal-overturn rate is treated as a signal that enforcement is too aggressive.
- **MR-5:** Any proposal to add fingerprinting requires a privacy impact assessment and a
  new ADR; the default answer is no. Recorded in
  [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md).
- **MR-6:** The product's public safety copy is honest about the limits of banning in an
  anonymous product ([SAFETY.md](../SAFETY.md), "Limitations we will not hide").

## Revisit Conditions

- Documented harm from trivially evaded bans → consider a privacy-reviewed identity
  assurance layer (e.g. a rate-limited, privacy-preserving attestation), which requires a
  new ADR.
- Collateral-damage complaints from restricted users → tighten the risk-signal rules.
- Regulatory requirement to act on IP or device → requires legal review and a privacy
  impact assessment before implementation.
- Ban volume grows to the point that manual review is infeasible → revisit ADR-010.

## References

- [ADR-010](ADR-010-moderation-model.md)
- [ADR-014](ADR-014-anonymity-model.md)
- [ADR-013](ADR-013-retention-policy.md)
- [ABUSE_PREVENTION.md](../ABUSE_PREVENTION.md)
- [SAFETY.md](../SAFETY.md)
- [TASKS.md](../TASKS.md) — T-BAN-051, T-BAN-052
