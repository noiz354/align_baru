# PRD — SiomayOps

**Document ID:** DOC-PRD
**Version:** 0.1 (Phase 0 — design baseline)
**Status:** Specification only. Nothing in this document is implemented.
**Owner:** Product (with Fintech, Ops, Privacy review)
**Companions:** `DESIGN.md`, `ARCHITECTURE.md`, `docs/adr/`, `DOMAIN.md`, `docs/TRACEABILITY.md`

---

## 1. Purpose

SiomayOps is the operating system of a Siomay street-food stall network. It exists so that a network of
independent-feeling stalls can be run with the discipline of a chain without turning its operators into
surveilled piece-workers.

The product must make five things true:

1. **The day can be closed.** Every shift ends with numbers that balance or with an honest explanation
   of why they do not.
2. **The field works offline.** A dropped connection never stops a sale.
3. **Money is never imagined.** No digital payment is recorded as received until it is verified.
4. **People are treated fairly.** Location comes from explicit operator reports with optional one-shot
   fixes, never background tracking; variance is investigated, not accused; recognition is multi-factor
   and reviewable, never revenue-only.
5. **HQ can see the network.** Coverage, margin, stock, incidents and settlement status, with freshness
   shown rather than assumed.

## 2. Goals, non-goals, and hard boundaries

### 2.1 Goals (with the pilot's success measures in §14)

| Goal | Why |
| --- | --- |
| Digitally record the whole operator day: shift start → location report → sales → expenses → stock count → closing | The paper/WhatsApp status quo loses money and makes coaching impossible |
| Make cash accountability exact and explainable | Cash is ~most of the pilot's volume; reconciliation is the core pain |
| Accept digital payments honestly (QRIS first, static before dynamic) | Customers expect QRIS, but unverified "success" would be fraud-enabling |
| Work on cheap Android phones with poor connectivity | The field reality; anything else is a fiction |
| Give HQ a trustworthy operational picture with explicit freshness | Decisions are currently taken on stale WhatsApp snapshots |
| Record field expenses neutrally and review patterns by humans | Operators currently absorb irregular costs personally |
| Recognise good operators fairly across unequal locations | Retention depends on it; a raw leaderboard would punish quiet locations |

### 2.2 Non-goals (explicit)

- Not a delivery/logistics platform: no routing, no dispatch, no courier tracking.
- Not a customer marketplace or consumer app in this phase.
- Not an accounting system: no general ledger, no journals, no tax filing.
- Not a payroll or HR system.
- Not a chat product: operational messaging is anchored to records, not a general chat app.
- Not a surveillance system: no continuous location, no camera feeds, no productivity keystroke/telemetry.
- Not a fleet-maintenance system beyond incident recording.
- No scoring, ranking or automated judgement of people as an implemented algorithm in this phase.

### 2.3 Hard boundaries (fail these and the product is rejected regardless of features)

| Boundary | Statement |
| --- | --- |
| Payment honesty | The system must never present or store an unverified digital payment as received. `PAID` requires verified server-side evidence or an explicit, evidenced HQ Finance reconciliation. |
| Offline honesty | The offline queue must never carry a transition to `PAID` for a digital payment. |
| Money precision | Money is integer minor units. No floating-point value may participate in a money calculation, comparison, or storage. |
| Historical integrity | Recorded prices, totals, closings and audit entries are immutable; corrections create new records. |
| Location privacy | Location is captured only as an explicit operator action during an active shift; no background or continuous collection. |
| Expense neutrality | Field expenses are recorded by neutral category with no required assumption about the recipient's identity or authority, and no automation that approves, hides, facilitates or optimises irregular payments. |
| Non-accusation | The system never labels an operator a thief, never auto-penalises a variance, and always offers `UNKNOWN` as a variance reason. |
| Recognition fairness | Recognition inputs are multi-factor and normalised for location traffic, shift length, day/weather/closures/stock availability; weights are documented; a human reviews before an award; results are appealable. |
| Data minimisation | No collection beyond the purposes in `PRIVACY.md`; retention per `RETENTION.md`. |

## 3. Personas and jobs to be done

| Persona | Context | Jobs to be done | Product implications |
| --- | --- | --- | --- |
| **Operator (Penjual)** — "Bu Rina", 41, Android Go phone, shared stall | Sells 06:00–15:00 at a fixed spot, poor signal at 20% of locations | Start shift fast, report where I am, record sales without slowing down, note money I had to pay out, count stock, close the day and hand over cash | ≤4 taps for a common sale, offline-first, legible numbers, no jargon, no typing when avoidable |
| **Relief operator** — "Mas Dedi" | Works across stalls, sometimes covers an unplanned spot | Take over an active shift, understand what has been sold so far, keep the cash box truthful | Explicit handover with dual confirmation and a carry-over snapshot |
| **Area Supervisor** — "Pak Yudi" | 8–15 stalls, motorbike, phone in one hand | See who is selling and where, resolve incidents, coach on variance, approve within limits, cover absences | Mobile-first supervisor view; approvals with SLA; no spreadsheet |
| **HQ Ops** — "Sari" | Desk, morning and evening rhythm | Know coverage vs plan, catch problems before the evening call, follow up incidents, ensure closings arrive | Dashboard with freshness badges, alert inbox, drill-downs to records |
| **HQ Finance** — "Bram" | Desk, evening reconciliation | Verify digital payments, review field expenses, check variances and settlements, sign off daily closings | Verification queue with evidence, pattern flags, immutable audit trail, exports |
| **Menu/Pricing admin** — "Tuti" | Desk | Publish menu availability and prices per area/location, run promotions with effective dates | Versioned pricing with reason and approval; no retroactive edits |
| **Owner** | Weekly review | Margin, coverage, people, and whether the discipline is real | Aggregates, trends, exceptions, and the ability to see the audit trail |
| **Auditor (internal/external)** | Periodic | Reconstruct a shift, a payment, a price change, an approval | Read-only, scoped, exportable audit |
| **Customer** | At the stall | Pay by cash or QRIS; optionally join loyalty | QRIS works; loyalty is optional, consented and never required to buy |

## 4. Operating context and assumptions

| # | Assumption | If false |
| --- | --- | --- |
| A-1 | Most pilot volume is cash | Digital-first prioritisation would change slice order, not the honesty rules |
| A-2 | Operators have Android phones with a modern browser and a data plan, sometimes 2G/3G-grade | A USSD/SMS fallback would be a separate product decision |
| A-3 | Signal is intermittent but not absent for a whole day | Multi-day offline would raise queue-size and conflict policy |
| A-4 | Stall-level POS hardware is not available | Hardware integration is out of scope |
| A-5 | HQ staff are desktop-first; supervisors are mobile-first | Supervisor flows are designed mobile-first regardless |
| A-6 | One organisation (tenant) in the pilot | Multi-tenancy is still structurally enforced (ADR-0031) |
| A-7 | Provider/QRIS onboarding is a commercial process we do not control | Static QR + manual verification (ADR-0012) keeps the pilot unblocked |
| A-8 | Locations' official permission status is not knowable by the product | The product records only operational status, never a legal assertion |
| A-9 | Closings are reviewed by a human the same evening in the pilot | Automated sign-off would require a policy decision, not a code one |
| A-10 | Operators are paid by a separate process | Payroll remains out of scope |

## 5. Scope

### 5.1 MVP (pilot: one area, 5–20 stalls, 2–4 weeks, cash-first + static QRIS)

Operator identity and assignment · stall registry · selling locations with windows and operator
reports · shifts with handover · configurable menu and per-location availability · location-aware
pricing with snapshots · sales with cash and static QRIS · payment verification queue · field
expenses with neutral categories · stock issues, counts, waste and variance reasons · daily closing
and cash count · HQ dashboard (coverage, sales, cash position, verification backlog, variance,
incidents, expense review) · audit trail · offline day with sync · in-app alerts.

### 5.2 Post-pilot, before scale-out

Dynamic QRIS with verified callbacks · loyalty programme (consented) · operator recognition
(Phase 15) · multi-area rollout · restock workflow · settlements matching · expense certification ·
supervisor approvals for price overrides beyond limits · richer read models.

### 5.3 Out of scope (this phase or permanently)

See §2.2, plus: continuous GPS, live maps as a monitoring product, hardware integrations, customer
app, marketplace ordering, payroll, general ledger, machine-learning scoring of people, chat, and
any automation of payments that could be construed as facilitating irregular demands.

## 6. Domain at a glance

**Aggregates:** Organization · Region · Area · Stall · SellingLocation · Operator · OperatorAssignment ·
Shift (+ Handover) · MenuItem / MenuAvailability / StockItem · PricePolicy · Sale · Payment (+
PaymentAttempt, PaymentEvidence, Reconciliation) · Expense (+ review) · StockMovement / StockCount ·
LoyaltyAccount / RewardInstance · Incident · Alert / Notification · OperatorPerformanceSnapshot ·
DailyClosing · AuditEvent.

Money and time rules: `Money` = integer minor units + currency (IDR minor unit = 1 rupiah); business
day derived in Asia/Jakarta with a configurable 04:00 cut (ADR-0033); `UUIDv7` identifiers plus
human-readable business codes (ADR-0032).

Full language in `DOMAIN.md` and `GLOSSARY.md`; storage verdicts in `DATA_MODEL.md`; lifecycles in
`STATE_MACHINE.md`; events in `EVENTS.md`.

## 7. Functional requirements

Conventions: **Priority** P0 = required for the pilot, P1 = required before scale-out, P2 = later.
**Slice** refers to `ROADMAP.md`. Every requirement is traceable in `docs/TRACEABILITY.md`.
"Shall" statements are written to be testable.

### 7.1 Operator identity, assignment and status — `FR-OPERATOR`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-OPERATOR-001 | The system shall maintain one operator profile per person with full name, phone number, optional photo, join date, home area, status and capability flags. | P0 | VS-2 |
| FR-OPERATOR-002 | The system shall authenticate operators by phone number plus a one-time code in the implemented authentication slice, and shall not allow password-less self-registration without a supervisor or HQ invitation. | P1 | VS-17 |
| FR-OPERATOR-003 | The system shall restrict an operator's access to their own records within their assigned area and to stalls they are assigned to; cross-operator records shall be denied and the denial audited. | P0 | VS-1 |
| FR-OPERATOR-004 | The system shall support assignment types PRIMARY, RELIEF, TEMPORARY and TRAINEE_ACCOMPANIED with an explicit validity window. | P0 | VS-2 |
| FR-OPERATOR-005 | The system shall prevent two operators from holding a PRIMARY assignment for the same stall at overlapping times and shall surface the conflict at assignment time. | P0 | VS-2 |
| FR-OPERATOR-006 | The system shall support an operator status lifecycle (INVITED, ACTIVE, SUSPENDED, INACTIVE, OFFBOARDED) with reasons and audit. | P0 | VS-2 |
| FR-OPERATOR-007 | The system shall keep an operator's capability flags (e.g. may take cash, may operate a stall alone, may apply an allowed price override, may train) configurable by HQ with audit. | P1 | VS-2 |
| FR-OPERATOR-008 | The system shall record operator contact and identity data as personal data with purpose limitation, field-level access control and retention per `RETENTION.md`. | P0 | VS-1 |
| FR-OPERATOR-009 | The system shall never require or collect continuous location, keystroke telemetry, screen time or biometric data for operators. | P0 | VS-3 |
| FR-OPERATOR-010 | The system shall allow an operator to view their own shift history, sales, variance records and recognition results, and to raise a dispute on any record about them. | P1 | VS-15 |
| FR-OPERATOR-011 | The system shall support supervisor-assisted credential recovery that is audited and cannot be performed by an operator for themselves. | P1 | VS-17 |
| FR-OPERATOR-012 | The system shall allow offboarding to anonymise the operator's personal identifiers while preserving the financial and audit records that reference them. | P1 | VS-17 |

### 7.2 Stall registry — `FR-STALL`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-STALL-001 | The system shall maintain a stall registry with a configurable stall type (cart, push cart, motorbike setup, kiosk, temporary stand), apparatus inventory note, and operational status. | P0 | VS-2 |
| FR-STALL-002 | The system shall support stall statuses ACTIVE, MAINTENANCE, RETIRED and IN_TRANSIT with reasons and audit. | P0 | VS-2 |
| FR-STALL-003 | The system shall allow a stall to be associated with an area and a default selling location, without assuming that a stall always sells at one place. | P0 | VS-2 |
| FR-STALL-004 | The system shall record stall-level notes (equipment quirks, repair history pointers, capacity) visible to the assigned operator and supervisor. | P1 | VS-2 |
| FR-STALL-005 | The system shall prevent a shift from starting on a stall in MAINTENANCE, RETIRED or IN_TRANSIT status unless a supervisor override with reason is recorded. | P0 | VS-3 |
| FR-STALL-006 | The system shall count stalls by status per area for HQ coverage reporting. | P1 | VS-12 |
| FR-STALL-007 | The system shall not hard-code stall types, apparatus categories or equipment lists in code; all are configuration data (ADR-0025). | P0 | VS-2 |
| FR-STALL-008 | The system shall record an incident-linked maintenance flag when an incident reports equipment failure, so HQ can see repeat offenders by stall. | P1 | VS-13 |

### 7.3 Selling locations and location reporting — `FR-LOCATION`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-LOCATION-001 | The system shall model locations hierarchically: region → area → selling point, with each selling point having a name, address text, landmark, and optional coordinates. | P0 | VS-2 |
| FR-LOCATION-002 | The system shall define selling windows per selling point (allowed days and hours) as planning metadata that does not block a sale, only informs. | P1 | VS-2 |
| FR-LOCATION-003 | The system shall record an operational status per selling point: AVAILABLE, ACTIVE, CROWDED, TEMPORARILY_UNAVAILABLE, RESTRICTED, INACTIVE. | P0 | VS-2 |
| FR-LOCATION-004 | The system shall capture location only through explicit operator reports during an active shift (arrive, confirm unchanged, move, depart, temporarily step away) with reason for moves. | P0 | VS-3 |
| FR-LOCATION-005 | The system shall never collect location in the background, on a timer, or outside an active shift (ADR-0007). | P0 | VS-3 |
| FR-LOCATION-006 | The system shall allow an operator to propose a new selling point during a shift; the proposal is PENDING_VERIFICATION and usable immediately for that shift only, pending HQ review. | P1 | VS-3 |
| FR-LOCATION-007 | The system shall record location history with operator, stall, location, arrivedAt, departedAt, reportedBy and reasonForMove. | P0 | VS-3 |
| FR-LOCATION-008 | The system shall allow a location to be marked RESTRICTED or TEMPORARILY_UNAVAILABLE by HQ or a supervisor with reason and optional expiry, and shall warn (not block) an operator reporting a sale at such a place. | P1 | VS-3 |
| FR-LOCATION-009 | The system shall not infer, store or display any location's legal permission status unless HQ Finance/Ops explicitly verified it, and shall label such a record with who verified it and when. | P0 | VS-2 |
| FR-LOCATION-010 | The system shall surface unreported location states to HQ (shift active without a location report) as an alert, not as a suspicion of wrongdoing. | P0 | VS-12 |
| FR-LOCATION-011 | The system shall support multiple named selling windows per selling point (e.g. morning market, evening road) for planning and reporting. | P2 | VS-12 |
| FR-LOCATION-012 | The system shall retain location reports per `RETENTION.md` and automatically purge coordinate detail beyond the retention window while keeping aggregated coverage. | P1 | VS-17 |
| FR-LOCATION-013 | The system shall allow HQ to merge or split selling points with an audit trail, preserving historical references. | P2 | VS-12 |
| FR-LOCATION-014 | The system shall display a location's recent history (who sold there, when, with what outcome) to authorised roles only, and never to customers. | P1 | VS-12 |
| FR-SITE-001 | During an active operator shift, the system shall allow a manual current-site observation of ground wet/dry state, shelter availability/notes, and an optional relocation decision note; the note does not move the shift or selling point. | P1 | Page 12 / T-SITE-001 |
| FR-SITE-002 | The operator site-condition page shall show server-derived location/shift context, bounded same-site observations, and only source-labelled traffic/sales data that the current read model supports; missing weather data shall be shown as unavailable, never fabricated. | P1 | Page 12 / T-SITE-001 |
| FR-SITE-003 | Any site-condition cue shall be deterministic, explainable, based only on a fresh persisted operator observation until an approved weather provider exists, and non-binding; it shall not claim a forecast or automatically relocate an operator. | P1 | Page 12 / T-SITE-001 |

### 7.4 Shifts and handover — `FR-SHIFT`, `FR-HANDOVER`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-SHIFT-001 | The system shall require an explicit start-shift action that captures stall, opening cash count, planned location and operator. | P0 | VS-3 |
| FR-SHIFT-002 | The system shall reject a second active shift for the same stall unless a handover is performed or a supervisor override with reason is recorded. | P0 | VS-3 |
| FR-SHIFT-003 | The system shall allow a shift to start while offline, with a client-generated identifier, and shall reconcile it on sync without duplicating it. | P0 | VS-3 |
| FR-SHIFT-004 | The system shall compute and store expected cash continuously as opening cash + cash sales − cash expenses (excluding overrides, which are itemised). | P0 | VS-9 |
| FR-SHIFT-005 | The system shall allow an operator to suspend and resume a shift with a reason, keeping accountability contiguous. | P1 | VS-3 |
| FR-SHIFT-006 | The system shall prevent sales on a closed or suspended shift and shall return a clear, user-facing error. | P0 | VS-5 |
| FR-SHIFT-007 | The system shall record the shift's business day at start using the configured cut rule (ADR-0033), and shall not change it later. | P0 | VS-3 |
| FR-SHIFT-008 | The system shall support an end-shift sequence: stock count, cash count, expense recap, location departure, closing submission. | P0 | VS-9 |
| FR-SHIFT-009 | The system shall allow a closing to be submitted offline and remain editable until the server accepts it (`PENDING_SYNC`), never silently. | P0 | VS-9 |
| FR-SHIFT-010 | The system shall handover a live shift with dual confirmation (outgoing and incoming operator), capturing carry-over cash, unsold stock snapshot, unpaid-verification list and open issues. | P1 | VS-10 |
| FR-SHIFT-011 | The system shall record who is accountable for the cash box at any moment of a shift, including through handovers. | P0 | VS-10 |
| FR-SHIFT-012 | The system shall alert supervisors when a shift is active for more than the configured maximum duration. | P1 | VS-12 |
| FR-SHIFT-013 | The system shall record shift-level metadata for later normalisation (duration, day of week, weather band if reported, closures if reported) without requiring operators to enter weather data. | P1 | VS-15 |
| FR-SHIFT-014 | The system shall not allow an operator to delete a shift, a sale, an expense or a closing record; corrections are new audited records. | P0 | VS-5 |
| FR-SHIFT-015 | The system shall allow a supervisor to approve a shift closure submitted with a variance beyond tolerance after review, and shall record the decision and reason. | P0 | VS-9 |
| FR-SHIFT-016 | The system shall display the operator's own shift summary with planned vs reported location, sales count, expected cash and outstanding items. | P0 | VS-9 |
| FR-HANDOVER-001 | The system shall require both operators to confirm a handover before accountability transfers. | P1 | VS-10 |
| FR-HANDOVER-002 | The system shall snapshot carry-over values at handover (cash counted, unsold stock noted, pending digital verifications, open incidents) and keep the snapshot immutable. | P1 | VS-10 |
| FR-HANDOVER-003 | The system shall attribute sales before the handover to the outgoing operator and after it to the incoming operator, using server-accepted handover time. | P1 | VS-10 |
| FR-HANDOVER-004 | The system shall flag a handover with an unreconciled carry-over cash difference for supervisor review, without blocking the handover. | P1 | VS-10 |
| FR-HANDOVER-005 | The system shall record handover outcomes (completed, cancelled, disputed) with reasons and audit. | P1 | VS-10 |

### 7.5 Menu and availability — `FR-MENU`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-MENU-001 | The system shall treat menu items, variants, packages and components as configuration data (ADR-0025); no item names or categories may be hard-coded. | P0 | VS-4 |
| FR-MENU-002 | The system shall allow a menu item to be a sellable item, a component, or a package including other items. | P0 | VS-4 |
| FR-MENU-003 | The system shall support per-location availability windows (day of week, time of day, date ranges) as configuration. | P1 | VS-4 |
| FR-MENU-004 | The system shall support marking an item sold-out at a location or for a shift, with reason and audit, without deleting the item. | P0 | VS-4 |
| FR-MENU-005 | The system shall render only server-provided catalog content in the client and shall show an explicit empty state when the catalog is unavailable instead of a fallback list. | P0 | VS-4 |
| FR-MENU-006 | The system shall warn (not block) when an operator records a sale for an item that is marked unavailable at that location, and shall record the exception. | P1 | VS-5 |
| FR-MENU-007 | The system shall keep retired items in history so past sales remain interpretable, and shall never repurpose the identity of a retired item. | P0 | VS-4 |

### 7.6 Pricing — `FR-PRICE`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-PRICE-001 | The system shall maintain a price hierarchy HQ Base → Area → Location → Temporary Override, resolving deterministically with the most specific active scope winning (ADR-0008). | P0 | VS-4 |
| FR-PRICE-002 | The system shall record every price change with old price, new price, effective date, scope, reason, created-by and approver. | P0 | VS-4 |
| FR-PRICE-003 | The system shall never rewrite history: a price change affects only sales accepted after its effective time. | P0 | VS-4 |
| FR-PRICE-004 | The system shall store a price snapshot on every sale line (unit price, currency, policy reference) and derive totals only from snapshots. | P0 | VS-5 |
| FR-PRICE-005 | The system shall reject, loudly, an ambiguous price resolution (two active policies equally specific) rather than choosing silently. | P0 | VS-4 |
| FR-PRICE-006 | The system shall treat the absence of an active price for an item at a location as "not sellable" and shall never default to zero or to another location's price. | P0 | VS-4 |
| FR-PRICE-007 | The system shall allow an organisation to configure the operator price-override mode: HQ_ONLY, SUPERVISOR_APPROVED or OPERATOR_ALLOWED (ADR-0009). | P1 | VS-4 |
| FR-PRICE-008 | The system shall bound OPERATOR_ALLOWED overrides by amount/percentage limits and controlled reason codes, auto-expiring at shift end or after 24 hours, whichever is sooner. | P1 | VS-4 |
| FR-PRICE-009 | The system shall record every override with base price, override price, reason, authoriser, expiry and the sale it applies to. | P1 | VS-4 |
| FR-PRICE-010 | The system shall display, at the point of sale, the resolved price and (when applicable) that an override is active, without requiring the operator to recall the base price. | P0 | VS-5 |
| FR-PRICE-011 | The system shall support time-boxed promotional prices with an explicit campaign reference and automatic expiry. | P2 | VS-11 |
| FR-PRICE-012 | The system shall produce a price-change report (who changed what, when, why, approver) for HQ and Auditor roles. | P1 | VS-12 |

### 7.7 Sales — `FR-SALE`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-SALE-001 | The system shall record a sale with stall, shift, operator, location report, lines (item, quantity, unit price snapshot), total, payment method, and timestamps. | P0 | VS-5 |
| FR-SALE-002 | The system shall complete the common 1-item cash sale in four taps or fewer from the operator home screen. | P0 | VS-5 |
| FR-SALE-003 | The system shall support an offline sale with a client-generated identifier and a device timestamp recorded as metadata. | P0 | VS-5 |
| FR-SALE-004 | The system shall make a completed sale immutable: corrections are audited voids or corrective records that reference the original. | P0 | VS-5 |
| FR-SALE-005 | The system shall require a reason for any void and shall record who voided it and when. | P0 | VS-5 |
| FR-SALE-006 | The system shall set a sale's unit price from the server-resolved snapshot at acceptance and never recalculate it later. | P0 | VS-5 |
| FR-SALE-007 | The system shall support cash received and change given as integer minor units with a one-tap "exact amount" shortcut. | P0 | VS-5 |
| FR-SALE-008 | The system shall attach an optional customer reference (loyalty account, when enabled and consented) without requiring it. | P1 | VS-11 |
| FR-SALE-009 | The system shall support a sale with mixed payment methods only where the split is explicit and each part is recorded as its own payment record. | P2 | VS-6 |
| FR-SALE-010 | The system shall support a discount as an explicit, reasoned field with an approval trail where the discount exceeds configured bounds. | P1 | VS-5 |
| FR-SALE-011 | The system shall detect and reject duplicate submissions of the same sale (same idempotency key or client identifier) and return the original record. | P0 | VS-5 |
| FR-SALE-012 | The system shall display a completed sale confirmation that clearly states payment state ("Tunai — selesai", "QRIS — menunggu verifikasi"). | P0 | VS-5 |

### 7.8 Payments — `FR-PAYMENT`, cash handling — `FR-CASH`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-PAYMENT-001 | The system shall treat cash as a first-class payment method that works fully offline. | P0 | VS-5 |
| FR-PAYMENT-002 | The system shall support digital payment methods through a provider adapter boundary (`PaymentProvider`), keeping provider specifics out of domain code (ADR-0011). | P0 | VS-6 |
| FR-PAYMENT-003 | The system shall support payment states PENDING, AUTHORIZED, PAID, FAILED, EXPIRED, CANCELLED, REFUNDED plus the settlement-facing PENDING_VERIFICATION state for operator-reported static QRIS. | P0 | VS-6 |
| FR-PAYMENT-004 | The system shall never set a digital payment to PAID on the basis of a client-side signal, a customer screenshot or a browser "success" redirect. | P0 | VS-6 |
| FR-PAYMENT-005 | The system shall require verified server-side evidence (provider callback verified against signature/reference, verified status query, or an explicit HQ Finance reconciliation record) before a digital payment becomes PAID. | P0 | VS-6 |
| FR-PAYMENT-006 | The system shall display the honest wording "Menunggu verifikasi" for any digital payment that is recorded but not verified. | P0 | VS-6 |
| FR-PAYMENT-007 | The system shall prevent the offline queue from carrying any transition of a digital payment to PAID (ADR-0033). | P0 | VS-6 |
| FR-PAYMENT-008 | The system shall require connectivity to create a digital payment attempt, and shall fail clearly rather than queue it when offline. | P0 | VS-6 |
| FR-PAYMENT-009 | The system shall support a manual reconciliation record (role, reason, evidence note, timestamp) as a verifiable path for static QRIS with the merchant's own confirmation. | P0 | VS-6 |
| FR-PAYMENT-010 | The system shall keep unverified and verified digital amounts separate in every report, and shall never merge them into a single "digital revenue" figure. | P0 | VS-6 |
| FR-PAYMENT-011 | The system shall store provider references, raw callback payloads (minimised, short-lived) and reconciliation evidence with an audit trail. | P1 | VS-6 |
| FR-PAYMENT-012 | The system shall reject a provider callback whose reference does not match a known payment attempt, and shall record the rejection for investigation. | P0 | VS-6 |
| FR-PAYMENT-013 | The system shall support retrying a failed payment attempt as a new attempt, preserving the failed attempt in history. | P1 | VS-6 |
| FR-PAYMENT-014 | The system shall never mark a payment as refunded without an explicit refund record referencing the provider or a documented manual refund. | P1 | VS-6 |
| FR-PAYMENT-015 | The system shall expire unverified digital payments after a configured window and raise an alert to HQ Finance when a shift closes with unresolved verifications. | P0 | VS-6 |
| FR-PAYMENT-016 | The system shall record the amount, currency and payment method on the payment record as integer minor units, and shall reconcile the payment total against the sale total as a check, not an assumption. | P0 | VS-6 |
| FR-CASH-001 | The system shall record cash sales with cash received and change given as integer minor units. | P0 | VS-5 |
| FR-CASH-002 | The system shall support "uang pas" (exact amount) as a one-tap default. | P0 | VS-5 |
| FR-CASH-003 | The system shall maintain a running expected cash figure for the shift and display it to the operator on demand. | P0 | VS-9 |
| FR-CASH-004 | The system shall require a counted cash value and a reason when |expected − counted| exceeds the configured tolerance. | P0 | VS-9 |
| FR-CASH-005 | The system shall record cash handovers and cash removals (safe drop, supervisor collection) as explicit, reasoned, audited events. | P1 | VS-10 |
| FR-CASH-006 | The system shall never adjust expected cash automatically to match a counted amount. | P0 | VS-9 |

### 7.9 Daily closing and settlement — `FR-SETTLE`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-SETTLE-001 | The system shall produce a shift closing summary: sales by method, cash expenses, expected cash, counted cash, variance, stock variance, unresolved verifications, open incidents. | P0 | VS-9 |
| FR-SETTLE-002 | The system shall treat an accepted closing as immutable; later corrections create an adjustment record referencing it. | P0 | VS-9 |
| FR-SETTLE-003 | The system shall aggregate accepted closings per business day and area for HQ review and sign-off. | P0 | VS-9 |
| FR-SETTLE-004 | The system shall require a supervisor or Finance review decision (accepted, accepted with note, returned for correction) on closings with variance beyond tolerance. | P0 | VS-9 |
| FR-SETTLE-005 | The system shall record settlement expectations from the payment provider (fees, expected bank credit) as a review artefact, without performing accounting. | P1 | VS-6 |
| FR-SETTLE-006 | The system shall record settlement matching outcomes (matched, short, over, missing, disputed) with evidence notes and audit. | P1 | VS-6 |
| FR-SETTLE-007 | The system shall never compute tax, tax filings or payroll from closing data. | P0 | VS-9 |
| FR-SETTLE-008 | The system shall raise an alert when a business day's closings are incomplete after the configured cut-off time. | P0 | VS-12 |
| FR-SETTLE-009 | The system shall expose an export of the day's closings for finance review with clear verification status per payment. | P1 | VS-12 |
| FR-SETTLE-010 | The system shall prevent an operator from submitting two closings for the same shift and shall return the existing closing record with a replay indicator. | P0 | VS-9 |

### 7.10 Operational and field expenses — `FR-EXPENSE`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-EXPENSE-001 | The system shall allow an operator to record an expense with category, description, amount, time and location context in four taps, including optional photo evidence. | P0 | VS-7 |
| FR-EXPENSE-002 | The system shall provide neutral default categories (e.g. UNVERIFIED_FIELD_EXPENSE, TRANSPORT, CLEANING, CONSUMABLE, REPAIR_MINOR, PARKING, OTHER_OPERATIONAL) as configuration, not code. | P0 | VS-7 |
| FR-EXPENSE-003 | The system shall record UNVERIFIED_FIELD_EXPENSE without requiring recipient identity, claimed authority or an asserted purpose beyond the operator's own note. | P0 | VS-7 |
| FR-EXPENSE-004 | The system shall never rank, score, shame or automatically penalise an operator for recording such expenses. | P0 | VS-7 |
| FR-EXPENSE-005 | The system shall implement expense review states SUBMITTED, REVIEW_REQUIRED, REVIEWED, REJECTED, ESCALATED with reasons and audit. | P0 | VS-7 |
| FR-EXPENSE-006 | The system shall allow HQ Finance to flag unusual patterns (frequency, amount clustering, repeated context, sudden changes) for human review, with the pattern definition documented and versioned. | P1 | VS-7 |
| FR-EXPENSE-007 | The system shall ensure a flag never triggers an automatic consequence; escalation routes to a named human role with an SLA. | P0 | VS-7 |
| FR-EXPENSE-008 | The system shall provide expense certification: an operator can certify that a set of expenses is complete and correct for a period, with an audit trail. | P1 | VS-7 |
| FR-EXPENSE-009 | The system shall link cash expenses to the shift's expected cash arithmetic and non-cash expenses to the payable review queue. | P0 | VS-7 |
| FR-EXPENSE-010 | The system shall allow an operator to record an expense offline and sync it later with an idempotent record. | P0 | VS-7 |
| FR-EXPENSE-011 | The system shall allow HQ to define which categories require evidence, which require review, and which are reimbursable. | P1 | VS-7 |
| FR-EXPENSE-012 | The system shall never encode assumptions about who received a field payment or why, and shall not provide any workflow that routes such a payment for approval faster, hides it, or optimises it. | P0 | VS-7 |
| FR-EXPENSE-013 | The system shall report field expenses as a separate cost line from stock and settlement costs, so they are visible rather than buried. | P1 | VS-7 |
| FR-EXPENSE-014 | The system shall retain expense evidence for a short, documented period and delete it on schedule (`RETENTION.md`). | P0 | VS-17 |

### 7.11 Stock and inventory — `FR-STOCK`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-STOCK-001 | The system shall treat stock categories, units and item-to-stock mappings as configuration data (ADR-0025). | P0 | VS-8 |
| FR-STOCK-002 | The system shall record stock movements as an append-only log (issue, return, waste, damage, sample, staff meal, adjustment, unknown) with reason and actor. | P0 | VS-8 |
| FR-STOCK-003 | The system shall derive current stock position from movements rather than storing a mutable balance as the source of truth. | P0 | VS-8 |
| FR-STOCK-004 | The system shall allow an operator to request a restock for their stall with item, quantity and needed-by time. | P1 | VS-8 |
| FR-STOCK-005 | The system shall allow a restock request to be issued or declined with a reason, and link issued stock to an issue movement. | P1 | VS-8 |
| FR-STOCK-006 | The system shall record a stock count (opening, mid-shift, closing) and compute expected vs counted ending stock, presenting differences as `selisih` with a reason selector that includes UNKNOWN (ADR-0030). | P0 | VS-8 |
| FR-STOCK-007 | The system shall never automatically conclude theft, hide variance by tolerances, or use accusatory wording anywhere in stock surfaces. | P0 | VS-8 |
| FR-STOCK-008 | The system shall require a documented two-person human review before a variance pattern is escalated, and shall record the conclusion. | P1 | VS-8 |
| FR-STOCK-009 | The system shall allow waste and spoilage to be recorded with a photo where configured. | P2 | VS-8 |
| FR-STOCK-010 | The system shall allow stock transfers between stalls with an explicit receiving confirmation by the receiving operator. | P1 | VS-8 |
| FR-STOCK-011 | The system shall show an operator their own stock position and history, and shall not expose another operator's stock detail beyond what scope allows. | P0 | VS-8 |
| FR-STOCK-012 | The system shall allow uncounted items at closing to be marked as not counted (explicit UNCOUNTED), which is retried or flagged rather than treated as zero. | P0 | VS-8 |

### 7.12 Loyalty — `FR-LOYALTY`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-LOYALTY-001 | The system shall keep loyalty disabled by default; enabling it is a per-organisation configuration with audit. | P1 | VS-11 |
| FR-LOYALTY-002 | The system shall identify a customer only with explicit, consented mechanisms (phone hash, rotating QR token, anonymous device token). | P1 | VS-11 |
| FR-LOYALTY-003 | The system shall record loyalty consent with timestamp, purpose text and channel, and shall support withdrawal. | P1 | VS-11 |
| FR-LOYALTY-004 | The system shall version earn/redeem rules and reference the applied version on every loyalty transaction. | P1 | VS-11 |
| FR-LOYALTY-005 | The system shall bound loyalty liability: point value documented in minor units, per-period caps, and no negative balances. | P1 | VS-11 |
| FR-LOYALTY-006 | The system shall issue a single-use reward instance per redemption, enforced by a uniqueness constraint so concurrent redemptions resolve to exactly one success. | P1 | VS-11 |
| FR-LOYALTY-007 | The system shall never expose a customer's identity or purchase history to operators beyond the redemption context. | P1 | VS-11 |
| FR-LOYALTY-008 | The system shall provide an audit trail for every earn, redeem, expire and reversal. | P1 | VS-11 |
| FR-LOYALTY-009 | The system shall not implement or infer a scoring, targeting or profiling algorithm in this phase. | P0 | VS-11 |
| FR-LOYALTY-010 | The system shall allow a customer to request deletion of their loyalty record, executed through the deletion pipeline with anonymisation of linked sales where required. | P1 | VS-17 |
| FR-LOYALTY-011 | The system shall prevent self-award: an operator may not earn loyalty on their own transactions or redeem on their own account. | P1 | VS-11 |
| FR-LOYALTY-012 | The system shall record loyalty-related incidents (suspected abuse) as incidents, not as automatic disqualification. | P2 | VS-11 |

### 7.13 HQ operations and reporting — `FR-HQ`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-HQ-001 | The system shall show HQ a coverage view: which stalls are active, staffed, at which location, and which are not selling. | P0 | VS-12 |
| FR-HQ-002 | The system shall show sales totals by area, location, stall, operator and payment method for a selected business day, with verification status distinguished. | P0 | VS-12 |
| FR-HQ-003 | The system shall show cash position: opening cash, cash sales, cash expenses, expected vs counted, variance, and unreconciled differences. | P0 | VS-9 |
| FR-HQ-004 | The system shall show a payment verification backlog with age, value and responsible role. | P0 | VS-12 |
| FR-HQ-005 | The system shall show stock issues, consumption, waste and variance by stall and area, with neutral wording. | P1 | VS-12 |
| FR-HQ-006 | The system shall show an incident board with severity, age, owner and SLA status. | P1 | VS-13 |
| FR-HQ-007 | The system shall show expense review queues and flagged patterns for Finance. | P1 | VS-12 |
| FR-HQ-008 | The system shall display data freshness (`computedAt`) on every read model and shall mark stale figures explicitly rather than silently. | P0 | VS-12 |
| FR-HQ-009 | The system shall allow every aggregate to be drilled down to the underlying records within the viewer's scope. | P0 | VS-12 |
| FR-HQ-010 | The system shall provide scheduled and ad-hoc exports (CSV) of operational data with scope enforcement and audit of who exported what. | P1 | VS-12 |
| FR-HQ-011 | The system shall allow HQ to publish announcements to areas and to acknowledge receipt, without becoming a chat product. | P2 | VS-14 |
| FR-HQ-012 | The system shall support HQ-configured thresholds (cash tolerance, shift duration, verification age, expense flags, variance thresholds) as configuration with audit. | P1 | VS-12 |
| FR-HQ-013 | The system shall support an area/region filter on every HQ view so a supervisor sees only their scope. | P0 | VS-12 |
| FR-HQ-014 | The system shall allow an HD "exceptions first" default view: unresolved verifications, missed closings, long shifts, high variance, open incidents. | P1 | VS-12 |

### 7.14 Operator performance inputs and recognition — `FR-PERF`, `FR-RECOG`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-PERF-001 | The system shall compute performance input metrics from operational records (coverage, closing punctuality, data completeness, void rate, variance with reasons, incident handling, expense-submission quality, stock discipline, customer-aid signals). | P1 | VS-15 |
| FR-PERF-002 | The system shall refuse to compute or display metrics that reward speed at the cost of honesty (e.g. sales per minute, cash collected per hour) as individual performance measures. | P0 | VS-15 |
| FR-PERF-003 | The system shall attach a confidence/sample-size indicator to every performance input and shall suppress presentation below the configured minimum sample. | P1 | VS-15 |
| FR-PERF-004 | The system shall not rank operators by revenue alone in any surface. | P0 | VS-15 |
| FR-PERF-005 | The system shall normalise inputs for traffic band (location class), shift duration, day of week, closures, weather band when reported, and stock availability. | P1 | VS-15 |
| FR-PERF-006 | The system shall allow an operator to see the inputs about themselves, with explanations of how each is derived. | P1 | VS-15 |
| FR-PERF-007 | The system shall allow an operator or supervisor to dispute an input record and shall record the dispute outcome. | P1 | VS-15 |
| FR-PERF-008 | The system shall keep individual performance data visible only to the operator concerned, their supervisor, and HQ People roles — never public, never cross-area. | P0 | VS-15 |
| FR-PERF-009 | The system shall not use performance inputs for automated discipline, scheduling punishment, or pay calculation. | P0 | VS-15 |
| FR-PERF-010 | The system shall allow HQ to change normalisation parameters with audit and to re-run the period calculation explicitly, keeping prior results. | P1 | VS-15 |
| FR-RECOG-001 | The system shall support Operator of the Day/Month/Year recognition with published, versioned weights and a documented normalisation method (ADR-0029). | P1 | VS-15 |
| FR-RECOG-002 | The system shall require a minimum sample size before an operator is eligible for a period. | P1 | VS-15 |
| FR-RECOG-003 | The system shall disclose to operators which factors are considered and their weight ranges. | P0 | VS-15 |
| FR-RECOG-004 | The system shall require a human review step before an award is published, with the reviewer recorded. | P1 | VS-15 |
| FR-RECOG-005 | The system shall support an appeal on any award, with the outcome recorded against the period. | P1 | VS-15 |
| FR-RECOG-006 | The system shall not publish individual ratings to customers or to other operators outside the award itself. | P0 | VS-15 |
| FR-RECOG-007 | The system shall not apply any automatic penalty to operators who are not recognised. | P0 | VS-15 |
| FR-RECOG-008 | The system shall retain recognition periods and their inputs for audit and for explaining an award to the person who received (or did not receive) it. | P1 | VS-15 |

### 7.15 Communication, incidents and notifications — `FR-COMM`, `FR-INC`, `FR-NOTIF`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-COMM-001 | The system shall anchor every operational message to a record (shift, sale, expense, incident, stock issue, closing), not to a free-floating conversation. | P0 | VS-14 |
| FR-COMM-002 | The system shall support predefined operator→supervisor requests (need help, cannot sell, equipment broken, stock out, cash issue) as one-tap actions with an optional note. | P0 | VS-14 |
| FR-COMM-003 | The system shall record message delivery status and read acknowledgement for operational requests within the app, and shall not claim delivery through an external channel it cannot verify. | P1 | VS-14 |
| FR-COMM-004 | The system shall never make a money state depend on a message being delivered or read (FR-NOTIF-007). | P0 | VS-14 |
| FR-COMM-005 | The system shall keep supervisor responses within the same record thread so the history stays attached to the operational event. | P1 | VS-14 |
| FR-COMM-006 | The system shall not implement general-purpose chat, groups, or media sharing beyond operational evidence attachments. | P0 | VS-14 |
| FR-COMM-007 | The system shall provide escalation rules (unanswered request → supervisor → area → HQ) as configuration with audit. | P1 | VS-14 |
| FR-COMM-008 | The system shall respect quiet hours for non-urgent notifications and shall distinguish urgent from informational messages. | P1 | VS-14 |
| FR-INC-001 | The system shall record an incident with category, severity, description, time, location, people involved (optional), evidence and status. | P0 | VS-13 |
| FR-INC-002 | The system shall support incident categories as configuration (equipment, stock issue, location conflict, weather, safety, security, customer dispute, cash discrepancy, payment problem, other). | P0 | VS-13 |
| FR-INC-003 | The system shall support incident severities with response SLAs and, for the highest severity, an immediate supervisor notification. | P1 | VS-13 |
| FR-INC-004 | The system shall allow an incident to be raised offline and synced later, keeping the reporter's device timestamp as metadata. | P0 | VS-13 |
| FR-INC-005 | The system shall record incident lifecycle transitions (reported, acknowledged, in progress, resolved, closed, reopened) with actor and reason. | P0 | VS-13 |
| FR-INC-006 | The system shall never use incident records to automatically judge an operator's performance without human review. | P0 | VS-13 |
| FR-INC-007 | The system shall allow HQ to see repeat incident patterns by stall, location and time window. | P1 | VS-13 |
| FR-INC-008 | The system shall allow a safety incident to trigger an immediate escalation path that does not depend on app notifications alone being read. | P1 | VS-13 |
| FR-INC-009 | The system shall retain incident evidence per `RETENTION.md` and delete it on schedule. | P1 | VS-17 |
| FR-INC-010 | The system shall allow an incident to be linked to a shift, sale, expense, payment or stock record for context. | P1 | VS-13 |
| FR-INC-011 | An operator may submit a neutral, self-scoped incident report with an event time, optional integer IDR amount/context, and current location/shift derived from server context; reports remain submittable without a current shift but are then explicitly unlinked. | P1 | Page 13 / T-INC-001 |
| FR-INC-012 | The incident reporting surface shall not decide legality, identify alleged offenders, accept client-selected tenant/actor/shift/location, or imply emergency response; free text is excluded from analytics and application logs. | P0 | Page 13 / T-INC-001 |
| FR-INC-013 | Evidence upload/reference is unavailable until durable private storage, access controls, retention and deletion are implemented and approved; the UI must state this limitation rather than simulate attachment. | P1 | Page 13 / T-INC-001 |
| FR-TRAFFIC-001 | An operator may explicitly capture a silent video sample of at most 10 seconds and enter a manual human count/band; the raw clip is private, not processed for identity or computer vision, never used for training, purged within 24 hours, and result metadata is not keyed to operator or shift. Production stays disabled pending approved DPIA and verified purge/backup deletion. | P1 | Page 11 / T-TRAFFIC-001 |
| FR-NOTIF-001 | The system shall model notifications as objects with type, severity, audience, subject, action link, created/read/acted timestamps. | P0 | VS-12 |
| FR-NOTIF-002 | The system shall deliver in-app notifications as the primary channel, with email, push, or WhatsApp as optional channels enabled per organisation. | P0 | VS-14 |
| FR-NOTIF-003 | The system shall allow each user to configure which notification types they receive on which channel, within organisation policy. | P1 | VS-14 |
| FR-NOTIF-004 | The system shall never send personal or financial detail through a third-party channel beyond the minimum needed to prompt action in the app. | P0 | VS-14 |
| FR-NOTIF-005 | The system shall record notification attempts and outcomes for audit, without treating "sent" as "received". | P1 | VS-14 |
| FR-NOTIF-006 | The system shall suppress duplicate notifications for the same subject within a configurable window. | P1 | VS-14 |
| FR-NOTIF-007 | The system shall ensure no financial or state transition depends on notification delivery; the record is authoritative, the notification is a convenience. | P0 | VS-14 |
| FR-NOTIF-008 | The system shall provide a daily digest to HQ roles summarising unresolved items instead of sending every event immediately. | P1 | VS-14 |

### 7.16 Audit, corrections and customer touchpoints — `FR-AUDIT`, `FR-CUST`

| ID | Requirement | Priority | Slice |
| --- | --- | --- | --- |
| FR-AUDIT-001 | The system shall write an append-only audit event for every money-affecting and permission-affecting action (ADR-0026). | P0 | VS-1 |
| FR-AUDIT-002 | The system shall require a reason for voids, corrections, adjustments, overrides, reconciliations, approvals and rejections. | P0 | VS-1 |
| FR-AUDIT-003 | The system shall store actor, action, subject, before/after values (minimised), reason, timestamp and correlation ID on each audit event. | P0 | VS-1 |
| FR-AUDIT-004 | The system shall make audit events readable to Owner, Finance and Auditor roles within scope, and exportable for external review. | P0 | VS-12 |
| FR-AUDIT-005 | The system shall record denied authorization attempts as audit events. | P0 | VS-1 |
| FR-AUDIT-006 | The system shall preserve audit events for longer than the operational records they describe, per `RETENTION.md`. | P1 | VS-17 |
| FR-AUDIT-007 | The system shall never allow an audit event to be edited or deleted through any application path. | P0 | VS-1 |
| FR-AUDIT-008 | The system shall allow reconstructing a shift end-to-end from audit and domain records (who did what, in what order, with which results). | P1 | VS-12 |
| FR-CUST-001 | The system shall present a customer-facing payment confirmation only for verified states, and shall never show "paid" for an unverified digital payment. | P0 | VS-6 |
| FR-CUST-002 | The system shall support a customer receipt by QR/link/printed code where configured, containing the itemised lines and the honest payment state. | P2 | VS-6 |
| FR-CUST-003 | The system shall never require a customer to register, install an app, or share a phone number to buy siomay. | P0 | VS-5 |
| FR-CUST-004 | The system shall record no customer personal data in the sales flow beyond an optional consented loyalty reference. | P0 | VS-5 |
| FR-CUST-005 | The system shall provide a customer-facing privacy notice for the loyalty programme where loyalty is enabled. | P1 | VS-11 |

## 8. Non-functional requirements

### 8.1 Security — `NFR-SEC`

| ID | Requirement |
| --- | --- |
| NFR-SEC-001 | Every request shall be authenticated and authorized against an explicit action and scope; unscoped repository access shall be impossible by construction (ADR-0016, ADR-0031). |
| NFR-SEC-002 | Session tokens shall be stored in `httpOnly`, `Secure`, `SameSite` cookies; tokens shall never be stored in `localStorage`. |
| NFR-SEC-003 | HQ Finance, Owner and Auditor roles shall require a second factor once authentication is implemented. |
| NFR-SEC-004 | Payment provider secrets shall exist only in server-side secret storage, never in client bundles, logs or evidence images. |
| NFR-SEC-005 | Provider callbacks shall be verified (signature, reference match, amount match, replay protection) before affecting any state. |
| NFR-SEC-006 | All money-affecting endpoints shall be idempotent and shall reject replays with mismatched payloads. |
| NFR-SEC-007 | The system shall enforce least privilege with documented role/permission matrix (`docs/security/PERMISSIONS.md`). |
| NFR-SEC-008 | Evidence uploads and downloads shall use short-lived pre-signed URLs with content-type and size bounds. |
| NFR-SEC-009 | The system shall log security-relevant events (auth, authorization denials, device revocation, role changes, exports) to the audit trail. |
| NFR-SEC-010 | The system shall provide device and session revocation for lost or stolen operator devices. |
| NFR-SEC-011 | The system shall remediate known-vulnerable dependencies on a documented schedule and shall pin exact versions. |
| NFR-SEC-012 | The system shall not expose internal identifiers, stack traces or SQL detail to clients in error responses. |

### 8.2 Privacy — `NFR-PRIVACY`

| ID | Requirement |
| --- | --- |
| NFR-PRIVACY-001 | The system shall collect the minimum personal data required for the documented purposes (UU PDP purpose limitation and minimisation). |
| NFR-PRIVACY-002 | The system shall provide plain-language notice at the point of collection (operator onboarding, loyalty enrolment). |
| NFR-PRIVACY-003 | The system shall capture location only through explicit, shift-bounded operator reports; no background or continuous collection. |
| NFR-PRIVACY-004 | The system shall not derive movement patterns, productivity-by-location, or presence outside working hours from location data. |
| NFR-PRIVACY-005 | The system shall allow an operator to access, correct and dispute personal records about them, and to raise a complaint. |
| NFR-PRIVACY-006 | The system shall support data-subject requests (access, correction, deletion) with identity verification, tracked execution and audit. |
| NFR-PRIVACY-007 | The system shall keep personal data out of analytics, logs and telemetry beyond masked identifiers. |
| NFR-PRIVACY-008 | The system shall segregate loyalty (customer) data from operator performance data, with different access rules. |
| NFR-PRIVACY-009 | The system shall document data flows, purposes, recipients and retention before any new collection is added (privacy review gate). |
| NFR-PRIVACY-010 | The system shall support cross-border processing only where lawful and documented, with the DPO/legal posture recorded. |
| NFR-PRIVACY-011 | Optional GPS samples shall be captured only after an explicit operator tap during an active shift, attached to an explicit report, excluded from analytics, and purged within 14 days; no background/continuous collection is permitted. |
| NFR-PRIVACY-012 | Traffic video shall be silent, operator-tap initiated, ≤10 seconds, first-party/private, identity-blind and not used for model training; raw media is deleted within 24 hours with backups, HQ cannot access clips, and result metadata has no operator/shift key. Capture remains production-disabled until DPIA/privacy approval and purge verification. |

### 8.3 Performance and reliability — `NFR-PERF`, `NFR-REL`

| ID | Requirement |
| --- | --- |
| NFR-PERF-001 | The operator app shall reach usable interactivity on a mid-range Android phone on a 3G-class connection within 3 s warm / 6 s cold budget. |
| NFR-PERF-002 | A recorded sale shall appear in the UI within 150 ms locally, independent of connectivity. |
| NFR-PERF-003 | The operator's app shell and required assets for a shift shall fit within a documented size budget (target ≤2 MB compressed for the offline shell). |
| NFR-PERF-004 | Server-side p95 latency for read endpoints shall be ≤400 ms and for write endpoints ≤600 ms within the pilot's expected load. |
| NFR-PERF-005 | HQ dashboard read models shall load within 2 s for the pilot's data volume. |
| NFR-PERF-006 | Sync of one offline day (≈50 sales, ≈10 expenses, 2 counts) over a 3G-class connection shall complete within 60 s and be resumable. |
| NFR-PERF-007 | Batch sync shall process records in bounded chunks so a single large replay cannot monopolise the API. |
| NFR-PERF-008 | The system shall sustain a full area's evening closing burst (all stalls closing within a 30-minute window) without degradation beyond the p95 budgets. |
| NFR-REL-001 | The system shall be available 99.5% monthly during pilot, excluding declared maintenance windows. |
| NFR-REL-002 | No single-device failure, lost phone or corrupted local storage shall lose accepted server-side records. |
| NFR-REL-003 | The system shall survive database failover with at most a short read-only window; writes during failover shall fail loudly and safely, never partially. |
| NFR-REL-004 | Background job failures shall be retried with backoff and land in a dead-letter queue for human inspection. |
| NFR-REL-005 | Backups shall be taken continuously and restores shall be rehearsed on a documented schedule. |
| NFR-REL-006 | The system shall degrade gracefully: when a non-essential dependency (maps, notifications, analytics) is down, selling continues. |

### 8.4 Offline behaviour — `NFR-OFFLINE`

| ID | Requirement |
| --- | --- |
| NFR-OFFLINE-001 | The operator shall be able to start a shift, record cash sales, record expenses, record stock movements, report location and prepare a closing with no connectivity. |
| NFR-OFFLINE-002 | Digital payments shall never be marked successful while offline (ADR-0033). |
| NFR-OFFLINE-003 | Offline-created records shall carry a client-generated UUIDv7 and a device timestamp, and shall sync without duplicates on retry. |
| NFR-OFFLINE-004 | The outbox shall be ordered per aggregate (shift → its sales → its expenses → its closing) and shall report per-record outcomes. |
| NFR-OFFLINE-005 | Conflicts shall be detected on the server and resolved by documented rules; unresolvable conflicts shall be quarantined for human handling, never dropped. |
| NFR-OFFLINE-006 | The UI shall show sync state per record (pending, syncing, synced, rejected-with-reason) at all times. |
| NFR-OFFLINE-007 | The system shall never discard a queued record without an explicit, audited rejection reason visible to the operator. |
| NFR-OFFLINE-008 | Stale data surfaces shall display their age, and the client shall warn before acting on data older than the documented band. |
| NFR-OFFLINE-009 | Authentication shall allow continued local operation during a documented grace window for an already-authenticated device, with the server remaining authoritative on sync. |
| NFR-OFFLINE-010 | The offline queue shall be encrypted at rest on the device and wiped on logout or revocation. |

### 8.5 Observability, accessibility and operations — `NFR-OBS`, `NFR-ACCESS`, `NFR-OPS`

| ID | Requirement |
| --- | --- |
| NFR-OBS-001 | The system shall emit structured logs with correlation IDs and no personal data content. |
| NFR-OBS-002 | The system shall emit OpenTelemetry traces for API requests, sync batches, provider callbacks and job executions. |
| NFR-OBS-003 | The system shall expose business metrics (shifts started/closed, sync outcomes, payment states by age, verification backlog, variance, incidents) with bounded labels. |
| NFR-OBS-004 | The system shall define SLOs and alert on their breach (`OBSERVABILITY.md`). |
| NFR-OBS-005 | The system shall provide a health endpoint distinguishing web, database, queue and provider-adapter readiness. |
| NFR-OBS-006 | The system shall log every state transition of money-affecting objects with correlation to the originating request. |
| NFR-OBS-007 | The system shall allow an operator's support issue to be traced by shift/sale/device correlation without exposing other users' data. |
| NFR-OBS-008 | The system shall produce an operational daily report (job health, sync failures, verification backlog, reconciliation gaps) for Ops. |
| NFR-ACCESS-001 | Every operator-facing control shall meet a minimum 44×44 px tap target and a 4.5:1 contrast ratio for text. |
| NFR-ACCESS-002 | The operator UI shall be usable one-handed and with one thumb on a 360×640 viewport without horizontal scrolling. |
| NFR-ACCESS-003 | Critical amounts and statuses shall not rely on colour alone; they shall use text and shape as well. |
| NFR-ACCESS-004 | The interface shall support system font scaling up to 130% without losing controls or truncating amounts. |
| NFR-ACCESS-005 | The system shall support screen-reader labelling on operator and HQ surfaces for primary actions. |
| NFR-ACCESS-006 | Forms shall prevent and explain errors in plain Indonesian, with no developer jargon and no error codes shown to operators. |
| NFR-ACCESS-007 | The operator flow shall be operable on low-end devices without animations that block interaction, respecting reduced-motion. |
| NFR-ACCESS-008 | Help content shall exist for the ten most common operator tasks, reachable from the surface where the task happens. |
| NFR-OPS-001 | The system shall be deployable as a single artifact with an explicit, reversible migration step (ADR-0024). |
| NFR-OPS-002 | Every configuration change affecting money behaviour shall be audited and reversible. |
| NFR-OPS-003 | The system shall provide documented runbooks for the ten most likely operational failures (`RUNBOOK.md`). |
| NFR-OPS-004 | The system shall allow enabling/disabling risky capabilities (digital payments, loyalty, notifications) by configuration with an audit trail (ADR-0038). |
| NFR-OPS-005 | The system shall support a maintenance mode that blocks writes with a clear message while preserving reads. |
| NFR-OPS-006 | The system shall expose a support view (scoped) enabling an HQ user to see a specific shift's records to answer an operator's phone call. |

### 8.6 Compliance and audit readiness — `NFR-COMP`

| ID | Requirement |
| --- | --- |
| NFR-COMP-001 | The system shall comply with Indonesia's UU PDP obligations for lawful basis, notice, minimisation, retention, deletion and breach notification readiness (72 hours), as documented in `PRIVACY.md`. |
| NFR-COMP-002 | The system shall produce financial records that are internally consistent and reconstructible: totals recomputable from snapshots must equal stored totals. |
| NFR-COMP-003 | The system shall not integrate a third-party service that processes personal data before a privacy/contract review is recorded. |
| NFR-COMP-004 | The system shall keep audit evidence for money decisions available for the retention period required by policy and law. |

### 8.7 Field usability — `NFR-UX`

| ID | Requirement |
| --- | --- |
| NFR-UX-001 | A trained operator shall complete the ten most common tasks one-handed, in daylight, without help; each task shall meet the tap budget in `DESIGN.md` §4. |
| NFR-UX-002 | Every error, empty and offline state shall offer a next step or a way to get help; no flow may end in a dead end. |
| NFR-UX-003 | The system shall never require typing where a chip, preset or prefill can express the same choice, except for reasons marked "Lainnya". |
| NFR-UX-004 | Payment and money wording shall be exact and honest (cash complete only when recorded; unverified digital labelled "Menunggu verifikasi"); no ambiguous success language anywhere. |
| NFR-UX-005 | Offline, pending-sync and stale-data states shall be visible without hunting, and shall never be presented as an error requiring the operator to fix anything. |
| NFR-UX-006 | The system shall never use accusatory wording, blame, shaming or automated accusation about an operator; differences are labelled neutrally ("selisih") and every escalation is a human decision with a recorded reason. |

## 9. Financial, ethical and legal boundaries

### 9.1 Payment honesty rules (non-negotiable)

1. Cash is a first-class method and works fully offline.
2. A digital payment exists in a state machine whose PAID state requires **verified server-side
   evidence** or an **explicit, evidenced HQ Finance reconciliation**. Nothing else.
3. The client never sets PAID. The offline queue never carries PAID. A browser redirect, a customer's
   screen, a verbal "sudah transfer", a photo of a receipt and a chat message are **not** evidence.
4. The UI text for unverified digital payments is "Menunggu verifikasi" — never "berhasil",
   "lunas" or "sukses".
5. Reports keep verified and unverified digital amounts separate. Management reporting must never
   merge them into one number (§7.8 FR-PAYMENT-010).
6. Refunds require explicit records. Nothing in the system fabricates a refund or hides a failure.
7. Provider callbacks are verified, matched by reference and amount, replay-protected, and rejections
   are logged for investigation.

### 9.2 Field expense policy (mandatory; see ADR-0027, `docs/finance/EXPENSE-REVIEW.md`)

1. Field payments are recorded neutrally as `UNVERIFIED_FIELD_EXPENSE` or another auditable
   operational category, with description, amount, time, location context, optional evidence,
   operator note and review status.
2. The system does **not** require or assert who received the payment, whether they had any authority,
   or why it was demanded. Operators are not asked to justify anyone's authority.
3. The system does **not** encourage, automate, hide, facilitate or optimise illegal payments,
   bribery, extortion or payments to criminal groups. No workflow exists whose purpose is to make such
   a payment easier, faster to approve, or invisible.
4. Cash field expenses are visible in the shift's cash arithmetic (so honesty in the count is
   rewarded, not punished); non-cash field expenses enter a payable review queue.
5. HQ can flag unusual patterns for **human** review. Flags are patterns about records, never
   accusations about people, and never trigger automatic consequences (FR-EXPENSE-007).
6. Review states: SUBMITTED → REVIEW_REQUIRED → REVIEWED | REJECTED → ESCALATED, each with reason,
   actor and audit row.
7. An operator may record this category without any additional burden compared to other categories,
   and the wording in the UI is neutral.

### 9.3 Location privacy rules

1. Location is captured only as an explicit operator action during an active shift (arrive, confirm
   unchanged, move, depart, step away), with a reason for moves (FR-LOCATION-004/005). Under ADR-0039,
   one optional browser fix may be attached to each submitted report after a direct user tap.
2. No background collection, no timers, no "safety" pings, no third-party SDK with location access,
   and no `watchPosition`. Manual reporting remains available when GPS is denied or unavailable.
3. Repository methods take scope; a shift's selling-point report history is visible to the operator,
   their supervisor within scope, and HQ roles that need it operationally (never for productivity
   policing). Raw GPS fields are self-only, excluded from HQ map/read models, audit payloads and analytics.
4. GPS coordinates/accuracy/capture times are purged within 14 days (NFR-PRIVACY-011 / R-25);
   non-GPS location reports follow R-09 and operational coverage data survives in aggregate.
   Production enablement requires approved DPIA and a verified retention job.
5. The product never asserts a location's legal permission status. Only an explicit HQ verification
   record counts, and it is labelled with verifier and timestamp (FR-LOCATION-009).

### 9.4 Recognition fairness rules

1. Inputs are multi-factor and documented; revenue alone never decides an award (FR-PERF-004).
2. Normalisation accounts for traffic band, shift duration, day of week, closures, weather band,
   and stock availability (FR-PERF-005).
3. Minimum sample-size gates exist before anyone is assessed (FR-PERF-003, FR-RECOG-002).
4. Weights and method are published to operators in advance; results are explainable.
5. A human reviews before publication; awards are appealable; no automatic penalty (FR-RECOG-004/007).
6. Inputs come from `OperatorPerformanceSnapshot` candidate data only — never from surveillance,
   never from hidden scoring, and never from data the operator cannot see about themselves.

### 9.5 Legal and compliance posture (summary; detail in `PRIVACY.md`, `THREAT_MODEL.md`, `RETENTION.md`)

UU PDP (Law 27/2022, enforceable since October 2024) is treated as binding: lawful basis, notice,
minimisation, purpose limitation, retention limits, data-subject rights, breach notification readiness
within 72 hours, and processor agreements for third parties. Financial records are retained for the
period required by policy and law, with audit rows retained longer. No customer data is collected
to buy siomay.

## 10. Edge cases and failure model (selected; full catalogue in `QA.md`)

| ID | Case | Required behaviour |
| --- | --- | --- |
| EC-01 | Operator's phone dies mid-shift | Records already accepted by the server remain; unsynced local records are lost and the shift is closed by a supervisor with an explicit reconstruction note; the day is marked as reconstructed |
| EC-02 | Two devices record for the same shift | Server rejects the second device's writes with `CONFLICT` unless a handover exists; UI explains and offers handover |
| EC-03 | Offline for three days | Queue processes chronologically per aggregate; closings are submitted per business day; HQ sees a stale-data warning |
| EC-04 | Client clock wrong by hours | Server time governs ordering and business day; device time is metadata and shown for support only |
| EC-05 | Duplicate sale replay | Same idempotency key returns the original sale with a replay indicator; a different payload under the same key is rejected as `IDEMPOTENCY_MISMATCH` |
| EC-06 | Price not configured for an item at a location | Item appears not sellable; no zero price; operator sees a clear message and an HQ alert is raised |
| EC-07 | Two equally specific price policies | Resolution fails loudly (`PRICE_RESOLUTION_AMBIGUOUS`); sale is blocked with a clear message; HQ is alerted |
| EC-08 | Customer pays QRIS but provider callback never arrives | Payment stays unverified; shift closes with an unresolved-verification alert; HQ resolves by verified query or reconciliation with evidence |
| EC-09 | Customer claims payment, merchant sees nothing | Operator records PENDING_VERIFICATION and a note; the record remains honest; no PAID without verification |
| EC-10 | Customer pays twice (double scan/transfer) | Duplicate payment detected by reference/amount; the second is recorded as REFUND_REQUIRED or a duplicate candidate for human review; never silently merged |
| EC-11 | Payment amount differs from sale total | Reconciliation check fails loudly; the difference becomes an explicit exception with a reason |
| EC-12 | Location becomes unavailable mid-shift | Operator reports MOVE_SITE with reason; the sale history preserves both locations and their windows |
| EC-13 | Location is reported as RESTRICTED | Warn (never block): operator may still sell if they choose; the record notes the state at the time; no legal assertion is made |
| EC-14 | Stock count not possible before closing | Items marked UNCOUNTED explicitly; closing proceeds with a flagged incomplete count; no silent zero |
| EC-15 | Negative derived stock | Shown as a variance requiring reason; never corrected automatically; root cause may be an unrecorded issue |
| EC-16 | Stock transfer never confirmed | Remains PENDING on both sides; alerts both operators and the supervisor after the configured window |
| EC-17 | Handover refused by the incoming operator | Shift accountability stays with the outgoing operator; handover marked CANCELLED with reason; supervisor alerted |
| EC-18 | Variance beyond tolerance at closing | Closing accepted as PENDING_REVIEW; requires a reason; supervisor review decision recorded; never auto-escalated as theft |
| EC-19 | Closing submitted by an operator no longer assigned | Server rejects with a clear message; a supervisor can close on their behalf with reason and audit |
| EC-20 | Expense recorded twice | Duplicate detection on client id; if two genuinely identical expenses exist, both are retained and one is flagged for review |
| EC-21 | Operator records an expense after closing | Requires a correction/period adjustment record with reason; the locked closing is not edited (ADR/`STATE_MACHINE.md`) |
| EC-22 | Supervisor approves an override after the shift closed | Override applies only to future sales; retro-application requires an explicit corrective record |
| EC-23 | Provider credits less than expected (fees) | Recorded as a settlement expectation difference with fees noted; never netted silently against sales |
| EC-24 | Provider credits more than expected | Recorded as an over-settlement exception requiring human resolution |
| EC-25 | Loyalty redeem raced from two devices | Exactly one succeeds (unique constraint); the loser receives an explicit "already redeemed" message; no double liability |
| EC-26 | Loyalty customer withdraws consent | Account deactivated; historical sales anonymised where possible; liability for unredeemed points handled per policy |
| EC-27 | Operator offboarded with unresolved variance | Variance stays open with a named owner; offboarding does not erase the record; escalation per policy |
| EC-28 | HQ config change mid-shift (price, tolerance) | Applies from its effective time only; the in-flight shift keeps previous snapshots and records the change in its audit trail |
| EC-29 | Notification delivery fails for a critical alert | The alert object remains unresolved and visible in HQ; no financial state depends on delivery (FR-NOTIF-007) |
| EC-30 | Database failover during an evening closing burst | Writes fail loudly and safely; clients retry idempotently; no partially applied closings |
| EC-31 | Junk/delayed sync payload from a very old app version | Version tolerated additively per ADR-0034; incompatible records are rejected with a reason and quarantined, never dropped |
| EC-32 | Operator reports a new selling point that HQ rejects | The proposal is rejected with reason; the shift's records remain valid with the recorded place; no retroactive invalidation |

## 11. Operational metrics

Metrics exist to answer "is the discipline real?" — never to judge individuals. Every metric below has
a definition, a source, and an explicit anti-gaming note.

| Metric | Definition | Source | Anti-gaming / caution |
| --- | --- | --- | --- |
| Coverage rate | Shifts started with a reported location ÷ planned shifts, per day/area | Shifts + assignments + location reports | High coverage is good; do not punish unplanned closures labelled honestly |
| Closing completion | Shifts with accepted closing by 23:59 local ÷ shifts started | Shifts + closings | Late closings must be measured with cause categories, never as a blanket failure |
| Cash reconciliation rate | Accepted closings with variance within tolerance ÷ accepted closings | Closings | Must be read together with reasons; unexplained variance is the signal, not variance itself |
| Variance magnitude | Sum of absolute cash variance in minor units ÷ cash sales | Closings | Small and stable is healthy; a drop to zero can indicate coaching or hiding |
| Digital verification backlog | Value and count of PENDING_VERIFICATION items older than the target window | Payments | Growth is an Ops/Finance staffing signal |
| Verified digital share | Verified digital amount ÷ total digital amount for the period | Payments + reconciliations | Shows whether the honest-state workflow is being worked |
| Sync health | Offline queue items synced within target windows ÷ items created, by area | Sync telemetry | Detects device connectivity reality, not operator diligence |
| Data completeness | Sales with complete attribution (shift, location, price snapshot, payment) ÷ sales | Sales | Incomplete attribution is a product defect signal |
| Stock variance rate | Counted vs expected differences per item, with reason mix (including UNKNOWN share) | Stock counts | UNKNOWN share is a data-quality metric, not a suspicion metric |
| Incident response | Median time from incident acknowledgement to resolution by severity | Incidents | SLA adherence, not blame attribution |
| Field expense review latency | Time from SUBMITTED to REVIEWED/ESCALATED | Expenses | Latency affects operators' reimbursement and trust |
| Recognition review timeliness | Awards reviewed and published within the period + N days | Recognition | Delays erode the motivational purpose |
| Product usability signal | Supervisors' manual corrections per 100 records, and abandonment of flows | Audit + client events (no personal content) | High corrections indicate confusing UI |

**Refused metrics (must not be built):** individual sales-per-hour; revenue-per-operator leaderboards;
"location compliance" percentages used as discipline; app-usage or screen-time tracking; route or
movement analysis; any metric whose only effect is pressure without a linked improvement lever.

## 12. Acceptance criteria (product level)

| ID | Criterion |
| --- | --- |
| AC-01 | A new operator, with training, can start a shift and record a 1-item cash sale in ≤4 taps from open, offline, without help. |
| AC-02 | An operator can complete a full offline day (start, ≥20 sales, ≥3 expenses, stock count, closing) and sync it with zero duplicates and zero lost records. |
| AC-03 | No path exists — API, UI, offline queue or job — that sets a digital payment to PAID without verified evidence or a recorded Finance reconciliation. |
| AC-04 | Every sale's total is reproducible from its price snapshots at any later date, and equals the stored total exactly. |
| AC-05 | Every price change is traceable to actor, approver, reason and effective time; no historical sale total changes as a result of a price change. |
| AC-06 | HQ can see, for any business day, coverage, cash position, verification backlog, incidents and unfinished closings, each with a visible freshness timestamp. |
| AC-07 | A variance beyond tolerance always has a human review record with reason and reviewer; `UNKNOWN` is always available as an operator reason. |
| AC-08 | Field expenses can be recorded in ≤4 taps with a neutral category and no required recipient or authority assertion, and appear in a Finance review queue. |
| AC-09 | Location capture occurs only through explicit active-shift reports; optional one-shot GPS fields are purged within 14 days (NFR-PRIVACY-011), while the non-GPS operational report follows R-09; no continuous/background tracking or third-party location SDK is present. |
| AC-10 | Recognition uses documented multi-factor inputs with published weight ranges, sample-size gates, human review and an appeal path; revenue alone can never decide an award. |
| AC-11 | Every money-affecting and permission-affecting action has an immutable audit row with actor, reason (where required) and correlation ID. |
| AC-12 | An operator can see, and dispute, every record about themselves, and can access the privacy notice and their data rights path in the app. |
| AC-13 | Traffic sampling can start only on an explicit operator tap, records no audio or identity inference, limits clips to 10 seconds, deletes raw media within 24 hours including backups, and leaves operator/shift unlinked from result metadata; production remains off until the privacy and purge gates pass. |

## 13. Pilot and release criteria

| Gate | Condition |
| --- | --- |
| G-0 Scope frozen | This document plus ADRs accepted; no open question in §15 blocks a P0 requirement |
| G-1 Pilot ready | VS-0…VS-9 complete; cash-only flow proven offline on real devices; HQ dashboard shows coverage, cash and closings |
| G-2 Digital payments enabled | Static QRIS with manual verification working end-to-end; no unverified amount reported as income; Finance SLA met for 2 weeks |
| G-3 Scale-out ready | Recognised retention/verification workflows, permissions matrix reviewed, threat model residual risks accepted, runbooks rehearsed |
| G-4 Loyalty enabled | Consent, deletion, liability caps and self-award prevention verified (per organisation opt-in only) |
| G-5 Recognition enabled | Weights published, normalisation documented, appeal path tested, HR/People sign-off recorded |

Kill criteria for the pilot: cash variance explained by less than X% of value at the end of week 4;
unverifiable digital payments above Y% of digital volume; or operator-reported time burden above the
agreed limit — thresholds to be fixed with Ops before the pilot starts (open question OQ-06).

## 14. Risks

| ID | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R-01 | Operators avoid recording field demands to avoid scrutiny | Hidden costs, unsafe pressure | Neutral category, no accusation, reimbursement path, visible policy |
| R-02 | Unverified static QRIS lags reconciliation | Revenue unrecognised, disputes | Backlog metric + SLA + provider query path; dynamic QR later |
| R-03 | Poor connectivity causes lost local records | Data gaps | Outbox durability, per-record status, wipe protection, sync health metric |
| R-04 | Shadow pricing by operators when prices are missing | Margin loss, disputes | Loud "not sellable", HQ alert, override policy per ADR-0009 |
| R-05 | Location reporting drifts into de facto surveillance through metric misuse | Trust and legal harm | Explicit rules, refused metrics, access review, retention purge |
| R-06 | Recognition gaming (proxy sales, inflated expenses, voided sales) | Culture damage | Multi-factor design, void-rate and expense-quality signals, human review |
| R-07 | Provider integration delays block digital payments | Slower pilot value | Static QR path works without integration; dynamic is additive |
| R-08 | Supervisor approval bottlenecks (overrides, closings) | Operator friction | Bounded auto-approval windows, SLA alerts, escalation rules |
| R-09 | Scope creep into chat/HR/accounting | Delivery risk | Non-goals §2.2 enforced in review; new scope requires PRD change control |
| R-10 | Audit/PII growth | Cost and privacy exposure | Retention jobs (ADR-0037), minimised audit fields, evidence expiry |

## 15. Open questions (must be resolved before the named slice, not before Phase 0 ends)

| ID | Question | Owner | Needed by |
| --- | --- | --- | --- |
| OQ-01 | Are field-expense reimbursements paid in the same settlement cycle or a separate one? | Finance | VS-7 |
| OQ-02 | Which price-override mode ships first (HQ_ONLY vs SUPERVISOR_APPROVED) and with what bounds? | HQ + Finance | VS-4 |
| OQ-03 | Cash tolerance value(s) per area, and whether tolerant differences still require a reason | Finance | VS-9 |
| OQ-04 | Which roles may see evidence photos, and for how long? | Privacy + Finance | VS-7 |
| OQ-05 | Target verification SLA for PENDING_VERIFICATION (hours) and who is on the evening queue | Ops + Finance | VS-6 |
| OQ-06 | Pilot kill-criteria thresholds (variance %, unverified %, operator time burden) | Ops | G-1 |
| OQ-07 | Employee vs independent-contractor status of operators (affects privacy notice wording, not schema) | Legal | VS-17 |
| OQ-08 | Which single region/area and how many stalls for the pilot, and who trains operators | Ops | G-1 |
| OQ-09 | Whether a supervisor may approve a closing variance above tolerance, or whether Finance always decides | Finance | VS-9 |
| OQ-10 | Whether the loyalty programme launches before or after scale-out | Owner | VS-11 |

## 16. Requirement conventions and change control

- IDs are stable and never reused: `FR-<FAMILY>-NNN`, `NFR-<FAMILY>-NNN`, `EC-NN`, `AC-NN`, `OQ-NN`,
  `R-NN` (risk), `T-<GROUP>-NNN` (tasks), `ADR-NNNN`.
- A requirement may be **refined** in place while Phase 0 lasts; once implementation of its slice
  begins, changes require a documented amendment and an update to `docs/TRACEABILITY.md`.
- Removing a requirement requires a reason recorded in the amendment note.
- Every requirement marked P0 must map to at least one task in `TASKS.md` and at least one QA
  scenario in `QA.md`; the mapping is checked in `docs/TRACEABILITY.md`.
- Priority meanings: P0 pilot-blocking · P1 required before scale-out · P2 later, design recorded now.

**Census (this document): 227 functional requirements across 22 families; 78 non-functional
requirements across 10 families (SEC, PRIVACY, PERF, REL, OFFLINE, OBS, ACCESS, UX, OPS, COMP).
Total 305 stable IDs.**
