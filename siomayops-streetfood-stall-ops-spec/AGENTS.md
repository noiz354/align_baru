# AGENTS

**Document ID:** DOC-AGENTS
**Status:** Phase 0
**Purpose:** Define how future human and AI contributors work in this repository.

---

## 1. Workflow gates (mandatory order)

```text
TASK
 ↓
REQUIREMENT        (which FR-/NFR- IDs does this satisfy?)
 ↓
PRODUCT SPEC       (the domain doc: product behaviour, wording, edge cases)
 ↓
DESIGN             (screens/flows, tap budget, states, accessibility)
 ↓
ADR                (if the decision is expensive to reverse)
 ↓
SECURITY / FINANCE / PRIVACY review (explicit checklists below)
 ↓
CODE
 ↓
TEST
 ↓
MANUAL QA
```

**No step may be skipped.** In particular: no code before the ADR exists for
money/identity/offline decisions; no merge before tests and QA scenarios exist.

---

## 2. Before writing any code, an agent must examine

| Dimension | Questions to answer explicitly |
| --- | --- |
| **Financial correctness** | Does this create, move, or report money? Is the arithmetic integer-only? Is history preserved? |
| **Money precision** | Any division, percentage, rounding, or allocation? Is the rounding policy documented and tested at boundaries? |
| **Idempotency** | Can this request be replayed by a retry or an offline sync? What is the key? What happens on a duplicate? |
| **Offline behaviour** | What happens with no connectivity? Is the record queued? Is the UI truthful? Can this be done offline at all? |
| **Race conditions** | Two devices? Two reviewers? Retry + concurrent write? What resolves the conflict, and is it visible to a human? |
| **Auditability** | What audit event is emitted? Does it contain actor, before/after, and a reason where required? |
| **Operator usability** | Tap count, typing, one-handed use, sunlight, gloves, jargon-free wording? |
| **Privacy** | What personal data is touched? Is it minimised? Is it inside the shift-bound location rule? Is consent involved? |

Any "we'll handle it later" on these eight is a review blocker.

---

## 3. Code rules

1. **Skeleton discipline.** Until a task is scheduled, its functions throw
   `new Error("Not implemented: T-XXX-XXX")`. Never return fabricated data, never log success.
2. **Layering.** `domain` imports nothing; `features` depend on ports; adapters live in `server`.
3. **Money.** `Money` value object only. A `number` used for money is a defect.
4. **Time.** `occurredAt` (UTC) + server-derived `businessDay`. Never trust device business day.
5. **Validation.** Zod at every boundary. No `any` in contracts.
6. **No silent behaviour.** No auto-retry in the UI that hides failure; no swallowed errors.
7. **No surveillance features.** Any code touching position outside an explicit operator action
   will be rejected (ADR-0007).
8. **No facilitation features.** Any suggestion of whom to pay, how much to pay, or how to
   classify a payment to hide it will be rejected (PRD §9, ADR-0027).
9. **Naming.** Domain language from `DOMAIN.md`; statuses as string unions; no booleans for state.
10. **Tests accompany behaviour.** A PR without tests for a money path is incomplete.

---

## 4. Review checklist (reviewer must be able to tick all)

- [ ] Requirements IDs cited in the PR description.
- [ ] ADR referenced for any of: money, identity, authz, offline, payments, retention, scoring.
- [ ] Money: integer only; rounding documented; boundaries tested.
- [ ] Idempotency: key defined; duplicate behaviour tested.
- [ ] Offline: behaviour defined and tested (or an explicit "not offline" with reasoning).
- [ ] Concurrency: conflict path defined and visible to a human.
- [ ] Audit: event emitted; reason where required.
- [ ] Privacy: data minimisation respected; no PII in logs; location rules respected.
- [ ] UX: tap budget respected; wording checked against `DESIGN.md` §7; no jargon.
- [ ] Tests: unit + integration/browser + a QA scenario, or a justified reason.
- [ ] Docs updated: product doc, `API.md` if the contract changed, `docs/TRACEABILITY.md` rows.
- [ ] No new dependency without an ADR amendment and a maintenance/licence check.

---

## 5. Definition of Done (feature level)

1. Requirement IDs mapped in `docs/TRACEABILITY.md`.
2. Domain invariants proven by database constraints **and** use-case tests.
3. Offline path implemented and tested (or explicitly out of scope with a decision recorded).
4. Idempotency verified by replay tests.
5. Authorization verified from an out-of-scope actor.
6. Audit events present with reasons where required.
7. QA scenarios in `QA.md` executed (field scenarios where applicable).
8. Documentation updated (product doc, API contract, glossary if vocabulary changed).
9. No TODO placeholder left except entries intentionally registered in `TASKS.md`.

---

## 6. What an agent must refuse to do

| Refusal | Reason |
| --- | --- |
| Implement a payment gateway/QRIS integration without a completed ADR + provider contract review | Money + legal |
| Add continuous location tracking for any reason | Privacy/ethics (ADR-0007) |
| Add a feature that suggests, automates, or hides informal payments | PRD §9 |
| Add revenue-only leaderboards or hidden scoring | Fairness (ADR-0029) |
| Implement "temporary" auth bypass, debug endpoints in production, or seeded admin accounts | Security |
| Modify an Accepted ADR in place | Process (supersede instead) |
| Delete financial records to satisfy a request | Integrity (detach identifiers instead) |

---

## 7. Escalation paths

| Situation | Escalate to |
| --- | --- |
| Requirement ambiguity | Product Architect (update PRD, don't guess) |
| Money/rounding doubt | Fintech Architect + ADR |
| Privacy question (UU PDP) | DPO/Privacy owner + `PRIVACY.md` update |
| Provider/legal terms | Business owner + `docs/payments/*` review |
| Suspected field coercion pattern | Human process per `RUNBOOK.md` — never an automated response |
| Security incident | `SECURITY.md` §8 + `RUNBOOK.md` |


## Worktree page-spec authority (mandatory)

For all page and end-to-end product work in this worktree, the checked-in archive `siomayops_end_to_end_pages.zip` and its extracted canonical prompts in `docs/product/end-to-end-pages/` are mandatory and authoritative. Read the index first, then execute exactly one page prompt at a time in its listed order; do not start a later page until the current one meets its acceptance criteria and evidence requirements. Follow each prompt in full across UI, backend, persistence, authorization, analytics/observability, tests, CI, and runtime evidence. Do not omit, weaken, reorder, or substitute requirements from the archive. Apply the global cross-cutting gate after all page prompts. If a prompt conflicts with another project document, stop and report the exact conflict rather than silently deviating; preserve applicable safety, privacy, security, and financial integrity rules. These instructions are specific to this worktree and supersede generic phase/status statements only to the extent needed to execute the archive prompts.
