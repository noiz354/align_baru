# StrangerLink — Reporting

- **Status:** Architecture phase — **critical safety document**
- **Last updated:** 2026-09-26
- **Related:** [ADR-011](../adr/ADR-011-reporting-model.md), [SAFETY.md](../../SAFETY.md), [MODERATION.md](../../MODERATION.md)

---

## 0. Position

**Reporting is the most important feature in this product.** If reporting does not work,
nothing else we have built matters — there is no other channel through which a user can
tell us that something went wrong.

Three properties are non-negotiable:

1. **Always reachable.** One action from any active session state.
2. **Survives disconnect.** A report is accepted even after the peer has vanished.
3. **Never disabled.** There is no kill switch, no maintenance mode, and no configuration
   key that can turn reporting off.

---

## 1. Report categories

| Category | Severity | Priority | Description |
| --- | --- | --- | --- |
| **Minor safety** | Severe | **P0** | Any indication that a participant is a minor, or any content sexualising a minor |
| **Illegal content** | Severe | **P0** | Content that may be illegal in any relevant jurisdiction |
| **Threats** | Severe | **P0** | Threats of violence, self-harm, or harm to others |
| **Harassment** | Major | P1 | Repeated unwanted contact, insults, slurs, targeted abuse |
| **Sexual content** | Major | P1 | Non-consensual nudity, exposure, or sexual solicitation |
| **Scam** | Major | P1 | Fraudulent solicitation, phishing, impersonation for gain |
| **Hate** | Major | P1 | Attacks based on protected characteristics |
| **Spam** | Minor | P2 | Advertising, unsolicited bulk messaging |
| **Other** | Minor | P2 | Anything not covered above |

**P0 categories bypass the normal triage queue entirely.** They are routed to a dedicated,
always-monitored queue and page the on-call (FR-SAFE-008).

---

## 2. What a report captures

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `sessionId` | Yes | uuid | References a session that may already be terminal (INV-8) |
| `reporterIdentityId` | Yes | uuid | Pseudonymous session identity |
| `peerIdentityId` | Yes | uuid | The reported party's session identity |
| `category` | Yes | enum | From §1 |
| `createdAt` | Yes | timestamptz | UTC |
| `note` | No | text | ≤ 1000 characters, sanitised |
| `dedupKey` | Derived | text | `(sessionId, category)` — unique |
| `severity` | Derived | enum | From the category |
| `status` | Derived | enum | `open` initially |

### What a report does **not** capture

| Not captured | Why |
| --- | --- |
| Name | No accounts exist (NFR-PRIV-001) |
| Email | Same |
| Phone number | Same |
| Location | Data minimisation |
| Device fingerprint | Deliberately excluded |
| Account identifier | No accounts |
| Chat transcript | Not stored (ADR-013 Tier 0) |
| Media | Never recorded (FR-MEDIA-008) |

**The report note is the only free-text field, and the UI explicitly warns the user not to
include personal information about themselves or others.**

---

## 3. Report flow

```
Session (any non-terminal state)
    │
    ▼
[Report]  ← one action, always visible
    │
    ▼
Report sheet opens ──── session CONTINUES ────┐
    │                                          │
    ▼                                          │
Select category (required)                     │
    │                                          │
    ▼                                          │
Optional note (≤ 1000 chars)                   │
    │                                          │
    ▼                                          │
[Submit report] ──── Cancel ───────────────────┘
    │
    ▼
Report recorded (accepted even if the session has ended)
    │
    ▼
Session ENDS
    │
    ▼
"Thanks — we've received your report. Our moderation team reviews every report."
    │
    ▼
[Find someone new]  /  [Leave]
```

---

## 4. Behavioural guarantees

| Guarantee | Detail |
| --- | --- |
| **One action to open** | The Report control is visible in every active session state |
| **Opening does not end the session** | The user can change their mind |
| **Submitting ends the session** | The user should not have to keep talking to the person they reported |
| **Two taps to submit** | From session to submitted report |
| **Survives peer disconnect** | FR-REPORT-002 — accepted against a terminal session |
| **Works from `CONNECTING`** | Not only from `ACTIVE` |
| **Bounded post-session window** | A report may also be submitted for a bounded period after a session ends |
| **Never requires identity** | No name, email, phone, or account |
| **No outcome disclosed** | The reporter is never told the moderation result, reasoning, or timeline |
| **Peer is not told** | The reported user sees only a session end |

---

## 5. Abuse resistance

| Threat | Control |
| --- | --- |
| **Report flooding** | 5 reports per hour per identity (FR-REPORT-007) |
| **Duplicate reports** | Unique on `(sessionId, category)`; a duplicate returns the existing report (FR-REPORT-006) |
| **Retaliatory reports** | Credibility weighting: an identity reporting many distinct peers has its reports down-weighted and is flagged for review, rather than each report being actioned (FR-ABUSE-008) |
| **Reports as a harassment vector** | Notes are length-bounded and sanitised; moderators render them safely |
| **Reports used to mass-restrict innocents** | Reports are **never** auto-actioned into a ban; a human decides |

**A report is a signal, not a verdict.** This is why the appeal overturn rate is a tracked
metric.

---

## 6. Escalation

| Severity | Routing | Response |
| --- | --- | --- |
| **P0** | Dedicated always-monitored queue; on-call paged | Immediate |
| **P1** | Standard triage queue | Same business day |
| **P2** | Standard triage queue | Best effort |

P0 handling follows [SAFETY.md](../../SAFETY.md) §8. Illegal content is escalated through
legal counsel; the on-call engineer does not contact law enforcement directly.

---

## 7. Moderator view

| Visible | Not visible |
| --- | --- |
| Category | Chat content (does not exist) |
| Note (sanitised) | Media (never recorded) |
| Session metadata: mode, duration, timestamps, end reason | Reporter personal data (none collected) |
| Reporter and peer session identities | Raw IP (only for a documented investigation, audited) |
| Report history for the peer identity | Anything beyond the minimum necessary |

---

## 8. What the reporter sees

| Sees | Never sees |
| --- | --- |
| "Thanks — we've received your report." | Whether action was taken |
| An offer to find someone new or leave | What the moderation outcome was |
| An option to report a moderation decision as a mistake | Which rule was triggered |
| | What signal detected it |
| | Whether a human or a system acted |
| | A timeline |

**The asymmetry is deliberate.** Telling a reported user why they were caught teaches them
how to avoid being caught, and enables retaliation (NFR-SAFE-002).

---

## 9. Edge cases

| Edge case | Behaviour |
| --- | --- |
| EC-05 report submitted while the session is ending | Accepted; ordering is irrelevant (INV-8) |
| EC-20 report for a session that already ended | Accepted within the bounded post-session window |
| Peer disconnects before the report is submitted | Accepted; the peer identity is still known from the session |
| Report submitted for a session the caller was not in | Rejected with `FORBIDDEN` |
| Duplicate category for the same session | Collapsed; the existing report id is returned |
| Report from a banned identity | **Accepted** — a banned user must still be able to report |
| Report rate limit exceeded | `RATE_LIMITED` with `retryAfterMs`; the user is told honestly |
| Note contains personal information | Accepted but warned against; the UI hint is the mitigation |
| Two reports from the same session with different categories | Both recorded; both triaged |

---

## 10. Report copy

All reporter-facing copy is fixed:

| Moment | Copy |
| --- | --- |
| Sheet title | "Report this person" |
| Category prompt | "What happened?" |
| Note hint | "Please don't include personal information about yourself or others." |
| Submit | "Submit report" |
| Confirmation | "Thanks — we've received your report. Our moderation team reviews every report." |
| Rate limited | "You've submitted several reports recently. Please wait before reporting again." |

---

## 11. Implementation status

The report contract exists in [src/shared/contracts/](../../src/shared/contracts/) and
[src/domain/reports/](../../src/domain/reports/). `submitReport()` throws
`Not implemented: T-REPORT-006`. Tracked in [TASKS.md](../../TASKS.md).
