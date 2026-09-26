# Field Expense Review

**Document ID:** DOC-FINANCE-EXPENSE-REVIEW
**Status:** Phase 0 specification (no review workflow is implemented; `reviewExpense` throws `Not implemented: T-EXP-002`)
**Related:** `EXPENSES.md`, `PRD.md` §9.2, ADR-0027, `docs/security/PERMISSIONS.md`, `SETTLEMENT.md`, `TASKS.md` (T-EXP-001..004)

---

## 1. The problem this workflow exists for

In the field, operators are sometimes asked to pay small amounts of money by people whose authority
can be verified by nobody in the app. Today that money is paid from the cash box or from the
operator's own pocket, and is at best mentioned verbally at closing. Three things can go wrong:
the cost disappears (books are wrong), the operator absorbs the cost (they are the lowest-paid person
in the chain and least able to refuse), or the payment is normalised by a system that makes it easier
to make (which is where a system can do real harm).

The workflow therefore does **exactly one thing well**: it records what the operator says happened,
in neutral terms, with an auditable review status — and it deliberately does nothing else.

## 2. Recording rules (binding)

| Rule | Detail |
| --- | --- |
| Neutral category | `UNVERIFIED_FIELD_EXPENSE` (or another auditable operational category: `TRANSPORT`, `CLEANING`, `CONSUMABLE`, `REPAIR_MINOR`, `PARKING`, `OTHER_OPERATIONAL`) — categories are configuration (ADR-0025) |
| Fields captured | description, amount (`Money`), time, shift/location context, `paidFrom` (CASH_BOX / PERSONAL), optional note, optional evidence photo, review status |
| Fields never requested | recipient identity, claimed authority, asserted purpose, an assessment of legality |
| No extra friction | the same 4-tap budget as any other expense; no mandatory explanation beyond a short description |
| No optimisation | no feature may make such a payment faster to approve, easier to hide, or cheaper to repeat (FR-EXPENSE-012) |
| Cash arithmetic | `CASH_BOX` expenses are cash-box outflows and appear in expected cash; `PERSONAL` expenses enter the payable review queue (FR-EXPENSE-009) |
| Offline | recorded offline with a client id, synced idempotently (FR-EXPENSE-010) |
| Retention | evidence is short-lived and deleted on schedule (`RETENTION.md` R-06/R-12) |

## 3. Review states

```text
SUBMITTED ──scheduled/rule-based──▶ REVIEW_REQUIRED ──human decision──▶ REVIEWED
    │                                     │                                │
    │                                     └──────────▶ ESCALATED ─────────┘
    └──────────(operator corrects)──────────────────▶ SUBMITTED (new record)
                                          REJECTED ──▶ visible forever, with reason
```

| State | Meaning | Who sets it | Required input |
| --- | --- | --- | --- |
| `SUBMITTED` | Recorded by the operator; awaiting normal processing | Operator | category, description, amount |
| `REVIEW_REQUIRED` | Selected for human review by a documented rule (pattern, amount, evidence missing) | System (rule), never a person | rule id |
| `REVIEWED` | A human examined it and accepts the record as recorded | HQ Finance (or supervisor within threshold) | reason + reviewer |
| `REJECTED` | A human rejects reimbursement or classification, with a reason | HQ Finance | reason (mandatory) |
| `ESCALATED` | Routed to a named human role because the pattern needs judgement | HQ Finance | reason + assignee |

Rules: transitions are monotonic and audited; `REJECTED` never deletes the record (it stays visible to
the operator and in the shift's history); no state is reachable automatically from a flag; escalation
always lands on a human with an SLA.

## 4. Pattern flags (about records, never about people)

| Pattern (configurable, versioned) | What it observes | Why it exists | Guardrail |
| --- | --- | --- | --- |
| Frequency | Same category on ≥N days within a window | Cost concentration may indicate a real recurring demand | Wording names the records, never a person; no monetary deduction |
| Amount clustering | Repeated identical amounts | Detects both coercion patterns and copy-paste errors | Human reads context (market days, parking tariffs) before concluding |
| Time clustering | Multiple entries within a short window | Catch double entry | Merged with duplicate detection |
| Location clustering | Entries at one selling point across operators | Understand a location problem (e.g. an access demand) | Discussed as a **location** issue with HQ Ops |
| Evidence absence | Repeat entries without evidence where evidence is expected | Data quality | Not treated as concealment |
| Weekend/holiday skew | Patterns that appear only with certain market days | Context, not suspicion | Recorded for interpretation |
| Sudden change | Operator's expense profile changes sharply | Could indicate a new real cost | Compared against the area's own baseline |

Flag output is a **queue item with a rule id and the matching records**. Flags never: name a person in
a queue title, deduct money, change operator status, or trigger a message to the operator. Any
escalation is a human decision with a reason (FR-EXPENSE-006/007).

## 5. Reviewer guidance (to be included in the HQ training material)

1. Read the operator's own note first; it is the only first-hand account available.
2. Ask: does this look like a **location problem** (recurring access demand), a **process problem**
   (missing receipt policy), or a **record-keeping problem**? All three have fixes that are not the
   operator's fault.
3. Never ask the operator to name an individual or an organisation. Trust that if they wanted to say,
   they already wrote it in the note.
4. Where a category is repeatedly abused at a location, escalate to HQ Ops for a location status
   review — not to a disciplinary process.
5. Approve for reimbursement on the record as submitted unless there is evidence of duplication;
   rejections require a reason the operator can read and understand.
6. Never discuss an individual's expense history in a group channel.

## 6. Certification and period close

An operator may **certify** that a period's expenses are complete and correct (FR-EXPENSE-008). The
certification is a statement with a timestamp and audit row — it is not a score and it changes no
money. Period close for expenses happens with the daily closing roll-up (`T-CLOSE-004`), and unreviewed
items remain visible as open items rather than blocking the close.

## 7. Reporting

| Report | Content | Audience |
| --- | --- | --- |
| Daily expense ledger | Entries by area/category with review state | HQ Finance, Owner |
| Reimbursement queue | `PERSONAL` expenses awaiting decision, with age | HQ Finance |
| Pattern queue | Flagged records with rule ids and context | HQ Finance |
| Location context report | Repeated categories clustered by selling point | HQ Ops (to review the location, not the person) |
| Category drift | Shares by category over time, per area | Owner, Finance |

## 8. Metrics

Median review latency, share reviewed within SLA, share of `UNKNOWN`/`OTHER_OPERATIONAL` categories,
duplicate-catch rate, and reimbursement turnaround. **Not** metrics: "flagged operators per area",
"expenses per operator", or any figure whose only effect is pressure on the person reporting.

## 9. Test and QA anchors

`tests/unit/expense-review.test.ts` (neutral model, monotonic transitions, reason requirements,
no automatic consequence) plus QA scenarios QA-E-01..QA-E-08 in `QA.md`.
