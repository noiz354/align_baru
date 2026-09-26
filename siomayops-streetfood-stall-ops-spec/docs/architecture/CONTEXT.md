# System Context

**Document ID:** DOC-ARCH-CONTEXT
**Status:** Phase 0 specification (design only; no component is implemented)
**Related:** `ARCHITECTURE.md` §2, `DOMAIN.md`, `HQ.md`, `OPERATORS.md`, `OFFLINE.md`

---

## 1. What the system is, in one paragraph

SiomayOps is the operational record of a Siomay stall network. It knows **who was selling, where,
with what stock, for how much money, and whether the money adds up** — on cheap Android phones, on
unreliable networks, for people who are busy serving customers. Everything else in the product exists
to make that sentence true and to keep it honest.

## 2. Actors and their actual jobs

| Actor | Where they are | What they need from the system | What the system must never do to them |
| --- | --- | --- | --- |
| **Operator (penjual)** | Street, one hand free, 40 seconds between customers | Start a shift, sell fast, record money that left the box, close the day honestly | Track them, judge them, shame them, or make an honest report risky |
| **Relief operator** | Covering another stall | Take over accountability cleanly, see what already happened | Make them liable for an unreconciled carry-over they did not create |
| **Area supervisor** | Motorbike, 8–15 stalls | Who is selling and where, what needs a decision, what to coach | Turn them into an auditor of their own team |
| **HQ Operations** | Desk, morning and evening rhythm | Coverage, incidents, assignments, escalations | Bury them in noise instead of exceptions |
| **HQ Finance** | Desk, evening | Verify digital payments, review expenses, check variance and settlement | Let unverified money look like revenue |
| **Menu/Pricing admin** | Desk | Publish menu availability and prices with effective dates and reasons | Rewrite history or lose the reason for a change |
| **Owner** | Weekly | Margin, coverage, people, and whether the discipline is real | Hide disagreement between the books and reality |
| **Auditor** | Periodic | Reconstruct a shift, a payment, a price change, an approval | Give them anything but read-only, scoped, exportable records |
| **Customer** | At the stall | Pay by cash or QRIS; optionally join loyalty | Require an app, an account or a phone number to buy food |
| **Platform admin** | Occasional | Flags, jobs, integrations, health | Grant business authority (they cannot approve money) |

## 3. External systems (and how much we depend on them)

| System | Purpose | Dependency discipline |
| --- | --- | --- |
| Payment provider (PJSP) for QRIS | Verify digital payments, settlement expectations | Behind `PaymentProvider` (ADR-0011); never in the offline path; never the source of a client-side success state |
| Object storage (S3 API) | Evidence photos, exports | Optional at write time: an expense saves without evidence and marks evidence pending |
| Notification channels (push, email, WhatsApp) | Convenience only | No money state depends on delivery (FR-NOTIF-007) |
| Map tile provider (optional) | Location pickers | Degrades to text address; never required to report a location |
| Managed PostgreSQL | System of record | Single region (ADR-0024); PITR backups |

## 4. Boundaries (what this system is not)

Not delivery logistics, not a customer marketplace or consumer app, not an accounting or payroll
system, not a chat product, not a surveillance system, not a fleet-maintenance system, and not a
scoring engine for people. See `PRD.md` §2.2 for the full non-goals list — they are enforced in review,
not just stated.

## 5. Context-level invariants

1. **Money is claim vs fact.** Cash is fact at the moment of counting; digital money is a claim until
   verified (ADR-0033, PAYMENTS.md).
2. **Location is a report, not a trace.** Only explicit, shift-bounded reports exist (ADR-0007).
3. **Field expenses are recorded neutrally** and never optimised, hidden or automated (ADR-0027).
4. **Recognition is multi-factor and reviewable**, never revenue-only and never hidden (ADR-0029).
5. **The record is the truth.** If the app says something happened, the server has a record of it;
   if the server has not accepted a record, the app says so plainly.

## 6. Why the context boundary is drawn here

Every external system we do not depend on is a failure mode we do not have. The pilot runs
cash-first and static-QRIS-second precisely so that the value of the product (an accountable day)
does not depend on a commercial integration, a message being delivered, or a map tile loading.
