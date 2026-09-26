# StrangerLink — Moderation

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-010](docs/adr/ADR-010-moderation-model.md), [SAFETY.md](SAFETY.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [docs/safety/REPORTING.md](docs/safety/REPORTING.md)

> **No moderation logic is implemented.** Ports exist in
> [src/server/moderation/](src/server/moderation/) and [src/features/moderation/](src/features/moderation/)
> and throw `Not implemented`. No automated content model exists or is planned for this
> phase (FR-MOD-006).

---

## 1. The moderation problem in this product

Moderation here is constrained in four ways that most products do not face:

1. **No chat history.** Messages are never stored (ADR-013 Tier 0). By the time a
   moderator sees a report, the conversation is gone.
2. **No accounts.** There is no identity to suspend — only a pseudonymous session
   identity.
3. **Real-time.** A human cannot read a message before the recipient sees it.
4. **Unbounded concurrency.** Any number of simultaneous sessions.

The consequence is a specific architectural conclusion:

> **Real-time prevention and immediate disconnection are the primary moderation tools.
> Retrospective human review is the secondary tool. Automated classification is not
> deployed in this phase.**

---

## 2. Moderation inputs

| Input | Source | Latency | Weight |
| --- | --- | --- | --- |
| **User report** | FR-REPORT-001 | Immediate — ends the session | High |
| **Report after disconnect** | FR-REPORT-002 | Immediate | High |
| **Block event** | FR-BLOCK-001 | Immediate — prevents rematch | Medium |
| **Structural signals** | Rate limits, session caps, cooldown triggers | Immediate | Medium |
| **Behavioural abuse signals** | Rapid requeue, repeat reports against one identity, report flooding, TURN overuse | Near-real-time | Medium |
| **Repeat reports** | Aggregated per identity | Batch | High |
| **Protocol violations** | Signaling impersonation, cross-session attempts, oversized frames | Immediate | High |
| **Admin review** | Manual triage | Human | Decisive |

### Behavioural signals in detail

| Signal | What it indicates | Action |
| --- | --- | --- |
| Rapid join/leave cycles | Queue abuse or trolling | Cooldown |
| Many reports against one identity | Harassment or spam | Review; possible restriction |
| Many reports **from** one identity against many peers | Report abuse or retaliation | Down-weight that identity's reports |
| Session duration consistently at the cap | Possible stalling or flooding | Review |
| TURN allocation overuse | Bandwidth abuse | Quota; review |
| Repeated protocol violations | Deliberate attack | Restrict |
| Immediate skip after every match | Automated or trolling behaviour | Cooldown; review |

---

## 3. Moderation decision points

```
┌─────────────────────────────────────────────────────────────┐
│ PREVENTION                                                  │
│  queue join ──► eligibility: ban, restriction, cooldown     │
│  candidate selection ──► blocks, recent peers, mode, bans   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ IN-SESSION (real time, structural only)                     │
│  message rate limit, duration cap, one-session invariant    │
│  connection and allocation caps                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ REACTION                                                    │
│  report ──► session ends, case created, severity assigned   │
│  block ──► session ends, rematch prevented                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ ENFORCEMENT                                                 │
│  warn ──► disconnect ──► restrict ──► ban                   │
│  checked at every entry point (ADR-012)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ ACCOUNTABILITY                                              │
│  immutable audit log, appeals, safety metrics               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Moderation outcomes

| Outcome | When | Effect | Duration |
| --- | --- | --- | --- |
| **Allow** | No violation found | Nothing | — |
| **Warn** | First minor violation | In-session warning with fixed copy | Session |
| **Disconnect** | Confirmed in-session violation | Session ended immediately | — |
| **Temporary restriction** | Repeat violation | Cannot join the queue | 24 h → 7 d |
| **Ban** | Severe or repeated violation | Cannot join, connect, or mint TURN credentials | Bounded, or indefinite with review |
| **Manual review** | Ambiguous, or any P0 | Held for senior review | Until resolved |

Every outcome requires a reason code from a fixed enumeration. Free-text reasons are not
permitted (FR-MOD-004).

---

## 5. What moderators can and cannot see

### Can see

| Data | Purpose |
| --- | --- |
| Report category | Triage |
| Report note (sanitised, length-bounded) | Context |
| Session metadata: mode, duration, timestamps, end reason | Pattern detection |
| Reporter and peer session identities | Linking reports, applying bans |
| Aggregated risk signals | Abuse detection |
| Report history for an identity | Repeat-offender detection |
| Audit trail | Accountability |

### Cannot see

| Data | Why |
| --- | --- |
| **Chat message content** | It does not exist (ADR-013 Tier 0) |
| **Media** | Never recorded (FR-MEDIA-008) |
| **Raw IP addresses** | Only for a documented investigation, with an audit record |
| **Another moderator's unreviewed case** | Assignment model prevents it |
| **Bulk exports of personal data** | Requires a documented, audited reason |

### Cannot do

| Action | Why |
| --- | --- |
| Act without a reason code | FR-MOD-004 |
| Act without an audit record | FR-SAFE-006 |
| Escalate their own privileges | NFR-SEC-008 |
| View chat content | It does not exist |
| Disable reporting | No such capability exists |

---

## 6. The admin surface

Planned, not built (see [docs/design/PAGES.md](docs/design/PAGES.md)).

| Route | Purpose |
| --- | --- |
| `/admin/moderation` | Case queue |
| `/admin/reports` | Report search and triage |
| `/admin/bans` | Ban management and appeals |
| `/admin/metrics` | Safety metrics |

| Property | Commitment |
| --- | --- |
| Authentication | Separate, strongly authenticated; individual accounts only, no shared logins |
| MFA | Required for any role with enforcement power |
| Roles | `moderator`, `senior-moderator`, `admin` |
| Authorization | Server-side on every request; never middleware alone (ADR-001) |
| Audit | Every action audited with actor, action, target, reason, timestamp, policy version |
| Appeals | Reviewed by a different moderator where staffing allows |

---

## 7. Moderation workflow

```
Report created
    │
    ▼
Severity assigned (category-driven)
    │
    ├── P0 ──► dedicated queue ──► page on-call ──► senior review ──► escalation
    │
    ├── P1 ──► standard queue ──► moderator review ──► outcome
    │
    └── P2 ──► standard queue ──► moderator review ──► outcome
                                              │
                                              ▼
                                    Audit event written
                                              │
                                              ▼
                                    Enforcement applied
                                              │
                                              ▼
                                    Metrics updated
```

### Case states

`open` → `triaged` → `actioned` | `insufficient` | `escalated` | `closed`

"Insufficient information" is a legitimate, expected outcome. It is a metric that feeds
the safety review — a rising rate means our reports are getting worse or our session
metadata window is too short.

---

## 8. What we do not automate

| Not automated | Why |
| --- | --- |
| Chat content classification | Requires reading all content — a privacy cost we will not pay; unacceptable false-positive rate |
| Automated bans without review | Proportionality (FR-SAFE-005); an appeal-overturn rate above 5% means we are over-banning |
| Automatic law-enforcement escalation | Requires legal judgement |
| Sentiment-based "toxicity" scoring on strangers | High false-positive rate on exactly the users we want to keep |
| Automated media scanning | No media is stored, so there is nothing to scan |

**If automation is ever added**, it requires: a new ADR, a privacy impact assessment, a
documented false-positive review process, and a human appeal path. This gate is not
negotiable.

---

## 9. Moderator wellbeing

This is an operational requirement, not a nicety.

| Measure | Commitment |
| --- | --- |
| Case volume per moderator per shift | Capped |
| Exposure to distressing content | Notes are sanitised and length-bounded; no media exists |
| Rotation | Moderators rotate off P0 queues |
| Escalation path | A moderator can escalate a case they cannot handle |
| Debrief | After P0 handling |
| Metrics tracked | Case volume, resolution time, P0 exposure |

---

## 10. Auditability

Every moderation action produces an `AuditEvent`:

```typescript
interface AuditEvent {
  id: string;
  actorId: string;            // AdminUser
  action: ModerationOutcome;  // allow | warn | disconnect | restrict | ban | manual-review
  targetType: 'session-identity' | 'session' | 'report';
  targetId: string;
  reasonCode: string;         // from a fixed enumeration
  before: object | null;      // minimal state delta
  after: object | null;
  policyVersion: number;      // the policy in force at the time
  createdAt: string;          // UTC
}
```

Properties:

- **Append-only.** Application roles have no `UPDATE` or `DELETE` grant.
- **Non-repudiable.** The actor is always recorded.
- **Policy-versioned.** We can reconstruct what the policy said when an action was taken.
- **Retained 24 months** (ADR-013 Tier 4).

---

## 11. Moderation metrics

| Metric | Why |
| --- | --- |
| Report rate per 1,000 sessions | Abuse prevalence |
| Report category distribution | What is actually happening |
| P0 count and acknowledgement latency | Escalation health |
| Ban rate | Enforcement intensity |
| Ban appeal rate and overturn rate | **Proportionality check** |
| "Insufficient information" close rate | Report quality or metadata window adequacy |
| Moderator case volume and resolution time | Capacity and wellbeing |
| Repeat-reporter concentration | Report abuse |

The appeal overturn rate is the most important one. A high rate means we are banning
innocent people.

---

## 12. Concurrency in moderation

| Hazard | Resolution |
| --- | --- |
| Two moderators action the same case | Case assignment; the second gets a definitive "already actioned" |
| Ban applied while the target is in an active session | Ban takes effect at the next entry point; the active session is ended by the disconnect outcome |
| Report arrives for a session that is ending | Report accepted (INV-8) |
| Restriction expires while a ban is being considered | Independent records; the stricter applies |
| Appeal overturns a ban that has already been enforced | The ban is revoked; the identity is un-restricted; both are audited |

---

## 13. Implementation status

Tracked in [TASKS.md](TASKS.md) as **T-MOD-041** (moderation case creation and triage
ports) and **T-MOD-042** (moderation action and audit). Neither is implemented.
