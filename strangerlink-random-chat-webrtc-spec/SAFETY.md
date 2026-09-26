# StrangerLink — Safety

- **Status:** Architecture phase — **critical document**
- **Last updated:** 2026-09-26
- **Related:** [MODERATION.md](MODERATION.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [docs/safety/REPORTING.md](docs/safety/REPORTING.md), [docs/safety/BLOCKING.md](docs/safety/BLOCKING.md)

---

## 0. Position statement

**StrangerLink is not an unrestricted anonymous chat system.**

Anonymity is provided for the user's benefit — low friction, no profile, no social graph.
It is not provided as a shield for abuse. Every anonymity property in this product has a
corresponding enforcement property, and where the two conflict, **safety wins**.

We do not design, build, or permit features intended to bypass moderation, law
enforcement, safety controls, device bans, or platform policies.

---

## 1. Limitations we will not hide

This section is a requirement, not a disclaimer. The product must not claim what it cannot
deliver (NFR-SAFE-003).

| Limitation | Honest statement |
| --- | --- |
| **Real-time screening** | Conversations are **not** screened in real time. A human cannot read a message before you see it. |
| **Perfect moderation** | No moderation system is perfect. Some harmful content will be seen before it is stopped. |
| **Anonymous identity** | We cannot verify who someone is. A banned user may return under a new identity. |
| **Network privacy** | During an audio or video call, the other person may be able to determine your approximate location from your internet connection. |
| **Content after the fact** | We do not keep a record of your conversation, so we usually cannot show a moderator what was said. |
| **Blocking limits** | Blocking prevents someone matching with you again through StrangerLink. It cannot stop them returning under a new identity. |
| **Age assurance** | Age is self-declared. We cannot prove a user is 18. |
| **Minors** | We cannot guarantee no minor will ever use the service. |

These statements appear in the safety notice, the privacy notice, and the safety centre.
They are not buried.

---

## 2. Age eligibility

| Requirement | Detail |
| --- | --- |
| Minimum age | **18** |
| Mechanism | Affirmative self-attestation via two unchecked-by-default checkboxes (FR-ENTRY-002) |
| What it is not | Identity verification. We do not claim it is |
| Enforcement if a minor is found | Immediate session termination, identity restriction, and escalation (see §9) |
| Data collected | A `SafetyEvent` of type `age-attested` with a version number — **no** date of birth, no ID, no document |

Full detail: [docs/safety/AGE-GATING.md](docs/safety/AGE-GATING.md).

### Why self-attestation

Verified age assurance requires collecting identity documents, which is a profound
privacy cost and directly contradicts NFR-PRIV-001 and NG-4. Self-attestation raises the
cost of participation, creates a defensible record, and keeps the product free of identity
data. It is a **documented, accepted limitation**, not an oversight.

---

## 3. Consent

Consent is explicit, versioned, and re-requested when policy changes (FR-ENTRY-008,
FR-ENTRY-009).

| Consent item | Text shown |
| --- | --- |
| Stranger interaction | "I understand that I will be connected with random strangers." |
| No screening | "I understand that conversations are not screened in real time and I may encounter offensive content." |
| Ephemerality | "I understand that conversations are not recorded or stored." |
| Exit rights | "I understand that I can leave at any time and report or block the other person at any time." |
| Media modes only | "I understand that during an audio or video call, the other person may be able to determine my approximate location." |

Consent state is stored **client-side only**, per browser session, and is re-requested
when `consentVersion` changes.

---

## 4. Safety onboarding

The onboarding sequence is short and non-manipulative:

```
Landing (/) 
  → Start
  → Age gate: "I am 18 or older" + "I understand…"   [both required]
  → Safety notice (scrollable, not dismissible-forever)
  → Mode selection
  → Optional interests
  → Join queue
```

**Rules**

- No onboarding carousel, no gamified tutorial, no progress bar that pressures completion.
- The safety notice can be read but not permanently dismissed on first visit.
- Every step has a visible way back.
- There is no dark pattern that makes "I am 18 or older" easier to click than to read.

---

## 5. Report UX

Full specification: [docs/safety/REPORTING.md](docs/safety/REPORTING.md).

| Property | Commitment |
| --- | --- |
| Reachability | One action from any active session state, including `CONNECTING` (FR-REPORT-001) |
| Visibility | Never hidden in a menu, never in a footer, never removed |
| Effect of opening | **Does not** end the session |
| Effect of submitting | Ends the session immediately |
| Information required | Category only; note is optional |
| Information never required | Name, email, phone, account |
| After submission | Acknowledgement of receipt; **no** outcome, reasoning, or timeline |
| After peer disconnect | Still accepted (FR-REPORT-002) |

---

## 6. Block UX

Full specification: [docs/safety/BLOCKING.md](docs/safety/BLOCKING.md).

| Property | Commitment |
| --- | --- |
| Reachability | One action from any active session state (FR-BLOCK-001) |
| Confirmation | Exactly one additional tap |
| Effect | Session ends; the blocked identity cannot rematch (FR-BLOCK-002) |
| Persistence | Survives reload within the browser session (FR-BLOCK-004) |
| Scope | `session` by default; `platform` only for safety-class blocks (FR-BLOCK-005) |
| Explanation required | **Never** (FR-BLOCK-006) |
| Honest limits | Disclosed: blocking works through StrangerLink only |

---

## 7. Moderation policy

Full architecture: [MODERATION.md](MODERATION.md).

### 7.1 Policy areas

| Area | Position |
| --- | --- |
| **Sexual content** | Non-consensual nudity, exposure, and sexual solicitation are prohibited and end the session. Consensual adult sexual content between strangers is **not** a supported use case and is prohibited in text and media. |
| **Minors** | Zero tolerance. Any indication of a minor in a session triggers immediate termination, restriction, and P0 escalation. |
| **Harassment** | Repeated unwanted contact, insults, slurs, and targeted abuse are prohibited. |
| **Threats** | Threats of violence, self-harm, or harm to others are P0 and are escalated. |
| **Hate** | Attacks based on protected characteristics are prohibited. |
| **Spam and scams** | Advertising, phishing, and fraudulent solicitation are prohibited. |
| **Illegal content** | Zero tolerance, immediate P0 escalation, and escalation to law enforcement where required by law. |
| **Self-harm** | Handled with care; see §8. |

### 7.2 Enforcement outcomes

| Outcome | Trigger | Duration |
| --- | --- | --- |
| Allow | No violation | — |
| Warn | First minor violation | Session |
| Disconnect | Confirmed violation | Immediate |
| Temporary restriction | Repeat violation | 24 h, then 7 d |
| Ban | Severe or repeated | Bounded or indefinite, with review |

Progressive enforcement is a requirement (FR-SAFE-005). A first-time minor violation gets
a warning, not a ban.

### 7.3 What is never enforced

- Content that is merely unpleasant, disagreeable, or politically offensive.
- A user's choice to leave or skip.
- Consensual adult conversation that is simply awkward.

Over-enforcement drives away the users we want and is treated as a defect.

---

## 8. Escalation

### 8.1 Escalation ladder

| Severity | Trigger | Routing | Response target |
| --- | --- | --- | --- |
| **P0** | Minor safety, illegal content, credible threats | Dedicated always-monitored queue; **pages** on-call | Immediate |
| **P1** | Harassment, sexual content, scams, hate | Standard triage queue | Same business day |
| **P2** | Spam, other | Standard triage queue | Best effort |

P0 cases **bypass the normal queue entirely**. They are not queued behind routine triage
(FR-SAFE-008).

### 8.2 Illegal content escalation policy

1. The session is terminated immediately.
2. A P0 moderation case is created and the on-call is paged.
3. The case is reviewed by a senior moderator, not a junior one.
4. Where required by law, the matter is escalated to the appropriate authority through
   legal counsel. **The on-call engineer does not contact law enforcement directly.**
5. Preservation obligations are assessed by legal counsel. Because we do not store chat
   content, preservation is limited to session metadata, reports, and audit records.
6. Every step is recorded in the audit log.

**We do not build features to detect illegal content automatically.** Detection is
human-led in this phase.

### 8.3 Self-harm escalation

Where legally and operationally appropriate:

1. The session is ended with neutral, non-judgemental copy.
2. The user is shown a crisis-resource notice appropriate to their detected region where
   one exists, without requiring them to disclose location.
3. A P1 case is created.
4. We do not attempt to counsel, diagnose, or intervene clinically. We surface resources
   and record the event.

The resource list is region-aware, reviewed by a qualified party before launch, and
maintained as content, not code.

---

## 9. Minors protection

Full detail: [docs/safety/MINORS.md](docs/safety/MINORS.md).

| Measure | Detail |
| --- | --- |
| Age gate | 18+ affirmative attestation before any chat capability |
| Direct URL protection | `/queue` and `/chat/[sessionId]` are unreachable without consent (FR-ENTRY-005) |
| In-session detection | Any indication of a minor ends the session immediately |
| Restriction | The identity is restricted pending review |
| Escalation | P0, always-monitored queue |
| Reporting category | "Minor safety" is a distinct, visually distinct P0 category |
| No exceptions | There is no "minor mode", no filtered mode for minors, no parental consent path |

---

## 10. Session termination

| Trigger | Who initiates | Copy shown |
| --- | --- | --- |
| User skips | User | Post-session screen |
| User leaves | User | Post-session screen |
| Peer leaves | Peer | "Your stranger left the chat." |
| Report submitted | Reporter | Report acknowledgement |
| Block created | Blocker | Block confirmation |
| Session timeout | System | "This chat ended because it ran too long." |
| Rate limit exceeded | System | "Slow down a moment." |
| Moderation action | Moderator | "This chat was ended by moderation." |
| Transport failure | System | "Your connection was lost." |
| Server restart | System | "Something went wrong. Please start a new chat." |

**Moderation termination copy is deliberately minimal.** It never states the rule, the
signal, or the actor (NFR-SAFE-002). The user may report the decision as a mistake, which
creates an auditable appeal path.

---

## 11. Session safety controls

| Control | Value | Requirement |
| --- | --- | --- |
| One active session per participant | Hard invariant | FR-MATCH-002, INV-1 |
| Maximum session duration | 30 minutes | FR-SAFE-003 |
| Maximum message length | 2000 characters | FR-CHAT-003 |
| Maximum messages per 10 s | 10 | FR-CHAT-004 |
| Maximum messages per session | 300 | FR-CHAT-004 |
| Queue join cooldown | After rapid join/leave cycles | FR-SAFE-002 |
| Queue wait timeout | Bounded; see [PERFORMANCE.md](PERFORMANCE.md) | FR-QUEUE-006 |
| TURN allocation quota | Per identity and per server | FR-ABUSE-004 |
| Report rate limit | 5/hour per identity | FR-REPORT-007 |

All are enforced server-side. Client-side limits are UX affordances only.

---

## 12. Privacy in safety operations

Moderation must not become surveillance.

| Rule | Detail |
| --- | --- |
| Moderators see no chat content | It does not exist (ADR-010) |
| Moderators see no media | It is never recorded |
| Moderators see session metadata only | Mode, duration, timestamps, end reason, participant ids |
| IP addresses | Visible only for a specific documented safety investigation, with an audit record |
| Risk signals | Aggregated; never raw |
| Every moderator action | Audited with actor, action, reason, timestamp |
| No bulk export of personal data | Exports require a documented reason and are audited |

---

## 13. Ban enforcement

Full detail: [ADR-012](docs/adr/ADR-012-ban-enforcement.md).

| Property | Commitment |
| --- | --- |
| Ban subject | Pseudonymous session identity |
| Checked at | Queue join, candidate selection, session creation, WebSocket connect, TURN mint |
| Not used | IP bans, device fingerprints |
| Fail mode | **Closed** — if the ban store is unreachable, we do not match |
| Appeals | Available; reviewed by a different moderator where staffing allows |
| Honesty | A determined user can return under a new identity. We say so |

---

## 14. Retention of safety data

Full schedule: [RETENTION.md](RETENTION.md).

| Data | Retention |
| --- | --- |
| Chat content | **Not stored** |
| Media | **Not stored** |
| Session metadata | 30 days |
| Reports | 12 months |
| Moderation actions and audit | 24 months |
| Bans | 24 months, indefinite bans reviewed |
| Risk signals | 7 days rolling |

---

## 15. Safe defaults

Every default is chosen to be the safe option:

| Default | Value |
| --- | --- |
| Media mode | Off; text is preselected |
| Camera | Off until an explicit gesture |
| Microphone | Off until an explicit gesture |
| Interests | Off |
| Link opening | Inert until explicitly opened |
| Attachments | Do not exist |
| Age gate checkboxes | Unchecked |
| Consent checkboxes | Unchecked |
| Reporting | Always enabled; **no kill switch exists for it** |
| Session duration | Bounded |
| Ban check failure | Closed (do not match) |
| New session creation | Can be disabled by kill switch; reporting cannot |

---

## 16. Safety metrics

| Metric | Target | Alert |
| --- | --- | --- |
| Report rate per 1,000 sessions | Monitored, trending down | Statistical spike |
| P0 escalation acknowledgement | < 15 minutes | Page |
| Ban appeal overturn rate | < 5% | Review enforcement policy |
| Moderation disconnect rate | Monitored | Investigate if spiking |
| Reports accepted after peer disconnect | Monitored | Should be non-zero (proves FR-REPORT-002 works) |
| Time to restrict a reported identity | < 1 hour | Ticket |

---

## 17. What we will not build

Explicitly out of bounds, now and in future phases, without a new ADR and a legal review:

- Any feature that obscures or disables reporting.
- Any feature that lets a user avoid a ban.
- Any feature that lets a user conceal their identity from moderators in a way that
  prevents enforcement.
- Any "unmoderated mode".
- Any feature that disables block enforcement.
- Any mechanism to contact a stranger outside the platform.
- Any automated detection of illegal content without human review.

---

## 18. Review cadence

| Review | Frequency | Owner |
| --- | --- | --- |
| Safety policy review | Quarterly | Trust & Safety |
| Limitations statement review | Quarterly | Trust & Safety |
| Escalation policy review | Quarterly | Trust & Safety + Legal |
| Ban enforcement review | Monthly | Trust & Safety |
| Retention schedule review | Quarterly | Trust & Safety + Legal |
| Moderator wellbeing review | Monthly | Trust & Safety |
