# ADR-010 — Moderation Model

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + Trust & Safety
- **Related:** [ADR-011](ADR-011-reporting-model.md), [ADR-012](ADR-012-ban-enforcement.md), [ADR-013](ADR-013-retention-policy.md)

## Context

StrangerLink's safety promise rests on moderation. But moderation in an anonymous,
ephemeral, real-time product is fundamentally constrained:

- **There is no chat history.** Messages are deliberately not persisted
  ([RETENTION.md](../RETENTION.md)). By the time a moderator sees a report, the
  conversation is gone.
- **There are no accounts.** There is no identity to suspend, only a pseudonymous
  session identity and whatever risk signals we hold.
- **It is real-time.** A moderator cannot intervene inside a live session at human
  speed.
- **Scale is unbounded.** Any number of concurrent sessions, any hour of the day.

This means the honest model is: **real-time prevention and immediate disconnection are
the primary tools; retrospective human review is the secondary tool; automated
classification is not deployed in this phase.**

We also must not let moderation become a privacy violation. A moderation system with
access to everything is a surveillance system.

## Problem

What is the moderation architecture — what are the inputs, the decision points, the
outcomes, and the limits?

## Decision Drivers

1. **Honesty.** The product must not claim moderation it does not have (NFR-SAFE-003).
2. **Effectiveness.** Abusers must face consequences.
3. **Privacy.** Moderators must see the minimum necessary.
4. **Auditability.** Every action must be attributable and non-repudiable (FR-MOD-005).
5. **Operability.** A small team must be able to run the queue.
6. **Proportionality.** Enforcement must scale with severity (FR-SAFE-005).

## Options Considered

### Option A — Human moderation only, retrospective

Reports create cases; moderators review and act.

**Strengths:** Simple, auditable, no model risk.

**Weaknesses:** Nothing stops abuse *during* a session. Moderators cannot see the
conversation. Retrospective only.

### Option B — Automated classification of chat in real time

A model inspects messages and disconnects on violation.

**Strengths:** Real-time enforcement.

**Weaknesses:** Requires reading all chat content — a profound privacy cost and a
surveillance risk. High false-positive rate on the very users we most want to keep.
Requires a model we do not have and cannot validate in this phase. **Not adopted in this
phase.**

### Option C — Layered: real-time structural controls + retrospective human review

Structural controls (rate limits, session caps, cooldowns, immediate disconnect on
report, block enforcement) do the real-time work. Human moderators handle reports
retrospectively. Automated classification is a *planned* enhancement with explicit
preconditions.

### Option D — Community moderation / peer juries

**Strengths:** Scales.

**Weaknesses:** Exposes reports to other users, creates retaliation risk, and puts
strangers in judgement of each other's private conversations. **Rejected.**

## Decision

**Adopt Option C: layered moderation with structural real-time controls and
retrospective human review. No automated content model in this phase.**

### Inputs

| Input | Source | Latency |
| --- | --- | --- |
| User report | FR-REPORT-001 | Immediate (ends session) |
| Report after disconnect | FR-REPORT-002 | Immediate |
| Block event | FR-BLOCK-001 | Immediate (prevents rematch) |
| Structural signals | Rate limits, session caps, cooldown triggers | Immediate |
| Behavioral signals | Rapid requeue, repeat reports against one identity, report flooding | Near-real-time |
| Repeat reports | Aggregated per identity | Batch |
| Admin review | Manual triage | Human |

### Decision points

| Point | What happens |
| --- | --- |
| **Prevention (queue join)** | Eligibility check: ban, restriction, cooldown, active-session invariant |
| **Prevention (candidate selection)** | Block relationship, recent-peer window, mode compatibility |
| **In-session (real time)** | Structural limits: message rate, session duration, connection caps |
| **On report** | Session ends immediately; case created; severity assigned |
| **Post-session (batch)** | Aggregate analysis: repeat reporters, repeat offenders, evasion patterns |

### Outcomes

| Outcome | When used | Duration |
| --- | --- | --- |
| **Allow** | No violation found | — |
| **Warn** | First minor violation | Session |
| **Disconnect** | Confirmed in-session violation | Immediate |
| **Temporary restriction** | Repeat violations | Bounded (see [SAFETY.md](../SAFETY.md)) |
| **Ban** | Severe or repeated | Bounded or indefinite per [SAFETY.md](../SAFETY.md) |
| **Manual review** | Ambiguous, or P0 escalation | Until reviewed |

### What moderators can see

| Data | Visible to moderator |
| --- | --- |
| Report category and note | Yes |
| Session metadata (mode, duration, timestamps) | Yes |
| Reporter/peer session identities | Yes |
| **Chat message content** | **No — it does not exist** |
| **Media** | **No — never recorded** |
| IP addresses | Only where a specific safety investigation requires it, with audit |
| Risk signals | Yes, aggregated |

### What moderators cannot do

- See chat content (it is not stored).
- See media (it is not recorded).
- Act without an audit record.
- Escalate their own privileges.
- See a report's contents before it is assigned to them.

### Auditability

Every moderation action records: actor, action, target identity, reason code, timestamp,
case reference, and the policy version in force. The audit log is append-only and is
retained per [RETENTION.md](../RETENTION.md).

## Consequences

**Positive**

- No model risk, no training data problem, no false-positive ban of innocent users.
- Moderators see the minimum necessary — moderation cannot silently become surveillance.
- Every action is auditable.
- Structural controls work at machine speed, which is the only speed that matters for
  real-time abuse.

**Negative**

- We cannot stop a determined abuser *mid-sentence*. The best we can do is end the
  session on report and restrict them afterwards.
- Moderators cannot reconstruct what was said, so some reports will be unresolvable.
- Repeat offenders can re-enter unless detection catches them (ADR-012).

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Moderation becomes a privacy violation | High | Medium |
| Abuse during a session that is never reported | High | High |
| A moderator acts without an audit trail | High | Low |
| Privilege escalation in the admin surface | Critical | Low |
| Automation is added later without privacy review | High | Medium |
| Moderator burnout from unresolvable reports | Medium | High |

## Mitigations

- **MR-1:** The admin surface enforces that an action cannot be committed without a
  reason code; the audit write is part of the same transaction.
- **MR-2:** Admin access is separate, strongly authenticated, and role-scoped; a test
  asserts that a non-admin cannot reach any admin route.
- **MR-3:** Any future automated classification requires a new ADR, a privacy impact
  assessment, and a documented false-positive review process before deployment.
- **MR-4:** Unresolvable reports are closed with an explicit "insufficient information"
  reason, which is itself a metric that feeds the safety review.
- **MR-5:** Moderator wellbeing is an operational concern: case volume, resolution time,
  and exposure to distressing content are tracked ([OPERATIONS.md](../OPERATIONS.md)).

## Revisit Conditions

- Report volume exceeds human triage capacity → prioritise structural controls first,
  then consider automation with the MR-3 gate.
- A region's regulatory regime requires real-time detection of specific content classes →
  revisit Option B with a privacy impact assessment.
- We add media → moderation surface expands dramatically and this ADR must be rewritten.
- A false-positive-driven user harm incident occurs → review proportionality (FR-SAFE-005).

## References

- [MODERATION.md](../MODERATION.md)
- [ADR-011](ADR-011-reporting-model.md)
- [ADR-012](ADR-012-ban-enforcement.md)
- [ADR-013](ADR-013-retention-policy.md)
- [SAFETY.md](../SAFETY.md)
- [TASKS.md](../TASKS.md) — T-MOD-041, T-MOD-042
