# PRIVACY

**Document ID:** DOC-PRIVACY
**Status:** Phase 0 (specification of privacy-by-design)
**Legal context:** Indonesia **UU PDP No. 27/2022** — fully enforceable since **17 October 2024**;
administrative fines up to 2% of annual revenue; breach notification to affected data subjects
and the authority within **72 hours** (Art. 46); dedicated PDP Agency targeted for 2026 with
implementing regulations still pending (obligations apply regardless).
**Related:** NFR-PRIVACY-*, ADR-0007, `RETENTION.md`, `THREAT_MODEL.md`, `docs/security/PERMISSIONS.md`

---

## 1. Personal data inventory

| Data category | Subjects | Purpose | Legal basis (UU PDP Art. 20) | Minimisation stance |
| --- | --- | --- | --- | --- |
| Operator identity (name, phone) | Operators | Account, shift accountability, contact | Contract/employment + legitimate operational interest | Only what is operationally needed; no ID documents, no photos required |
| Operator work data (shifts, assignments, status) | Operators | Operations, payroll-adjacent reporting (external systems), fairness | Contract/legitimate interest | Shift-bounded; no activity surveillance |
| Operator location (reported selling position) | Operators | Coverage, logistics, safety | Legitimate operational interest + transparency | **Shift-bound only**, explicit reporting only |
| One-shot GPS sample (coordinates, accuracy, capture time) | Operators | Assist confirmation of an explicitly selected selling point | Legitimate operational interest + clear notice; preliminary DPIA required | One user-tapped fix per explicit report, optional/advisory/shift-bound; may form a sparse short-term work-location sequence; purge GPS fields within 14 days (ADR-0039 / R-25) |
| Short human-traffic video sample (silent, ≤10 seconds) | Operators and incidental bystanders | Temporary first-party evidence for a manually entered foot-traffic estimate | Legitimate operational interest + point-of-capture notice; DPIA and privacy-owner/DPO approval required before production | User tap only; no audio, face/person recognition, computer vision, external processor or training; private raw object ≤24 hours, no HQ clip access; result metadata has no operator/shift key; verify backup purge |
| Customer identifier (phone hash, QR token, device token) | Customers | Loyalty accrual/redemption | **Explicit consent** (opt-in, withdrawable) | Optional; hash where possible; masking by default |
| Sales & payment records | Operators, customers (indirect) | Financial integrity, audit | Contract/legal obligation | Customer linkage is optional/opaque |
| Expense records (incl. notes, evidence) | Operators, third parties (incidental) | Reimbursement visibility, review | Contract/legitimate interest | Notes bounded; evidence optional and short-lived |
| Incident records (incl. photos) | Operators, customers, third parties | Safety, dispute resolution | Legitimate interest / legal obligation | Access-restricted; retention-limited |
| Device metadata (device label, app version) | Operators | Support, audit | Legitimate interest | No hardware fingerprinting, no advertising identifiers |

**No** processing of sensitive categories (health, biometrics, religion, etc.) is intended.
If a safety incident incidentally contains health information, it is handled as sensitive:
restricted access, short retention, no analytics use.

---

## 2. Data minimisation rules (binding on design)

1. **Location = explicit operational report, shift-bound.** No continuous or background
   collection, no passive logging, no reconstruction of movement outside reported positions
   (NFR-PRIVACY-002/003/004, ADR-0007). ADR-0039 permits one optional GPS fix after an explicit
   operator tap, attached to the submitted report, and requires GPS fields to be purged within 14
   days; manual reporting remains available.
2. **No continuous camera feeds or microphone access.** The only camera exceptions are (a) an
   operator-explicit still-photo capture for evidence/incident and (b) the narrowly scoped Page 11
   silent traffic sample governed by ADR-0040: one explicit tap, maximum 10 seconds, private upload,
   no identity recognition/computer vision, no third-party processor or training, and raw-video
   deletion within 24 hours. Microphone access remains prohibited. Production capture is disabled
   until the DPIA/privacy approval and verified primary/backup purge gates pass.
3. **No contact-book access, no SMS reading, no installed-app inventory.**
4. **Customer data is optional**: a sale never requires identifying the customer.
5. **Free-text fields are bounded** and never used to induce speculation about third parties.
6. **Logs contain no PII by default**: phone numbers masked, no evidence contents, no customer
   identifiers; errors carry request IDs, not payloads.
7. **Exports are scoped, masked where possible, and audited.**

---

## 3. Purpose limitation and consent

| Processing | Consent model |
| --- | --- |
| Operator operational data | Contract/legitimate operational interest; notice given at onboarding; not consent-dependent |
| Location reporting | Transparency + shift-bounded design; operator can see all their own reports |
| One-shot GPS assist | Clear notice before capture; explicit tap for each optional fix; no background collection; manual reporting remains available. This is not described as employment consent; preliminary DPIA review is pending. |
| Page 11 traffic video | Clear notice and explicit capture tap; ≤10 seconds and silent; manual count/band entry; no identity/face recognition, computer vision, training, or external processor. Keep production disabled pending DPIA/privacy-owner approval and verified deletion (including backups). This is not described as employment consent. |
| Loyalty (customer) | Explicit opt-in with purposes (accrual, redemption, campaign messages as separate purpose); withdrawal mechanism; no pre-ticked boxes |
| Campaign messages | Separate opt-in from loyalty accrual |
| Incident evidence | Collected for resolution; not reused for analytics or training |
| Analytics | Aggregated and de-identified where personal data is not strictly required |

---

## 4. Data subject rights (UU PDP mapping)

| Right | Implementation stance | Notes |
| --- | --- | --- |
| Information (Arts. 5–10) | Onboarding notice + in-app explanation screen | Plain Indonesian |
| Access (Art. 11) | Operator/customer can request a copy of their data | Scoped export; verified identity |
| Correction (Art. 13) | Support path to correct personal data | Financial records corrected only via audited corrections (integrity wins) |
| Deletion (Art. 14) | Customer loyalty data deletable; operator personal data deletable when no legal retention duty remains | Financial history retention may legally justify keeping the record with personal identifiers detached |
| Withdraw consent | One-tap for loyalty; effect: stop processing, keep only legally required records | Must be as easy as giving consent |
| Object to automated decisions (Art. 15) | No automated decisions about people exist; recognition is human-reviewed | A key reason automated scoring is forbidden |
| Portability | Structured export on request | CSV/JSON |
| Compensation/litigation | Handled by business/legal process | Documented, not automated |

---

## 5. Retention (summary — details in `RETENTION.md`)

| Data | Retention stance |
| --- | --- |
| Financial records (sales, payments, closings, expenses, adjustments) | Longest tier; required for financial integrity and disputes |
| Audit events | Longest tier; immutable |
| Shift/assignment records | Medium-long (operational + fairness) |
| GPS coordinates/accuracy/capture time attached to explicit reports | **Maximum 14 days**; purge GPS fields, retain the non-GPS report under R-09 |
| Location reports (raw, selling-point ID and shift metadata) | **Short** (R-09; working example 90 days); aggregates may persist |
| Incident evidence photos | **Short**; deleted after resolution unless legally held |
| Raw Page 11 traffic clips | **Maximum 24 hours, including replicas/backups**; production remains disabled pending privacy approval and purge proof (R-26) |
| Page 11 estimate metadata | Provisional 90 days, no direct operator/shift key, no individual performance use (R-27; DPO review pending) |
| Customer loyalty data | While active + short grace period after last activity, then deleted/anonymised |
| Device/telemetry logs | Short (days–weeks) with rotation |
| Sentry/observability data | Scrub PII; short retention |

---

## 6. Security of processing (Art. 35 obligations, summary)

Encryption in transit; encryption at rest via the managed platform; least-privilege access;
segregation of duties; audit trails; breach detection; vendor due diligence with data processing
agreements. Full control list in `SECURITY.md`. **Breach response:** detect → contain → assess
personal-data involvement → **notify within 72 hours** → remediate → post-mortem
(`RUNBOOK.md`).

---

## 7. Cross-border transfers

UU PDP permits transfers via adequacy, appropriate safeguards, or consent (Art. 56). Stance:

1. **Preferred:** host in-region where the managed provider offers an Indonesian or nearby
   (Singapore/Jakarta) region for the database and object storage.
2. If a service is offshore (e.g. global CDN, observability backend), document the basis,
   minimise what is sent (no raw PII, masked/hashed identifiers, aggregated metrics), and record
   the decision in the vendor register.
3. No bulk personal-data transfer without documented safeguards.

---

## 8. DPO and governance

| Item | Stance |
| --- | --- |
| DPO (PPDP) | Assignable role; required where processing scale triggers Art. 53 conditions (large-scale, sensitive, or regular systematic monitoring). Declaring "no systematic monitoring" is supported by ADR-0007. |
| DPIA | Required for: loyalty programme launch, any analytics touching personal data, any new device capability (camera/GPS), and any new third-party processor. Page 10 has a preliminary DPIA at `docs/privacy/10-gps-location-dpia.md`; privacy-owner/DPO review is pending and production GPS capture must remain disabled until it is approved. |
| Records of processing | Maintained as a living register derived from §1 |
| Vendor register | Payment provider, hosting, object storage, push, observability, WhatsApp (if used) — purpose, data categories, location, safeguards |
| Training | Annual privacy refresher for HQ roles with data access |
| Review cadence | Privacy review at each vertical slice gate (see `AGENTS.md` gate order) |

---

## 9. Privacy requirements register

| ID | Requirement | Design stance |
| --- | --- | --- |
| NFR-PRIVACY-001 | Minimise collection | Enforced by inventory + review |
| NFR-PRIVACY-002 | Location as reported selling position only | ADR-0007 |
| NFR-PRIVACY-003 | Shift-bound location reporting | Domain rule INV-11 |
| NFR-PRIVACY-004 | No continuous tracking | Architectural invariant #9 + tests |
| NFR-PRIVACY-005 | Operator data visible only to self/chain/HQ/auditor | Permissions matrix |
| NFR-PRIVACY-006 | Customer loyalty consent explicit and withdrawable | Loyalty design + UI |
| NFR-PRIVACY-007 | Rights supportable | Process + tooling (VS-17) |
| NFR-PRIVACY-008 | 72-hour breach notification supportable | Runbook + logging |
| NFR-PRIVACY-009 | DPO assignable role | Governance |
| NFR-PRIVACY-010 | Cross-border basis documented | Vendor register |
| NFR-PRIVACY-011 | One-shot GPS sample is optional, operator-triggered, shift-bound, advisory, excluded from telemetry, and purged within 14 days | ADR-0039, R-25, preliminary DPIA; production enablement requires privacy-owner/DPO review |
| NFR-PRIVACY-012 | Silent operator-triggered traffic clip ≤10 seconds; first-party/private, no recognition/CV/training/third party; raw clip deleted within 24 hours including backups; HQ cannot access clips; result metadata unkeyed to operator/shift | ADR-0040, R-26/R-27, preliminary DPIA; production disabled until privacy approval and purge verification |

---

## 10. Anti-patterns explicitly forbidden

1. "We'll track location just in case" — prohibited (ADR-0007).
2. Silent collection of contacts, SMS, or device identifiers — prohibited.
3. Selling or sharing customer data with third parties — prohibited.
4. Using incident evidence for marketing or model training — prohibited.
5. Employee performance metrics based on surveillance signals — prohibited (`PERFORMANCE.md` §3).
6. Dark-pattern consent (forced opt-in to buy, pre-ticked boxes, bundled consents) — prohibited.
