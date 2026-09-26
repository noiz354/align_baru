# ADR-008 — Matchmaking

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-007](ADR-007-session-model.md), [ADR-009](ADR-009-interest-matching.md), [ADR-012](ADR-012-ban-enforcement.md)

## Context

Matchmaking is the heart of the product and the hardest part to get right, for three
separate reasons:

1. **It is a safety boundary.** Matching decides *who gets to talk to whom*. A matching
   bug that pairs a blocked user with their victim, or pairs a minor with an adult, is a
   safety incident, not a performance bug.
2. **It is a concurrency problem.** Many participants are joining, cancelling, and being
   matched simultaneously. The interesting failures are all races.
3. **It is a product decision.** How long should someone wait? Should we ever match
   badly rather than not at all? What happens when nobody is available?

Conceptual flow: [MATCHMAKING.md](../MATCHMAKING.md). **No matching algorithm is
implemented in this phase.**

## Problem

What is the matchmaking model — where does it run, what does it optimise for, and what
are its non-negotiable constraints?

## Decision Drivers

1. **Safety over speed.** A delayed match is acceptable; an unsafe match is not.
2. **Race correctness.** Every documented race must have a defined resolution.
3. **Simplicity.** A small team must be able to reason about the whole matcher.
4. **Latency.** Users are waiting and watching a spinner; matching must be fast.
5. **Bounded waiting.** Nobody waits forever.
6. **Observability.** We must be able to see queue size and match latency without seeing
   who is talking to whom.

## Options Considered

### Option A — In-memory FIFO queue in the realtime service, with eligibility filtering
at selection time

A single ordered waiting list per mode. On join, append. On candidate selection, scan
for the first eligible partner.

**Strengths:** Simple, fast, easy to reason about. Eligibility is evaluated at selection
time, so a ban or block applied while waiting takes effect immediately.

**Weaknesses:** The scan is O(n) in the worst case. Single point of failure (the realtime
service).

### Option B — Multi-bucket queues by interest/language/region, with a fallback to a
general bucket

Separate queues per (mode, language, region) with a general fallback.

**Strengths:** Better match quality for users with specific interests.

**Weaknesses:** Bucket starvation — a niche bucket may never fill, so users wait forever
unless a fallback exists. More state, more races, more edge cases.

### Option C — External matchmaking service with a scoring/ranking algorithm

**Strengths:** Could optimise match quality.

**Weaknesses:** Ranking implies profiling participants, which conflicts with our
data-minimisation position (NFR-PRIV-004). Also over-engineered for a product whose
promise is "a random stranger". **Rejected.**

### Option D — Distributed queue in Redis with cross-instance coordination

**Strengths:** Horizontal scale.

**Weaknesses:** Premature. Adds Redis as a dependency before we have evidence we need it.
Deferred per ADR-002.

## Decision

**Adopt Option A for the first implementation, with Option B's bucketing deferred to
ADR-009.**

### The flow

```
Participant
    │
    ▼
Eligibility Check ─────── not eligible ──► REJECTED (with reason class, not detail)
    │ eligible
    ▼
Join Queue (single-flight claim on participant)
    │
    ▼
Candidate Selection ──── no compatible candidate ──► remain WAITING
    │ compatible candidate found
    ▼
Safety Constraints ───── violated ──► candidate rejected, continue scanning
    │ satisfied
    ▼
Atomic Session Creation (both participants claimed, or neither)
    │
    ▼
MATCHED
```

### Non-negotiable constraints

| ID | Constraint |
| --- | --- |
| MC-1 | A participant who has left the queue is never matched (FR-MATCH-004) |
| MC-2 | Participants with an active block relationship are never matched (FR-MATCH-003) |
| MC-3 | Recently-matched peers are not immediately rematched (FR-MATCH-005) |
| MC-4 | A participant may belong to at most one active session (FR-MATCH-002, INV-1) |
| MC-5 | Match mode must be compatible on both sides (FR-MATCH-006) |
| MC-6 | Concurrent match attempts resolve to exactly one session (FR-MATCH-009) |
| MC-7 | Session creation is atomic: both peers or neither (FR-MATCH-010) |
| MC-8 | Banned or restricted participants are never matched (FR-MATCH-011) |
| MC-9 | Queue cancellation is safe at any instant (FR-MATCH-012) |
| MC-10 | Interest and language matching are preferences, never guarantees (FR-MATCH-007, FR-MATCH-008) |

### What matching does **not** do

- It does not rank participants by attractiveness, activity, or any score.
- It does not build a profile of a participant to improve future matches.
- It does not retain a match history beyond the recent-peer avoidance window.
- It does not use device fingerprinting.

### Bounded waiting

- Queue wait has a maximum duration (see [PERFORMANCE.md](../PERFORMANCE.md)).
- On expiry, the user is offered a retry or a clean exit. There is **no infinite
  requeue loop**.
- Rapid join/leave cycles trigger a cooldown (FR-SAFE-002).

## Consequences

**Positive**

- Eligibility at *selection* time means enforcement is immediate: a ban or block applied
  while a user waits takes effect on the very next candidate.
- The single-flight claim makes the central invariant easy to enforce and test.
- No profiling, no ranking, no retained match history — consistent with the privacy
  position.

**Negative**

- O(n) candidate scanning degrades under a large queue. Mitigated by the fact that most
  scans find a partner immediately.
- A single realtime instance is a bottleneck and a single point of failure.
- "Never match badly" means users with very specific interests may wait longer; this is a
  deliberate product choice, disclosed in the UI.
- Recent-peer avoidance requires holding a small amount of state about who met whom.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Two workers match the same participant | Critical | Medium |
| Participant cancels at the instant of matching → orphaned session | Critical | Medium |
| Blocked pair matched due to a stale eligibility snapshot | Critical | Medium |
| Queue starvation for niche interests | Medium | High |
| Matchmaking latency spikes under load | Medium | Medium |
| Realtime instance restart loses the queue | Medium | Medium |

## Mitigations

- **MR-1:** Single-flight claim primitive. A participant is claimed exactly once; a
  second attempt receives a definitive negative result rather than retrying. Tested by
  "prevents one participant from entering two active sessions".
- **MR-2:** Atomic match creation: both claims are acquired before any session is
  created; on any failure, all claims are released and both participants return to the
  queue. Tested by "handles concurrent match attempts".
- **MR-3:** Eligibility (blocks, bans, restrictions) is evaluated at candidate
  **selection** time against current state, never cached from queue-join time.
- **MR-4:** Queue wait timeout with an explicit retry/exit offer; recent-peer avoidance
  window is bounded and pruned.
- **MR-5:** Queue size and match latency are metrics with alerts (NFR-OPS/OBS). Match
  latency is measured end-to-end from queue join to `MATCH_FOUND`.
- **MR-6:** On realtime restart, the queue is lost and users are returned to a clean
  state with a clear message. No silent hang.

## Revisit Conditions

- Concurrent waiting participants exceed what a single in-memory queue handles in load
  testing → introduce bucketing and/or Redis-backed coordination.
- Users with niche interests report unacceptably long waits → revisit ADR-009.
- We introduce a multi-region deployment → matching must become region-aware, and
  ADR-009's region constraints become load-bearing.
- Match quality complaints justify a *documented, privacy-reviewed* scoring approach —
  which would require a new ADR and a privacy impact assessment.

## References

- [MATCHMAKING.md](../MATCHMAKING.md)
- [ADR-009](ADR-009-interest-matching.md)
- [ADR-007](ADR-007-session-model.md)
- [STATE_MACHINE.md](../STATE_MACHINE.md)
- [TASKS.md](../TASKS.md) — T-MATCH-021 and related
- [src/domain/matchmaking/](../src/domain/matchmaking/)

- [src/features/matchmaking/](../src/features/matchmaking/)
