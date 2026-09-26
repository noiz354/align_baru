# StrangerLink — Blocking

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-011](../adr/ADR-011-reporting-model.md), [ADR-012](../adr/ADR-012-ban-enforcement.md), [SAFETY.md](../../SAFETY.md)

---

## 0. Position

Blocking is the user's own enforcement tool. It is deliberately **simpler and more
immediate** than reporting: one confirmation, no explanation, no category, no note.

But blocking in an anonymous product has real limits, and we disclose them rather than
implying a protection we cannot deliver.

---

## 1. Block scopes

| Scope | Effect | Duration | Used for |
| --- | --- | --- | --- |
| **`session`** | Prevents immediate rematch between the two identities | Bounded window (see §4) | Default for any user-initiated block |
| **`platform`** | Prevents the blocked identity from matching with the blocker across sessions | Until reviewed | Safety-class blocks, or a user explicitly choosing the stronger option |

**Default is `session`.** `platform` is available but is not the default, because a
platform-scope block is a stronger statement about another person and should be a
deliberate choice.

---

## 2. Blocking the current participant

| Property | Commitment |
| --- | --- |
| **Reachability** | One action from any active session state (FR-BLOCK-001) |
| **Confirmation** | Exactly one additional tap (FR-BLOCK-003) |
| **Explanation** | Never required (FR-BLOCK-006) |
| **Effect** | The session ends immediately |
| **Feedback** | "Blocked. They can't match with you again." |

**Flow:**

```
[Block]  →  "Block this person? They won't be matched with you again."
                [Block]  [Cancel]
                  │
                  ▼
           Block recorded
                  │
                  ▼
           Session ends
                  │
                  ▼
    "Blocked. They can't match with you again."
                  │
                  ▼
    [Find someone new]  /  [Leave]
```

---

## 3. Preventing immediate rematch

| Property | Detail |
| --- | --- |
| **Mechanism** | The block is consulted at **candidate selection**, not only at queue join (R5) |
| **Why at selection** | A block created while a requeue is already in flight must still take effect |
| **Recent-peer avoidance** | Independent of blocking; a bounded window also applies (FR-MATCH-005) |
| **Symmetry** | A block prevents the pair from matching in either direction |

---

## 4. Persistence and expiration

| Scope | Storage | Persistence | Expiry |
| --- | --- | --- | --- |
| `session` | Client (`sessionStorage`) **and** server record | Survives reload within the browser session (FR-BLOCK-004) | Bounded window; see below |
| `platform` | Server record only | Survives across browser sessions where the identity persists | Reviewed on a schedule |

### The honest limitation

**A block cannot survive the blocked person getting a new identity.** In a product with no
accounts, a determined person can clear their storage, change network, and return as a new
participant. Blocking raises the cost; it does not eliminate the possibility.

**This is disclosed in the UI.** The confirmation copy says "They won't be matched with you
again" — which is true for *this identity*. The safety centre states the limitation
explicitly.

### Why we do not use IP or device bans to strengthen blocking

| Approach | Why rejected |
| --- | --- |
| IP ban | Collateral damage on CGNAT and shared connections; trivially evaded |
| Device fingerprint ban | Requires invasive fingerprinting we deliberately do not do |
| Cross-session identity linkage | Would create the persistent identity the product promises not to have |

See [ADR-012](../adr/ADR-012-ban-enforcement.md) and
[ABUSE_PREVENTION.md](../../ABUSE_PREVENTION.md) §5.

---

## 5. Blocking vs reporting

| | Block | Report |
| --- | --- | --- |
| Purpose | Protect the user's own experience | Protect other users |
| Confirmation | One tap | Category selection + submit |
| Explanation required | Never | Never |
| Creates a moderation case | No | Yes |
| Ends the session | Yes | Yes |
| Peer informed | No | No |
| Audited | Yes (a `BlockCreated` event) | Yes (a `ModerationCase`) |

**Blocking and reporting are independent.** A user can do both, either, or neither. Neither
action requires the other.

---

## 6. Block data model

```typescript
interface Block {
  id: string;
  blockerIdentityId: string;   // SessionIdentity
  blockedIdentityId: string;   // SessionIdentity
  scope: BlockScope;           // 'session' | 'platform'
  createdAt: string;           // UTC
  expiresAt: string | null;    // null for platform scope until reviewed
}
```

**Deliberately absent:** a reason, a note, a category, or any personal data. Blocking is a
private act and requires no justification (FR-BLOCK-006).

---

## 7. Concurrency

| Race | Resolution |
| --- | --- |
| **R5 — block created while a requeue is in flight** | Requeue re-checks blocks at candidate selection, not at queue join |
| Both peers block each other simultaneously | Both blocks are recorded; both are idempotent; the session ends once |
| Block created as the session is ending | The block is recorded regardless of session state |
| Block created for an identity that is already gone | Recorded; the identity is simply never selected again |

---

## 8. What blocking does not do

| Does not | Why |
| --- | --- |
| Prevent the person returning under a new identity | No accounts; disclosed |
| Notify the blocked person | Retaliation risk; teaches evasion |
| Restrict the blocked person's access | That is a ban, which is a moderation decision, not a user action |
| Require or record a reason | FR-BLOCK-006 |
| Persist across a cleared browser session for `session` scope | By design — the browser session is the privacy boundary |
| Guarantee the two never meet again by chance | Recent-peer avoidance is bounded, not permanent |

---

## 9. Blocking and moderation

A block is **not** a report and does not create a moderation case. However:

- Block volume is a safety metric.
- A pattern of blocks against one identity is a behavioural abuse signal that feeds
  [MODERATION.md](../../MODERATION.md).
- A `platform`-scope block requested by a user is recorded, and repeated requests against
  the same identity may prompt review.

---

## 10. Accessibility

| Requirement | Detail |
| --- | --- |
| Reachable by keyboard | Yes; in the bottom control bar |
| Reachable without traversing the message list | Yes |
| Confirmation is focus-trapped | Yes; Escape cancels |
| State announced | "You blocked this person." |
| Touch target | ≥ 56 × 56 px |

---

## 11. Implementation status

The block contract exists in [src/shared/contracts/](../../src/shared/contracts/) and
[src/features/blocks/](../../src/features/blocks/). `createBlock()` throws
`Not implemented: T-BLOCK-017`. Tracked in [TASKS.md](../../TASKS.md).
