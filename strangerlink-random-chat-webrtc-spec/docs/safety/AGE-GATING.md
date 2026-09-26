# StrangerLink — Age Gating

- **Status:** Architecture phase — **critical safety document**
- **Last updated:** 2026-09-26
- **Related:** [SAFETY.md](../../SAFETY.md), [ADR-014](../adr/ADR-014-anonymity-model.md), [docs/safety/MINORS.md](MINORS.md)

---

## 0. Position

**The service is 18+ only. No exceptions, no minor mode, no parental-consent path.**

Age gating in this product is a **self-attestation**, not identity verification. We say so
plainly. Claiming otherwise would be a deceptive safety claim, which
[SAFETY.md](../../SAFETY.md) explicitly forbids.

---

## 1. What the gate requires

Two checkboxes, **both unchecked by default**:

1. **"I am 18 or older."**
2. **"I understand that I will be connected with random strangers, that conversations are
   not screened in real time, and that I may encounter offensive content. I can leave at
   any time and report or block the other person at any time."**

The **Continue** action is genuinely disabled — not merely styled as disabled — until both
are checked.

### Rules

| Rule | Detail |
| --- | --- |
| No pre-checked boxes | An affirmative act is required (FR-ENTRY-002) |
| No "by continuing you agree" | The consent is a separate, visible checkbox |
| Genuinely disabled Continue | Not a styled approximation |
| Keyboard operable | Real `<input type="checkbox">` with associated labels |
| Screen-reader labelled | The gate's purpose is announced on focus |
| Plain language | No legal jargon; target a reading level appropriate to the audience |

---

## 2. What the gate does not do

| Does not | Why |
| --- | --- |
| Verify age | No identity documents, no ID scan, no database check |
| Store a date of birth | Data minimisation (NFR-PRIV-004) |
| Require an account | NG-4 |
| Claim to be verification | NFR-SAFE-003 — deceptive safety claims are forbidden |

**Recorded data:** a `SafetyEvent` of type `age-attested` with a `consentVersion` number.
That is all. No date of birth, no name, no document reference.

---

## 3. Why self-attestation

| Option | Assessment |
| --- | --- |
| **Self-attestation (SELECTED)** | Raises the cost of participation; creates a defensible record; keeps the product free of identity data |
| Document verification | Requires collecting identity documents — a profound privacy cost that contradicts NFR-PRIV-001 and NG-4 |
| Third-party age assurance | PLANNED, not selected; adds friction and a vendor dependency |
| No gate at all | Unacceptable |

Self-attestation is a **documented, accepted limitation**, not an oversight. It appears in
the eight limitations in [SAFETY.md](../../SAFETY.md) §1 and in the safety centre.

---

## 4. Enforcement

| Requirement | Detail |
| --- | --- |
| FR-ENTRY-005 | No chat, queue, or media capability is reachable before the gate, **including via direct URL navigation** |
| `/queue` without consent | Redirects to `/start` |
| `/chat/[sessionId]` without consent | Redirects to `/start` |
| API boundaries | Every chat-capable endpoint re-checks consent server-side |
| WebSocket connect | Refused without a current consent version |
| Client-side gate | A UX affordance only; the server-side check is the control (NFR-SEC-001) |

---

## 5. Consent versioning

| Property | Detail |
| --- | --- |
| `consentVersion` | A server-controlled integer |
| On change | The client is told to re-consent; existing chat capability is suspended until it does |
| Storage | Client-side only, per browser session (FR-ENTRY-010) |
| Re-prompt | Per browser session, and on any version change |

---

## 6. Storage

| Data | Where | Lifetime |
| --- | --- | --- |
| Age attestation | `sessionStorage` | Browser session |
| Consent version | `sessionStorage` | Browser session |
| `SafetyEvent` (server) | PostgreSQL | 12 months (Tier 3) |

**Degradation:** if storage is unavailable (private mode, blocked), the product degrades to
in-memory state and does not crash (EC-23). Consent is then re-requested on every load,
which is the correct failure direction.

---

## 7. If a minor is discovered in a session

Full policy: [docs/safety/MINORS.md](MINORS.md).

| Step | Action |
| --- | --- |
| 1 | The session is terminated immediately |
| 2 | The identity is restricted pending review |
| 3 | A P0 moderation case is created and the on-call is paged |
| 4 | Legal counsel is engaged where the content may be illegal |
| 5 | Every step is audited |

**There is no warning step for minor safety.** A first minor-safety report is P0, not a
progressive-enforcement step 1.

---

## 8. Accessibility

| Requirement | Detail |
| --- | --- |
| FR-ENTRY-007 | The gate is keyboard operable and screen-reader labelled |
| Focus | Moves to the first checkbox on entry to `/start` |
| Disabled state | Announced, not just visual |
| Error state | If Continue is activated without both boxes (shouldn't be possible), the missing item is announced |

---

## 9. Copy

| Moment | Copy |
| --- | --- |
| Heading | "Before you start" |
| Statement | "This service is for adults 18 and over." |
| Checkbox 1 | "I am 18 or older." |
| Checkbox 2 | "I understand that I'll be connected with random strangers, that conversations aren't screened in real time, and that I may see or hear things I find offensive. I can leave at any time and report or block the other person." |
| Continue | "Continue" (disabled until both are checked) |
| Link | "Why do we ask?" → `/safety` |

---

## 10. Implementation status

The gate contract exists in [src/features/safety/](../../src/features/safety/) and
[src/domain/participant/](../../src/domain/participant/). `assertAgeEligibility()` throws
`Not implemented: T-SESSION-002`. Tracked in [TASKS.md](../../TASKS.md).
