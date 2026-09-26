# ADR-011 — Reporting Model

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + Trust & Safety
- **Related:** [ADR-007](ADR-007-session-model.md), [ADR-010](ADR-010-moderation-model.md), [ADR-012](ADR-012-ban-enforcement.md)

## Context

Reporting is the single most important safety feature in the product. If reporting does
not work, nothing else matters — there is no other channel through which a user can tell
us that something went wrong.

Three properties make reporting hard in this specific product:

1. **The peer may vanish instantly.** An abuser's most effective move is to disconnect
   the moment they are reported — or before. Reporting must survive that.
2. **There is no account.** We cannot ask "who are you?" We can only reference a session.
3. **Reporting is itself abusable.** False reports, retaliatory reports, and report
   flooding are all real attack patterns.

Full specification: [docs/safety/REPORTING.md](../safety/REPORTING.md).

## Problem

What is the reporting model — what is captured, when it is accepted, and how is it
protected from abuse?

## Decision Drivers

1. **Always reachable.** Report must be one action from anywhere in a session
   (FR-REPORT-001, G-3).
2. **Survives disconnect.** A report must be accepted after the peer has left
   (FR-REPORT-002).
3. **Data minimisation.** Collect the minimum necessary; never a name, email, or phone
   (FR-REPORT-005).
4. **Abuse resistance.** Report flooding and retaliation must be detectable.
5. **Immediacy.** A report ends the session — the user should not have to keep talking to
   the person they are reporting.
6. **No information leakage.** The reporter gets acknowledgement, never confidential
   moderation reasoning (FR-REPORT-009).

## Options Considered

### Option A — In-session report, session ends on submit

A report sheet opens without ending the session; submitting ends it.

### Option B — Post-session report only

The user reports after the session has ended.

**Weaknesses:** Fails FR-REPORT-002 in the other direction — the user must remember to
come back, and the friction means most reports never happen. Also, a user who was
traumatised will not hunt for a report button after the fact. **Rejected as the primary
path**; retained as a secondary path for a bounded window after session end.

### Option C — Report requires an account

**Weaknesses:** Requires accounts (NG-4), which is a hard non-goal. **Rejected outright.**

### Option D — Silent / background reporting (no confirmation, no session end)

**Strengths:** Lower friction.

**Weaknesses:** The user does not get out of the session. In a product where the whole
point is that you can leave instantly, a report that does not end the session is a trap.
**Rejected.**

## Decision

**Adopt Option A, with Option B retained as a bounded secondary path.**

### What a report captures

| Field | Required | Notes |
| --- | --- | --- |
| `sessionId` | Yes | References a session that may already be terminal (INV-8) |
| `reporterSessionIdentityId` | Yes | Pseudonymous; no account |
| `peerSessionIdentityId` | Yes | The reported party |
| `category` | Yes | Fixed enumerated set (see below) |
| `createdAt` | Yes | UTC |
| `note` | No | Optional free text, length-bounded, treated as user content |
| `moderationMetadata` | Derived | Severity, priority, risk signals, dedup key |

**Explicitly not collected:** name, email, phone number, precise location, contacts,
device fingerprint, or any account identifier.

### Categories

| Category | Priority |
| --- | --- |
| Harassment | P1 |
| Sexual content | P1 |
| **Minor safety** | **P0** |
| Threats | P0 |
| Hate | P1 |
| Spam | P2 |
| Scam | P1 |
| **Illegal content** | **P0** |
| Other | P2 |

P0 categories bypass normal triage entirely and follow the escalation policy in
[SAFETY.md](../SAFETY.md). They are not queued behind P2 spam reports.

### Behaviour

1. The report control is visible in every active session state, including `CONNECTING`.
2. Opening the report sheet **does not** end the session.
3. Submitting **does** end the session, immediately, and the peer is not told that they
   were reported.
4. The reporter receives an acknowledgement: "Thanks — we've received your report." No
   moderation reasoning, no outcome, no timeline (FR-REPORT-009).
5. The reporter is then offered a new match or a clean exit.
6. Reports are accepted for a bounded window after a session ends (secondary path).

### Abuse resistance

| Threat | Control |
| --- | --- |
| Report flooding | Per-identity report rate limit (FR-REPORT-007, FR-ABUSE-008) |
| Retaliatory reports | Reports are weighted; a pattern of reports against many distinct peers from one identity reduces that identity's report credibility |
| Duplicate reports | Dedup on (session, category) (FR-REPORT-006) |
| Reports used to harass a moderator | Notes are length-bounded and sanitised; moderators are not exposed to raw unbounded text without a render boundary |

### Why the peer is not told

Telling a reported user that they were reported is a moderation-bypass signal: it teaches
them exactly which behaviour was caught and when. It also enables retaliation. The peer
sees only a session end.

## Consequences

**Positive**

- Reporting is always one action away and never requires identity.
- A report survives the peer vanishing (INV-8).
- P0 categories are structurally separated from routine triage.
- The reporter is never given information that could weaken enforcement.

**Negative**

- Reports are frequently unresolvable, because the conversation is gone.
- We hold a small amount of free-text report data that is itself user content and needs
  retention rules (ADR-013).
- Not telling the peer why they were disconnected generates support friction — accepted.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Report submitted while session ends → lost | Critical | Low |
| Report flooding by a single identity | Medium | Medium |
| Retaliatory reporting campaign against an innocent user | High | Medium |
| P0 report queued behind routine reports | Critical | Low |
| Report note contains PII the reporter did not intend to share | Medium | Medium |
| Reporter expects an outcome and is frustrated | Low | High |

## Mitigations

- **MR-1:** Report acceptance is independent of session status. A test asserts a report
  is accepted against a session in `ENDED` (FR-REPORT-002).
- **MR-2:** Report rate limits plus a credibility weighting signal; repeated reports
  against many distinct peers are flagged for review rather than silently actioned.
- **MR-3:** P0 categories are routed to a separate, always-monitored queue with an alert
  if unacknowledged beyond a threshold ([RUNBOOK.md](../RUNBOOK.md)).
- **MR-4:** The report note is length-bounded, sanitised on input, and rendered safely
  on output; the UI warns that the note should not contain personal information.
- **MR-5:** The acknowledgement copy is honest: it confirms receipt and does not promise
  an outcome. See [docs/safety/REPORTING.md](../safety/REPORTING.md).

## Revisit Conditions

- We add media → reports need a media-evidence story, which is a major privacy decision
  requiring a new ADR.
- Report volume makes human triage infeasible → revisit ADR-010's automation gate.
- A jurisdiction mandates a specific reporting or escalation workflow → the category set
  and escalation policy are updated, and this ADR is revisited.
- Users consistently report that the report flow is hard to find → the UI is the problem,
  not the model; fix DESIGN.md and re-verify.

## References

- [docs/safety/REPORTING.md](../safety/REPORTING.md)
- [MODERATION.md](../MODERATION.md)
- [ADR-007](ADR-007-session-model.md)
- [ADR-010](ADR-010-moderation-model.md)
- [ADR-012](ADR-012-ban-enforcement.md)
- [RETENTION.md](../RETENTION.md)
- [TASKS.md](../TASKS.md) — T-REPORT-006
