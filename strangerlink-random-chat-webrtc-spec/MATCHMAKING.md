# StrangerLink — Matchmaking

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-008](docs/adr/ADR-008-matchmaking.md), [ADR-009](docs/adr/ADR-009-interest-matching.md), [STATE_MACHINE.md](STATE_MACHINE.md)

> **No matching algorithm is implemented in this phase.** The port exists in
> [src/features/matchmaking/](src/features/matchmaking/) and every method throws
> `Not implemented`. This document describes intended behaviour only.

---

## 1. Conceptual flow

```
Participant
    │
    ▼
┌──────────────────┐
│ Eligibility Check│──── not eligible ────► REJECTED (reason class only)
└────────┬─────────┘
         │ eligible
         ▼
┌──────────────────┐
│   Join Queue     │──── already queued ──► idempotent (return existing ticket)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│Candidate Selection│──── no candidate ────► remain WAITING
└────────┬─────────┘
         │ candidate found
         ▼
┌──────────────────┐
│Safety Constraints │──── violated ────────► reject candidate, continue scanning
└────────┬─────────┘
         │ satisfied
         ▼
┌──────────────────┐
│ Session Creation │──── claim failed ─────► abort, both return to WAITING
│   (atomic)       │
└────────┬─────────┘
         │
         ▼
      MATCHED
```

---

## 2. Random matching

The default behaviour is **random**: the first compatible waiting participant is selected.

| Property | Value |
| --- | --- |
| Selection order | Waiting order within the mode (FIFO), with safety constraints applied at selection |
| Ranking | **None.** No scoring, no attractiveness, no activity weighting |
| Profiling | **None.** No participant profile is built to improve matches |
| History | Only the recent-peer avoidance window; nothing longer |

Randomness is a feature. It is what makes the product different from a social network, and
it is what keeps us from needing participant data.

---

## 3. Interest matching

Interests are a **preference**, never a filter (FR-MATCH-007, ADR-009).

| Step | Behaviour |
| --- | --- |
| 1 | The participant optionally selects tags from a closed vocabulary |
| 2 | Candidate selection prefers participants with overlapping tags |
| 3 | If no overlapping candidate is waiting after a bounded preference window, the participant falls back to the general pool for their mode |
| 4 | Interests are never shown to the peer |

**The UI must not promise a match.** Copy reads "we'll try to match your interests".

---

## 4. Language matching

Language is a **preference**, never a guarantee (FR-MATCH-008).

| Step | Behaviour |
| --- | --- |
| 1 | The participant optionally selects a language (BCP-47 tag) |
| 2 | Candidate selection prefers a matching language |
| 3 | Fallback to the general pool after the bounded preference window |
| 4 | Language is never shown to the peer |

If language learning becomes a primary persona, language may be promoted to a stronger
constraint — that requires revisiting ADR-009.

---

## 5. Region constraints

Where enabled, a region constraint is a **coarse filter**, not a geofence.

| Property | Value |
| --- | --- |
| Granularity | Country or coarse region code |
| Source | Derived from the request; never a precise location |
| Persistence | Not stored beyond the queue entry |
| Effect | Narrows the candidate pool |
| Interaction with interests | Region is a harder constraint than interests; interests are the softer preference |

Region is a matching input. It is not used for analytics, not used for enforcement, and
not stored durably.

---

## 6. Safety constraints

Applied at **candidate selection**, not at queue join, so that enforcement is immediate.

| ID | Constraint | Checked against |
| --- | --- | --- |
| SC-1 | No active block between the two participants (FR-MATCH-003) | `Block` |
| SC-2 | Neither participant is banned or restricted (FR-MATCH-011) | `Ban` |
| SC-3 | Neither participant has an active session (FR-MATCH-002) | Claim primitive |
| SC-4 | Modes are compatible (FR-MATCH-006) | Queue entries |
| SC-5 | Neither participant has left the queue (FR-MATCH-004) | Claim state |
| SC-6 | Not a recent peer (FR-MATCH-005) | Recent-peer window |
| SC-7 | Neither participant is in cooldown (FR-SAFE-002) | Cooldown state |

**Why at selection time and not join time:** a ban or block applied while a user waits must
take effect on the very next selection attempt. A snapshot taken at join time would be
stale within seconds.

---

## 7. Ban constraints

Bans are checked at **every** entry point (FR-MOD-008, ADR-012):

| Entry point | Check |
| --- | --- |
| Queue join | Active ban → reject with a non-specific reason |
| Candidate selection | Active ban on either party → never match |
| Session creation | Active ban → reject |
| WebSocket connect | Banned identity → refuse |
| TURN credential mint | Banned identity → refuse |
| Report submission | **Allowed even when banned** — a banned user must still be able to report |

Ban checks **fail closed**: if the ban store is unreachable, we do not match.

---

## 8. Recent-peer avoidance

| Property | Value |
| --- | --- |
| Window | A bounded number of recent peers per participant (see [PERFORMANCE.md](PERFORMANCE.md)) |
| Storage | In-memory in the realtime service; bounded and pruned |
| Scope | Per participant identity |
| Effect | A recent peer is not selected as a candidate |

This is a **soft** constraint. If the only available candidate is a recent peer, the
system prefers to keep the user waiting rather than rematch them immediately — but the
window is bounded so it cannot cause permanent starvation.

Recent-peer state dies with the realtime process. It is not a durable record of who met
whom.

---

## 9. Queue timeout

| Property | Value |
| --- | --- |
| Maximum wait | See [PERFORMANCE.md](PERFORMANCE.md) |
| On expiry | The user is shown "Nobody's available right now" with **Try again** and **Leave** |
| Retry | Explicit user action only. **No automatic requeue** |
| Effect on state | `WAITING → CANCELLED`; the queue entry is released |

There is no infinite requeue loop. This is a design requirement, not an implementation
detail.

---

## 10. Cancel queue

| Property | Value |
| --- | --- |
| Trigger | User taps Cancel, navigates away, or closes the tab |
| Effect | Immediate. The queue entry is released and the claim is withdrawn |
| Safety | Cancellation is safe at any instant, including during a concurrent match (R2, R9) |
| State | `WAITING → CANCELLED` |

**The race that matters:** if a participant cancels at the exact moment a match is being
created, the match must be aborted and both participants returned to `WAITING`. This is
resolved by the atomic claim check, and is tested.

---

## 11. Requeue

After a session ends, the user is offered a new match.

| Property | Value |
| --- | --- |
| Trigger | User taps "Find someone new" |
| Preconditions | Not banned, not restricted, not in cooldown, no active session |
| Block re-check | Blocks are re-checked at candidate selection, not assumed from queue join (R5) |
| Cooldown | After rapid join/leave cycles, a cooldown applies (FR-SAFE-002) |
| Boundedness | After a configurable number of consecutive requeues without a session, the user is offered an exit |

---

## 12. Disconnect

| Situation | Effect |
| --- | --- |
| Participant's socket drops while `WAITING` | Queue entry held for a bounded reconnect window, then released |
| Participant's socket drops while `ACTIVE` | Reconnect window; then `FAILED` with `transport-lost` |
| Peer disconnects while `CONNECTING` | `FAILED` with `peer-unavailable`; user can requeue |
| Both peers disconnect simultaneously | Exactly one session end (R3) |

---

## 13. Named races

These are the concurrency hazards that must be designed for. They are not "edge cases to
discover later".

| # | Race | Resolution |
| --- | --- | --- |
| R1 | Two workers match the same participant | Single-flight claim; the loser gets a definitive negative, never a retry loop |
| R2 | Participant cancels while being matched | Atomic claim re-check; abort and return both to `WAITING` |
| R3 | Both peers disconnect simultaneously | One session end; the second is idempotent |
| R4 | Report submitted while the session ends | Report accepted against the terminal session (INV-8) |
| R5 | Block created while a requeue is in flight | Requeue re-checks blocks at candidate selection |
| R6 | Duplicate signaling message | `messageId` idempotency |
| R7 | Reconnect to a stale session | Rejected; clean entry state |
| R8 | Two tabs for one identity | Older tab gets `SESSION_SUPERSEDED` |
| R9 | Queue entry expires at the instant of matching | The atomic claim resolves it either way |
| R10 | Ban applied while `WAITING` | Eligibility at selection time |
| R11 | Both peers press Skip at once | One session end; both land in a clean state |
| R12 | Signaling reconnect beats the old socket close | New socket supersedes; old is terminated |

---

## 14. What matchmaking explicitly does not do

| Not done | Why |
| --- | --- |
| Rank participants | Would require profiling (NFR-PRIV-004) |
| Build a preference profile | Data minimisation |
| Use device fingerprints | Deliberately excluded (ABUSE_PREVENTION.md) |
| Store match history durably | Recent-peer window only, in memory |
| Guarantee interest or language matches | FR-MATCH-007, FR-MATCH-008 |
| Requeue automatically | Prevents infinite loops |
| Match across incompatible modes | FR-MATCH-006 |
| Match a participant who has left | FR-MATCH-004 |

---

## 15. Ports

```
MatchmakingService
  ├── joinQueue(input: JoinQueueInput): Promise<QueueTicket>
  ├── leaveQueue(participantId: string): Promise<void>
  └── findMatch(ticket: QueueTicket): Promise<MatchResult>
```

Defined in [src/features/matchmaking/matchmaking.service.ts](src/features/matchmaking/matchmaking.service.ts).
All three throw `Not implemented`.

---

## 16. Implementation status

Tracked in [TASKS.md](TASKS.md) as **T-MATCH-021** (match two eligible participants) and
**T-MATCH-031** (interest and language preference). Neither is implemented.
