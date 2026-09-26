# ADR-013 — Retention Policy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + Trust & Safety + Legal
- **Related:** [ADR-002](ADR-002-database.md), [ADR-011](ADR-011-reporting-model.md), [ADR-014](ADR-014-anonymity-model.md)

## Context

The default engineering instinct is to keep everything. For this product, that instinct
is actively harmful.

Every byte we retain is a byte that can be leaked, subpoenaed, or misused. Random
conversations between strangers are exactly the kind of data nobody wants held about
them. And the product's promise — "no public profile, no persistent identity" — is
undermined the moment we quietly keep a durable record of who talked to whom, forever.

But we cannot retain nothing. Safety records are the reason we can act on abuse at all.

So retention is a deliberate, per-data-class decision, and the default is **the shortest
period that still lets us do the safety job**.

Full schedule: [RETENTION.md](../RETENTION.md).

## Problem

How long is each class of data retained, and how is retention enforced and verified?

## Decision Drivers

1. **Harm minimisation.** Retaining random conversations indefinitely is a harm in
   itself.
2. **Safety utility.** Reports, bans, and audit must survive long enough to be useful.
3. **Legal obligation.** Some records may need to be preserved for a defined period.
4. **Enforceability.** A policy nobody implements is not a policy.
5. **Verifiability.** We must be able to prove we deleted what we said we would.

## Options Considered

### Option A — Retain everything indefinitely

**Strengths:** Maximum future utility.

**Weaknesses:** Unacceptable privacy harm, unbounded liability, and directly contradicts
the product's anonymity promise. **Rejected outright.**

### Option B — Retain nothing beyond the session

**Strengths:** Maximum privacy.

**Weaknesses:** We could not enforce bans, detect repeat offenders, or respond to legal
process. Also fails FR-MOD-004/005 auditability. **Rejected.**

### Option C — Tiered retention by data class, with the shortest workable period per
class, enforced by a scheduled job that alerts on failure

### Option D — Tiered retention with automatic deletion driven by the database (TTL
indexes / native expiry)

**Strengths:** Enforced by the datastore.

**Weaknesses:** PostgreSQL has no native row TTL; this would require either a
background job (which is Option C) or a different datastore. Rejected as a *mechanism*;
the *policy* is Option C.

## Decision

**Adopt Option C: tiered retention by data class, enforced by a scheduled,
failure-alerting job.**

### The tiers

| Tier | Data class | Retention | Rationale |
| --- | --- | --- | --- |
| **0 — Never stored** | Chat message content, media, SDP bodies, ICE candidates | 0 | Ephemeral by design; storing them is the single largest privacy risk in this product |
| **1 — Session only** | Live queue entries, connection registries | Process lifetime | Dies with the process |
| **2 — Short** | Session metadata (who met whom, mode, duration) | 30 days | Enough to resolve a late report and investigate a pattern; not a durable social graph |
| **3 — Medium** | Reports, moderation actions, safety events | 12 months | Needed for repeat-offender detection and appeals |
| **4 — Long** | Ban records, moderation audit log | 24 months, with mandatory review for indefinite bans | Enforcement integrity and non-repudiation |
| **5 — Aggregate only** | Telemetry and metrics | 13 months | Operational trend analysis; contains no identities |
| **6 — Separate** | IP-derived risk signals | 7 days rolling | Only as long as needed for rate limiting and evasion detection |

### Enforcement

- A single scheduled job deletes expired rows per tier. It is idempotent, logged, and
  **alerts on failure**.
- A failed retention run is treated as a **privacy incident**, not a background error.
  See [RUNBOOK.md](../RUNBOOK.md).
- Deletion is verified: a scheduled test asserts that a session-metadata row older than
  the Tier 2 window does not exist.

### Deletion on request

- A user can request deletion of safety records concerning them. Bans and audit records
  may be legally required to persist; where they are, the request is honoured to the
  extent the law allows and the decision is recorded.
- Because there are no accounts, a deletion request references a session identity, which
  means we can only act on requests the user can substantiate.

## Consequences

**Positive**

- We retain the minimum needed for safety and nothing more.
- The product's anonymity promise is backed by an enforceable schedule, not a policy
  statement.
- A leak of our database exposes 30 days of session metadata, not a decade of
  conversations.

**Negative**

- Late reports become harder to investigate after the Tier 2 window closes.
- Repeat-offender detection is bounded by the Tier 3 window.
- The retention job is a critical piece of infrastructure that must never silently fail.
- Some jurisdictions may require longer retention than our tiers allow; this is a legal
  question, not an engineering one.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Retention job silently fails → data kept forever | High | Medium |
| A future feature quietly adds a durable content column | High | Medium |
| Retention window too short to investigate a serious case | Medium | Medium |
| Retention window too long → privacy harm | High | Low |
| Deletion is requested but cannot be honoured | Medium | Medium |

## Mitigations

- **MR-1:** Retention job alerts on failure and has a runbook entry. A missed run pages
  the on-call.
- **MR-2:** ADR-002 MR-3: a test asserts no message-content column exists in the schema.
  Adding one requires a new ADR.
- **MR-3:** Tier 2 (30 days) was chosen to cover the bounded post-session reporting
  window in ADR-011 plus investigation time. If a serious case arrives after the window,
  it is handled with the information available and the limitation is recorded.
- **MR-4:** The retention schedule is reviewed on a fixed cadence by Trust & Safety and
  Legal together; shortening is always available, lengthening requires justification.
- **MR-5:** Deletion requests are logged with the decision and its legal basis.

## Revisit Conditions

- A jurisdiction mandates a longer or shorter retention period for a specific class.
- Report volume or severity patterns show that 30 days of session metadata is
  insufficient for investigation → consider extending Tier 2 with a documented
  justification, or improving report capture instead.
- We add media → Tier 0 becomes impossible to maintain honestly and this ADR must be
  rewritten.
- We add persistent identity → the entire retention model changes.

## References

- [RETENTION.md](../RETENTION.md)
- [PRIVACY.md](../PRIVACY.md)
- [ADR-002](ADR-002-database.md)
- [ADR-011](ADR-011-reporting-model.md)
- [ADR-014](ADR-014-anonymity-model.md)
- [RUNBOOK.md](../RUNBOOK.md)
