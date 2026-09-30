# Role and Permission Matrix

**Document ID:** DOC-SEC-PERMISSIONS
**Status:** Policy specification with selected slice enforcement; `authorize()` is implemented for the fake development actor, while production authentication/session resolution remains unavailable and fails closed.
**Related:** `SECURITY.md` §3–§4, `OPERATORS.md`, `HQ.md`, ADR-0016, ADR-0031, NFR-SEC-007

---

## 1. Model

Authorization has **three independent layers**, and a request must satisfy all of them:

```text
authorize(actor, action, subject, scope) → ALLOW | DENY(reasonCode)
```

| Layer | Meaning | Where enforced |
| --- | --- | --- |
| **Role** | Coarse capability set (this document) | `authorize()` in `src/server/auth` |
| **Scope** | `org` · `region` · `area` · `stall` · `self` — resolved from the session, never from the request body | `authorize()` + repository signature (INV-14) |
| **Object / field** | Ownership, tenancy and sensitive-field masking | Repository methods + serializers |

Rules that never bend:

1. Every mutating use case calls `authorize()` **before** loading business state.
2. Every repository method takes an explicit `Scope`; an unscoped query cannot be written (INV-14).
3. Denials are audited as `authz.denied` with actor, action, subject, scope and correlation id (FR-AUDIT-005).
4. A missing or ambiguous scope is a **DENY**, never a fallback to a wider scope.
5. Authorization is server-side only. Hiding a button is a UX affordance, never a control.

## 2. Roles

| Role | Who | Base scope | Landing surface |
| --- | --- | --- | --- |
| `OWNER` | Network owner | `org` | HQ dashboard headline + exceptions |
| `HQ_OPS` (HQ Operations) | Operations team | `org` (area filters) | Coverage, assignments, incidents, alerts |
| `HQ_FINANCE` | Finance team | `org` (money fields) | Verification backlog, expense review, variance, settlement |
| `MENU_PRICING_ADMIN` | Catalog and pricing admin | `org` | Menu, availability, price policies |
| `AREA_SUPERVISOR` | Area supervisor | `area` (assigned areas) | Team status, approvals, incidents, handovers |
| `OPERATOR` (Stall Operator) | Penjual | `self` + assigned stalls | Operator PWA |
| `STOCK_WAREHOUSE_OPERATOR` | Warehouse / dapur | `region`/`area` for stock only | Restock queue, issues, transfers |
| `AUDITOR` | Internal/external auditor | `org` **read-only** | Audit search, reconstruction, exports |
| `PLATFORM_ADMIN` | Platform administrator | `org` (technical) | Flags, jobs, integrations, health — **no business data authority** |
| *(Customer)* | Buyer | none | No account; optional consented loyalty record only |

Notes:

- `PLATFORM_ADMIN` can operate the system but must not be able to approve money, verify payments,
  or alter business records. Technical power is not business authority (segregation of duties).
- A user may hold several roles; capabilities are the union, and each action is still scope-checked.

## 3. Capability matrix (by domain)

Legend: **F** = full within scope · **R** = read only · **A** = approve/review only · **S** = self/own records · **—** = denied.

| Capability / action | OWNER | HQ_OPS | HQ_FINANCE | MENU_PRICING | SUPERVISOR | OPERATOR | WAREHOUSE | AUDITOR | PLATFORM_ADMIN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Operator registry (`operator:manage`) | F | F | — | — | A (own area) | — | — | R | — |
| Assignment management (`assignment:manage`) | F | F | — | — | F (own area) | — | — | R | — |
| Stall registry (`stall:manage`) | F | F | — | — | A (own area) | — | R | R | — |
| Location registry & status (`location:manage`) | F | F | — | — | A (own area) | R (propose) | R | R | — |
| Start / suspend shift (`shift:start`, `shift:suspend`) | — | — | — | — | R | S | — | R | — |
| Handover (`shift:handover`) | — | — | — | — | A (confirm) | S (confirm) | — | R | — |
| Selling-point location report (`location:report`) | — | R | — | — | R | S | — | R | — |
| Traffic sample view/create (`traffic-sample:view`, `traffic-sample:create`) | — | — | — | — | — | S | — | — | — |
| Raw one-shot GPS sample on Page 10 (`location:view`, self-owned open report only) | — | — | — | — | — | S | — | — | — |
| Create / void sale (`sale:create`, `sale:void`) | — | — | — | — | R | S | — | R | — |
| Cash payment (`payment:cash`) | — | — | — | — | R | S | — | R | — |
| Digital payment create (`payment:digital`) | — | — | R | — | R | S | — | R | — |
| **Verify / reconcile payment (`payment:reconcile`)** | A | — | **F** | — | — | — | — | R | — |
| Refund (`payment:refund`) | A | — | F | — | — | — | — | R | — |
| Submit expense (`expense:submit`) | — | — | — | — | S | S | S | R | — |
| **Review expense (`expense:review`)** | A | — | **F** | — | A (≤ threshold, own area) | — | — | R | — |
| Stock movement / count (`stock:report`) | — | R | R | R | A | S | F | R | — |
| Restock issue / transfer (`stock:transfer`) | — | A | — | — | A | S (request) | F | R | — |
| Price policy (`price:manage`) | A | R | A (margin review) | **F** | R | R | — | R | — |
| Override request (`price:override` request) | — | — | R | — | A | S (if mode allows) | — | R | — |
| Price acknowledgement (`price:acknowledge`) | — | — | — | — | R | S | — | R | — |
| Menu & availability (`menu:manage`) | A | A | — | **F** | R | R | — | R | — |
| Incident submit (`incident:submit`) | — | F | — | — | F | S | S | R | — |
| Incident resolve (`incident:resolve`) | A | F | — | — | F (own area) | — | — | R | — |
| Loyalty identify/redeem | — | — | R | — | R | S | — | R | — |
| Loyalty programme config (`loyalty:manage`) | A | A | A | — | — | — | — | R | — |
| HQ reads (`hq:read`) | F | F | F (money) | F (catalog) | F (own area) | S | R | R | — |
| Export (`hq:export`) | F | A | F | A | — | S (own data) | — | F (read-only) | — |
| Audit read (`audit:read`) | F | A (own area) | A (money) | A (catalog) | A (own area) | S (own records) | — | **F** | — |
| Config & thresholds (`config:manage`) | A | A | A | A | — | — | — | R | **F (technical only)** |
| Feature flags & integrations | A | — | A (money flags) | — | — | — | — | R | **F** |
| Jobs, retention, DSAR execution (`privacy`) | A | — | A | — | — | — | — | R | **F (execution only, audited)** |

## 4. Field-level masking

| Field | Rule |
| --- | --- |
| Operator phone number | Full number visible to the operator (self), their supervisor; masked (`+62 812••••789`) for other roles |
| Customer phone hash / loyalty id | Never displayed to operators; Finance/Owner see a pseudonymous id, never the raw identifier |
| Evidence photos (expense, incident) | Only roles in the review path (submitter, supervisor, HQ_FINANCE/HQ_OPS, AUDITOR) with short-lived signed URLs |
| Selling-point coordinates | Available only to operationally scoped roles that need them |
| Raw Page 10 GPS sample (latitude/longitude, accuracy, capture time) | Returned only to the owning operator for their own open-shift report; excluded from HQ map/read models, analytics, audit summaries and logs; scrubbed within 14 days per ADR-0039 / R-25 |
| Page 11 raw traffic video | Private first-party ingestion service only; no HQ, supervisor, auditor, analytics or training access; raw media and replicas are purged within 24 hours (ADR-0040 / R-26) |
| Page 11 manual count/band result | Stored without operator or shift identifiers; operational read models expose only approved aggregate views; never use for individual performance or discipline (ADR-0040 / R-27) |
| Audit before/after summaries | Field-minimised at write time; never a shadow copy of personal data |
| Payment provider references | Visible to HQ_FINANCE and AUDITOR; masked elsewhere |

## 5. Segregation of duties

| Pair | Rule | Enforcement |
| --- | --- | --- |
| Expense submitter vs reviewer | Reviewer ≠ submitter where the submitter also holds review rights | Check in `reviewExpense` + audit (`expense.reviewed`) |
| Payment reconciliation vs till operation | `payment:reconcile` is Finance-only; operators can never verify their own digital payments | Role separation + scope check |
| Price approver vs override beneficiary | Repeated self-approved overrides in one area are flagged for review | Pattern flag → human review, never automatic action |
| Threshold configurer vs variance approver | Relaxing a threshold and then approving the same period's variance by the same person is flagged | Audit correlation job (read-only, human-reviewed) |
| Platform admin vs business data | `PLATFORM_ADMIN` cannot approve money, verify payments or edit business records | Capability matrix above |
| Recognition reviewer vs candidate | A reviewer cannot award themselves or their own stall's operator | Reviewer ≠ candidate check + recorded reviewer id |

## 6. Session, device and revocation

- Sessions are server-side and revocable; device revocation is supported per device (NFR-SEC-010).
- HQ roles with money authority require a second factor once authentication exists (NFR-SEC-003).
- Idle timeout for HQ roles is shorter than for the operator app; the operator app has a documented
  offline grace window (NFR-OFFLINE-009), during which local recording continues but **no**
  authorization decision is made locally for anything money-critical (server remains authoritative).
- Lost device ⇒ revoke device + wipe the local queue attempt; the wipe outcome is audited.

## 7. Denials, errors and enumeration

- A denial returns `403 FORBIDDEN` with a plain message; the response never discloses whether a
  record exists outside the actor's scope (`404` is used where existence itself is sensitive).
- Denials emit an audit row and a metric (`authz.denied`) grouped by action — investigated as a
  security signal, never as an individual performance signal.
- Repeated denials from one actor trigger a security alert (not a business alert) per `RUNBOOK.md`.

## 8. Tests and remaining authorization coverage

Page 10 proves operator self-scope, same-organization ownership, cross-operator shift-write denial,
area-bound selling-point choices, and coarse event-route authorization in
`tests/integration/location-api.test.ts`. The repository-wide role × route matrix remains incomplete:
production auth sessions are unavailable in this checkout, and every unimplemented route still needs
its own allow/deny, cross-tenant, and audited-denial evidence. A route without a matrix row remains a defect.
