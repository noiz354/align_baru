# StrangerLink — Session State Machine

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [STATE_MACHINE.md](STATE_MACHINE.md), [ADR-007](docs/adr/ADR-007-session-model.md), [SIGNALING.md](SIGNALING.md)

---

## 1. States

| State | Meaning | Terminal? |
| --- | --- | --- |
| `CREATED` | A session record exists but no peer has been attached | No |
| `WAITING` | A participant is in the queue, waiting for a match | No |
| `MATCHED` | Two eligible participants have been paired | No |
| `CONNECTING` | Media negotiation is in progress (media modes only) | No |
| `ACTIVE` | The session is live and usable | No |
| `ENDING` | Teardown has begun; waiting for both sides to acknowledge | No |
| `ENDED` | The session completed normally | **Yes** |
| `REPORTED` | The session ended because a report was submitted | **Yes** |
| `BLOCKED` | The session ended because a block was created | **Yes** |
| `FAILED` | The session could not be established or was lost unrecoverably | **Yes** |

`CANCELLED` is not a session state — it is a queue state. A participant who cancels while
`WAITING` never creates a session. It is documented here because the transition is easy to
misread.

---

## 2. Transition table

### From `CREATED`

| To | Trigger | Guard |
| --- | --- | --- |
| `WAITING` | Participant joins the queue | Eligibility passes; no active session; not banned |
| `FAILED` | Eligibility fails | Reason class recorded; no detail leaked to user |

### From `WAITING`

| To | Trigger | Guard |
| --- | --- | --- |
| `MATCHED` | Compatpatible candidate found and both claimed atomically | All MC constraints satisfied |
| `CANCELLED` | Participant cancels, or queue expires | Immediate; no session created |
| `FAILED` | Participant disconnects, or server restart | Queue entry released |

### From `MATCHED`

| To | Trigger | Guard |
| --- | --- | --- |
| `CONNECTING` | Both participants acknowledge the match (`SESSION_READY`) | Both peers present |
| `FAILED` | A peer is unavailable or withdraws | Reason `peer-unavailable` |
| `ENDING` | A peer leaves before acknowledging | Reason `peer-left` |

### From `CONNECTING`

| To | Trigger | Guard |
| --- | --- | --- |
| `ACTIVE` | Media established, or text-only mode confirmed ready | — |
| `FAILED` | ICE timeout, permission denied and not recoverable, peer gone | Specific reason recorded |
| `ENDING` | User leaves during setup | Reason `skip` |

### From `ACTIVE`

| To | Trigger | Guard |
| --- | --- | --- |
| `ENDING` | Either peer skips, leaves, or disconnects | — |
| `REPORTED` | A report is submitted by either peer | Report accepted even as the session ends |
| `BLOCKED` | A block is created by either peer | Block recorded before transition |
| `FAILED` | Unrecoverable transport loss | Reason `transport-lost` |

### From `ENDING`

| To | Trigger | Guard |
| --- | --- | --- |
| `ENDED` | Both sides acknowledged teardown | — |
| `FAILED` | Teardown times out | Session is force-ended; no hang |

### From terminal states

No transitions out. `ENDED`, `REPORTED`, `BLOCKED`, and `FAILED` are absorbing (INV-4).

---

## 3. Diagram

```
                       ┌──────────┐
                       │  CREATED │
                       └────┬─────┘
              eligibility   │
              ┌─────────────┼──────────────┐
              ▼             │              ▼
        ┌──────────┐        │        ┌──────────┐
        │  FAILED  │        │        │ WAITING  │
        └──────────┘        │        └────┬─────┘
                            │             │
                            │     match   │   cancel / expire
                            │             │
                            │             ▼
                            │      ┌────────────┐
                            │      │ CANCELLED  │  (queue state, no session)
                            │      └────────────┘
                            ▼
                       ┌──────────┐
                       │ MATCHED  │
                       └────┬─────┘
             both ack      │      peer unavailable
        ┌──────────────────┘       └──────────────┐
        ▼                                           ▼
┌──────────────┐                            ┌──────────┐
│  CONNECTING  │                            │  FAILED  │
└──┬───────┬───┘                            └──────────┘
   │       │
   │ media │ ICE timeout / permission denied
   │ ok    └──────────────┐
   ▼                      │
┌──────────┐              │
│  ACTIVE  │              │
└──┬──┬──┬──┘              │
   │  │  │                 │
   │  │  └── report ──┐    │
   │  │               │    │
   │  └── block ──┐   │    │
   │              │   │    │
   │  skip/leave  │   │    │
   ▼              ▼   ▼    ▼
┌──────────┐  ┌──────────┐ ┌──────────┐
│ ENDING   │  │ REPORTED │ │ BLOCKED  │
└────┬─────┘  └──────────┘ └──────────┘
     │
     │ both acknowledged
     ▼
┌──────────┐
│  ENDED   │
└──────────┘
```

---

## 4. Invariants

| ID | Invariant |
| --- | --- |
| INV-1 | A participant has at most one session in a non-terminal status |
| INV-2 | A session has exactly two distinct participants |
| INV-3 | Only transitions in this document are permitted |
| INV-4 | Terminal states are absorbing |
| INV-5 | A session is never created between participants with an active block |
| INV-6 | A session is never created for a banned or restricted participant |
| INV-7 | Session IDs are generated server-side only |
| INV-8 | A report may reference a terminal session |

---

## 5. Guards and side effects

### Transition side effects

| Transition | Side effects |
| --- | --- |
| `CREATED → WAITING` | Queue entry created; `ParticipantEnteredQueue` emitted; eligibility snapshot recorded |
| `WAITING → MATCHED` | `MatchCreated` emitted; both participants claimed; recent-peer record written |
| `MATCHED → CONNECTING` | `SessionStarted` emitted; media mode determines whether this state is entered at all |
| `CONNECTING → ACTIVE` | `PeerConnected` emitted; media metrics recorded |
| `ACTIVE → ENDING` | Teardown begun; peer notified via `PEER_LEFT` |
| `ACTIVE → REPORTED` | Report accepted; moderation case created; `ReportCreated` emitted |
| `ACTIVE → BLOCKED` | Block recorded; `BlockCreated` emitted |
| `* → FAILED` | Failure reason class recorded; user returned to a clean state |
| `* → ENDED` | `SessionEnded` emitted; queue entry and connection registry released; session metadata row written |

### Note on text-only mode

In `TEXT` mode there is no media negotiation, so `CONNECTING` is either skipped
(`MATCHED → ACTIVE`) or used only to confirm that both peers' transports are ready. The
decision is recorded in [TASKS.md](TASKS.md) as an explicit task; the state machine
supports both.

---

## 6. Concurrency: named races and their resolution

Every race in this system is named here so that an implementer cannot claim it was
unknown.

| # | Race | Resolution |
| --- | --- | --- |
| R1 | **Two workers match the same participant** | Single-flight claim on the participant. The loser receives a definitive negative result and does not retry |
| R2 | **Participant cancels while being matched** | Match creation re-checks the claim atomically; if withdrawn, the match is aborted and both participants return to `WAITING` |
| R3 | **Both peers disconnect simultaneously** | Exactly one `SESSION_ENDED` is emitted; the second disconnect is idempotent |
| R4 | **Report submitted while the session is ending** | The report is accepted against the (possibly terminal) session. Ordering is irrelevant (INV-8) |
| R5 | **Block created while a requeue is in flight** | Requeue re-checks blocks at candidate selection, not at queue join |
| R6 | **Duplicate signaling message** | `messageId` idempotency key per session; duplicates are dropped |
| R7 | **Reconnect to a stale session id** | Rejected; the user is returned to a clean entry state (EC-08) |
| R8 | **Two browser tabs for the same identity** | The older session receives `SESSION_SUPERSEDED` and is ended; INV-1 is preserved |
| R9 | **Queue entry expires at the moment a match is created** | The atomic claim resolves it: either the match wins and the entry is consumed, or the expiry wins and the match is aborted |
| R10 | **Ban applied while a participant is `WAITING`** | Eligibility is evaluated at candidate selection, so the ban takes effect on the next selection attempt |
| R11 | **Both peers press Skip at the same moment** | Same as R3 — one session end, both users land in a clean post-session state |
| R12 | **Signaling reconnect arrives before the old socket is closed** | The new socket supersedes the old; the old is terminated; no duplicate dispatch |

---

## 7. Realtime failure model

Detailed in [docs/realtime/FAILURE-MODEL.md](docs/realtime/FAILURE-MODEL.md). Summary of
what the state machine must survive:

| Failure | State impact |
| --- | --- |
| WebSocket disconnect | Session is **not** immediately ended; a reconnect window applies |
| WebSocket reconnect success | Session resumes; sequence numbers continue |
| Reconnect window expires | `ACTIVE → FAILED`, reason `transport-lost` |
| Peer disappears | `ACTIVE → ENDING`, reason `peer-left` |
| ICE timeout | `CONNECTING → FAILED`, reason `ice-timeout` |
| TURN unavailable | `CONNECTING → FAILED`, reason `turn-unavailable`; text chat may continue |
| Permission denied | `CONNECTING → FAILED` or a recoverable `ACTIVE` with media off |
| Camera disappears | Media state → `failed`; session continues |
| Network switch (Wi-Fi → cellular) | ICE restart; if it fails, `FAILED` |
| Tab suspended / backgrounded | May end by timeout; user informed on return |
| Server restart | In-flight sessions → `FAILED`, reason `server-restart` |

---

## 8. Implementation status

**The state machine is not implemented.** The types and the transition table exist in
[src/domain/session/](src/domain/session/) as data; the transition function throws
`Not implemented` and is tracked as **T-SESSION-004** in [TASKS.md](TASKS.md).
