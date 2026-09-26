# ADR-007 — Session Model

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-004](ADR-004-signaling-model.md), [ADR-008](ADR-008-matchmaking.md), [ADR-011](ADR-011-reporting-model.md)

## Context

The central invariant of this product is deceptively simple:

> **A participant may belong to at most one active session.**

Everything else depends on it. If it breaks:

- a user could be matched with two strangers at once, which is a consent violation;
- a banned user could hold an old session open while creating a new one;
- blocking would be meaningless, because a blocked peer could appear via a second session;
- reports would reference ambiguous sessions.

The session is also the unit of privacy. It is the boundary within which two strangers
have consented to talk, and outside of which nothing should be retained. Session
identity is what makes reporting, blocking, and moderation enforcement possible **without
an account**.

Full lifecycle: [STATE_MACHINE.md](../STATE_MACHINE.md).

## Problem

What is the session model — what is a session, who owns it, what are its invariants, and
how is it identified?

## Decision Drivers

1. **The one-active-session invariant** must be enforceable, not merely conventional.
2. **No accounts.** Session identity must work for a user with no profile.
3. **Unguessability.** Session IDs must not be enumerable (NFR-SEC-003).
4. **Ephemerality.** Sessions end and leave almost nothing behind.
5. **Report and block survival.** Reports must reference a session that outlives the
   connection (FR-REPORT-002).
6. **Concurrency.** The races in this system are the hard part; the model must make them
   tractable.

## Options Considered

### Option A — Server-authoritative session entity with pseudonymous participant
identities

A `ChatSession` row (or in-flight record) with two participant IDs, a status, and a
creation timestamp. Participants are pseudonymous session identities. Server is the sole
authority on session state.

### Option B — Client-declared session id

The client generates the session id and the server accepts it.

**Weaknesses:** Session fixation. A hostile client could pre-create a session id and get
another user to join it. **Rejected outright.**

### Option C — Persistent conversation thread keyed by an account

**Strengths:** Familiar.

**Weaknesses:** Requires accounts (NG-4), creates durable chat history (NG-2), and gives
a stalker a stable handle on a victim. **Rejected outright.**

### Option D — Stateless sessions encoded entirely in a signed token

**Strengths:** No server-side session store.

**Weaknesses:** Cannot enforce the one-active-session invariant, because the server has
no record of which sessions exist. Cannot support blocking or bans. **Rejected.**

## Decision

**Adopt Option A: server-authoritative sessions with pseudonymous participant
identities.**

### The entity

```
ChatSession {
  id: uuidv7()                  // unguessable, time-ordered
  participantAId: ParticipantId  // pseudonymous session identity
  participantBId: ParticipantId  // pseudonymous session identity
  mode: ChatMode                 // TEXT | TEXT_AUDIO | TEXT_VIDEO
  status: SessionStatus          // see STATE_MACHINE.md
  createdAt: timestamp
  endedAt: timestamp | null
  endReason: SessionEndReason | null
  queueTicketId: uuid | null     // provenance
}
```

### Participant identity

A `Participant` is a **pseudonymous session identity**, not an account:

- Created when a user enters the queue, without any credential.
- Carries a `SessionIdentity` (see [DATA_MODEL.md](../DATA_MODEL.md)) which may include
  a hashed risk signal for abuse prevention — **never** a name, email, or phone.
- Has at most one active session at any time.
- Dies when the browser session ends; there is no login and therefore no re-login.

### Invariants (enforced server-side, tested explicitly)

| ID | Invariant |
| --- | --- |
| INV-1 | A participant has at most one session in a non-terminal status |
| INV-2 | A session has exactly two distinct participants |
| INV-3 | Session status transitions follow [STATE_MACHINE.md](../STATE_MACHINE.md) only |
| INV-4 | A terminal session (`ENDED`, `FAILED`) never re-enters an active status |
| INV-5 | A session cannot be created for a participant with an active block against the other |
| INV-6 | A session cannot be created for a banned or restricted participant |
| INV-7 | Session IDs are generated server-side and are never accepted from a client |
| INV-8 | A report may reference a terminal session (FR-REPORT-002) |

### Where session state lives

| State | Location | Lifetime |
| --- | --- | --- |
| Active session record | In-memory in the realtime service | Session lifetime |
| Session metadata row | PostgreSQL | Retention window in [RETENTION.md](../RETENTION.md) |
| Connection registry | In-memory | Connection lifetime |
| Chat messages | **Not stored** | Session lifetime only |

### Concurrency model

The races are documented, named, and each has a designated owner. They are not
"handled later":

| Race | Resolution |
| --- | --- |
| Two workers match the same participant | Single-flight claim on the participant; the loser gets a definitive "not available" result, never a retry loop |
| Participant cancels while being matched | Match creation checks the claim atomically; if the claim was withdrawn, the match is aborted and both participants are returned to the queue |
| Both peers disconnect simultaneously | Exactly one `SESSION_ENDED`; the second disconnect is idempotent |
| Report submitted while session ends | Report is accepted against the terminal session (INV-8); ordering does not matter |
| Block created while requeue occurs | Requeue re-checks blocks at candidate selection, not at queue join |
| Duplicate signaling message | `messageId` idempotency (ADR-004) |
| Reconnect to a stale session | Rejected; the user is returned to a clean entry state (EC-08) |

## Consequences

**Positive**

- The one-active-session invariant has a single, testable home.
- Blocking and banning have something concrete to attach to.
- Reporting works without accounts.
- Session metadata is the *only* durable trace of a conversation, and it is tiny and
  time-bounded.

**Negative**

- Server-side session state is a scaling constraint; it must be in-memory and fast.
- "At most one active session" means a user with two tabs gets evicted, which is a real
  UX cost (EC-16).
- A terminal session's metadata row is still a record that two identities talked; it is
  retained for safety reasons and must be justified in RETENTION.md.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Invariant INV-1 violated under concurrency | Critical | Medium |
| Session id guessable → enumeration of sessions | Critical | Low |
| Session metadata retained too long → privacy harm | High | Medium |
| Two tabs cause confusing eviction | Medium | High |
| Session state lost on realtime restart strands a user | Medium | Medium |

## Mitigations

- **MR-1:** INV-1 is enforced by a single-flight claim primitive, and is covered by a
  test named "prevents one participant from entering two active sessions" in
  `tests/unit`.
- **MR-2:** `uuidv7()` server-side only; a test asserts no session id is accepted from a
  client-supplied value.
- **MR-3:** Retention job for session metadata is scheduled, logged, and alerts on
  failure (ADR-002 MR-5, [RETENTION.md](../RETENTION.md)).
- **MR-4:** Two-tab eviction is explicit and communicated: the older tab receives a
  `SESSION_SUPERSEDED` notice and is returned to the entry state. Documented in
  [DESIGN.md](../DESIGN.md).
- **MR-5:** On realtime restart, in-flight sessions are ended with reason
  `server-restart` and users are returned to a clean state rather than left hanging.

## Revisit Conditions

- We add any multi-party feature (NG-9) — the two-participant invariant is replaced.
- We add persistent identity — the participant model changes and this ADR is superseded.
- Realtime instances exceed one — session state must move to shared storage, which
  triggers the Redis decision.

## References

- [STATE_MACHINE.md](../STATE_MACHINE.md)
- [DATA_MODEL.md](../DATA_MODEL.md)
- [MATCHMAKING.md](../MATCHMAKING.md)
- [TASKS.md](../TASKS.md) — T-SESSION-001, T-SESSION-004
- [tests/unit/session.invariants.test.ts](../tests/unit/)
