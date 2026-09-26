# ROADMAP — Vertical Slices

**Document ID:** DOC-ROADMAP
**Status:** Phase 0 (plan; **do not execute**)
**Related:** `TASKS.md`, `ARCHITECTURE.md`, `docs/architecture/FINAL-REVIEW.md`

---

## 1. Slicing philosophy

Each slice is a **thin vertical cut** that is demonstrable end-to-end (device → API → database →
HQ) and leaves the system honest and consistent. We do not build horizontal layers
("all repositories, then all UI"). We build one operator-visible capability at a time, then
harden it.

Rules for every slice:

1. Offline behaviour is designed **in the slice**, not retrofitted later.
2. Money invariants are proven by database constraints when the slice lands.
3. Every slice ends with its `docs/TRACEABILITY.md` rows complete.
4. A slice may not add a library that contradicts `docs/research/STACK-2026.md` without an ADR.
5. Slices ship behind flags; nothing reaches production unsliced.

---

## 2. Slice catalogue

| Slice | Name | Outcome (demonstrable) | Primary requirements | Tasks |
| --- | --- | --- | --- | --- |
| **VS-0** | Foundation | Repo skeleton, tooling, design tokens, money/time primitives, audit + idempotency infrastructure, auth port shell | NFR-OPS-*, NFR-SEC-004, FR-AUDIT-001 | T-FOUND-001..006 |
| **VS-1** | Operators + Stalls | HQ can register operators, stalls, assignments; permissions enforced | FR-OPERATOR-*, FR-STALL-*, NFR-SEC-002 | T-OP-001..002, T-STALL-001..002, T-AUTHZ-001 |
| **VS-2** | Selling Locations | Regions/areas/selling points managed; operator can see assigned locations | FR-LOCATION-001..003, FR-LOCATION-009 | T-LOC-001..003 |
| **VS-3** | Shift Start + Location Reporting | **First end-to-end value:** operator starts shift, reports mangkal location, HQ sees the active stall | FR-SHIFT-001..005, FR-LOCATION-004..008 | T-SHIFT-001..002, T-LOC-004..005, T-OFF-001, T-HQ-001 |
| **VS-4** | Menu + Pricing | Menu catalog with location-aware prices; operators acknowledge price changes | FR-MENU-*, FR-PRICE-* | T-MENU-001..002, T-PRICE-001..004 |
| **VS-5** | Cash Sales | Fast POS; cash sale with immutable price snapshot; offline replay | FR-SALE-001..009, FR-CASH-001..003 | T-SALE-001..004 |
| **VS-6** | Digital Payment Abstraction | Payment port + fake adapter; static QRIS recorded as pending-verification; webhook verification skeleton | FR-PAYMENT-001..016 | T-PAY-001..004 |
| **VS-7** | Expenses | Field expense capture with neutral categories; HQ review workflow; evidence uploads | FR-EXPENSE-001..014 | T-EXP-001..004 |
| **VS-8** | Stock | Stock catalog, movements, shift snapshots, variance with reasons, alerts, transfers | FR-STOCK-001..012 | T-STOCK-001..004 |
| **VS-9** | Shift Closing + Reconciliation | Expected vs actual cash; variance handling; offline closing; day roll-up | FR-SHIFT-006..010, FR-SETTLE-001..007 | T-CLOSE-001..004 |
| **VS-10** | HQ Dashboard | Ten cards with freshness, exception queues, drill-down | FR-HQ-001..014 | T-HQ-002..003 |
| **VS-11** | Loyalty | Consent-first identification; single-use rewards; no points algorithm until ADR | FR-LOYALTY-001..012 | T-LOY-001..003 |
| **VS-12** | Communication + Alerts | Operational messaging threads, alert catalogue, ack tracking | FR-COMM-*, FR-NOTIF-* | T-COMM-001..002, T-ALERT-001 |
| **VS-13** | Incidents | Incident capture offline, lifecycle, escalation, evidence | FR-INC-001..010 | T-INC-001..002 |
| **VS-14** | Operator Performance | Contextual metrics, normalisation, operator-visible breakdown | FR-PERF-001..010 | T-PERF-001..002 |
| **VS-15** | Operator Recognition | Transparent multi-factor recognition with review and overrides | FR-RECOG-001..008 | T-REC-001..002 |
| **VS-16** | Offline Hardening | Outbox v2, quarantine tooling, conflict UX, service worker (Serwist), stale-data policy enforcement | NFR-OFFLINE-* | T-OFF-002..004 |
| **VS-17** | Security + Finance Hardening | Real auth (Better Auth), 2FA for finance, retention jobs, reconciliation maturity, rate limits | NFR-SEC-*, NFR-PRIVACY-007/008 | T-SEC-001..003, T-OPS-001 |
| **VS-18** | Observability | OTel pipeline, dashboards, SLOs, runbook linking, alert routing | NFR-OBS-* | T-OBS-001..002 |
| **VS-19** | Production | Deployment pipeline, migrations, backups/restore drill, go-live runbook, pilot rollout | NFR-REL-*, NFR-OPS-* | T-OPS-002..004 |

**Total vertical slices: 20 (VS-0 … VS-19).** No slice is executed in Phase 0.

---

## 3. Dependency graph

```text
VS-0 Foundation
  └─► VS-1 Operators+Stalls
        └─► VS-2 Locations
              └─► VS-3 Shift Start + Location  ◄── FIRST VALUE
                    └─► VS-4 Menu+Pricing
                          └─► VS-5 Cash Sales
                                ├─► VS-6 Digital Payments
                                └─► VS-7 Expenses ──┐
                                                    ├─► VS-9 Closing
                                └─► VS-8 Stock ─────┘
                                      └─► VS-10 HQ Dashboard
                                            ├─► VS-11 Loyalty
                                            ├─► VS-12 Communication + Alerts
                                            ├─► VS-13 Incidents
                                            ├─► VS-14 Performance ─► VS-15 Recognition
                                            └─► VS-16 Offline Hardening
                                                  └─► VS-17 Security + Finance Hardening
                                                        └─► VS-18 Observability
                                                              └─► VS-19 Production
```

Parallelisable: VS-11/12/13/14 can run alongside VS-16 once VS-10 is stable.

---

## 4. The first future vertical slice pipeline (explicit)

Architecture must first prove:

```text
Operator
  ↓
Start Shift
  ↓
Select Stall
  ↓
Report Mangkal Location
  ↓
HQ Sees Active Stall
```

Then:

```text
Menu
  ↓
Local Price
  ↓
Sale
  ↓
Cash Payment
  ↓
Shift Sales Total
```

Then:

```text
Expense
   ↓
Closing
   ↓
Cash Reconciliation
```

**Digital payment comes only after the transaction domain is stable.**

---

## 5. What we deliberately do NOT schedule

| Not scheduled | Why |
| --- | --- |
| Native mobile apps | PWA first (ADR-0005) |
| Kubernetes / multi-region | Operational cost ≫ benefit (ADR-0001, ADR-0024) |
| Kafka / event bus | No independent consumer (ADR-0018) |
| ML/AI scoring features | Ethics + explainability (ADR-0029) |
| Route optimisation / dispatch | Product non-goal |
| Customer ordering app | Product non-goal |
| Accounting/ledger module | Product non-goal |
| Continuous GPS | Privacy (ADR-0007) |
| WhatsApp integration in core flows | Optional channel only (ADR-0021) |
