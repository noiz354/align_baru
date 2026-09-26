# Entity Catalogue

**Document ID:** DOC-DOMAIN-ENTITIES
**Status:** Phase 0 specification (aggregate map and invariants are in `DOMAIN.md`; storage verdicts in `DATA_MODEL.md`)
**Related:** `DOMAIN.md`, `DATA_MODEL.md`, `GLOSSARY.md`, `STATE_MACHINE.md`, `EVENTS.md`, `ARCHITECTURE.md` §5

---

## 1. How to use this catalogue

Each entity lists: what it *is*, its identity (ADR-0032), the lifecycle document that governs it, who
owns the operations around it, and the task that will build it. Nothing here is implemented; the
skeleton types live in `src/domain/*` and `src/features/*`.

## 2. Reference and organisational entities

| Entity | Identity | Governed by | Owner role | Task |
| --- | --- | --- | --- | --- |
| `Organization` | UUIDv7 | ADR-0031 (every table scoped) | Platform admin + Owner | T-FOUND-001 |
| `Region` / `Area` | UUIDv7 + business code | `HQ.md`, `LOCATIONS.md` | HQ Ops | T-LOC-003 |
| `Stall` | UUIDv7 + code (`ST-014`) | `STALLS.md` (ST-INV-01…06) | HQ Ops | T-STALL-001 |
| `SellingLocation` (selling point / mangkal spot) | UUIDv7 + code | `LOCATIONS.md` | HQ Ops, supervisor proposes | T-LOC-001/002 |
| `Operator` | UUIDv7 | `OPERATORS.md` | HQ Ops + supervisor | T-OP-001/002 |
| `OperatorAssignment` | UUIDv7 | `OPERATORS.md` (PRIMARY/RELIEF/TEMPORARY/TRAINEE_ACCOMPANIED) | Supervisor | T-STALL-002 |
| `MenuItem` / `StockItem` / expense & incident categories | UUIDv7 | ADR-0025 (configuration, never code) | Menu/Pricing admin, Ops | T-MENU-001, T-STOCK-001 |
| `PricePolicy` | UUIDv7 + provenance | `PRICING.md`, ADR-0008 | Menu/Pricing admin (+ approver) | T-PRICE-001 |
| `ThresholdConfig` | UUIDv7 + version | `HQ.md` §config | HQ Finance/Ops (audited) | T-HQ-002 |

## 3. Operational entities

| Entity | Identity | Lifecycle | Cash relevance | Task |
| --- | --- | --- | --- | --- |
| `Shift` | UUIDv7 + `clientShiftId` | `STATE_MACHINE.md` §Operator Shift | **Root of cash accountability**; opening cash, expected cash, closing | T-SHIFT-001/002, T-CLOSE-001/003 |
| `Handover` | UUIDv7 | `STATE_MACHINE.md` §Handover | Moves accountability and carry-over cash with dual confirmation | T-CLOSE-002 |
| `LocationReport` | UUIDv7 + `clientReportId` | `LOCATIONS.md`, ADR-0007 | Context for sales; never a trace | T-LOC-004/005 |
| `Sale` | UUIDv7 + `clientSaleId` | `SALES.md` (DRAFT → COMPLETED → VOIDED/CORRECTED) | Immutable lines with price snapshots | T-SALE-001/004 |
| `SaleLine` | UUIDv7 | `SALES.md` | Immutable `unitPriceSnapshot` + policy provenance | T-SALE-001 |
| `Payment` | UUIDv7 + `clientPaymentId` | `STATE_MACHINE.md` §Payment | Cash completes a sale; digital claims wait for verification | T-SALE-002, T-PAY-002 |
| `PaymentAttempt` | UUIDv7 | `PAYMENTS.md` | Retry history for digital payments | T-PAY-001 |
| `Reconciliation` | UUIDv7 | `PAYMENTS.md`, `docs/payments/QRIS.md` | The only manual path to `PAID` (Finance + evidence + reason) | T-PAY-004 |
| `Expense` | UUIDv7 + `clientExpenseId` | `STATE_MACHINE.md` §Expense, ADR-0027 | Cash-box outflow or personal payable; neutral categories | T-EXP-001/002 |
| `StockMovement` | UUIDv7 + `clientMovementId` | `INVENTORY.md`, ADR-0030 | Append-only; positions derived | T-STOCK-001 |
| `StockCount` | UUIDv7 | `INVENTORY.md` | Expected vs counted; reason incl. `UNKNOWN`; `UNCOUNTED` allowed | T-STOCK-002 |
| `Incident` | UUIDv7 + `clientIncidentId` | `INCIDENTS.md` | Never an automatic judgement of a person | T-INC-001/002 |
| `OperationalRequest` / message thread | UUIDv7 | `COMMUNICATION.md` | Anchored to records; not a chat product | T-COMM-001 |

## 4. Customer and people entities

| Entity | Identity | Rules | Task |
| --- | --- | --- | --- |
| `LoyaltyAccount` | UUIDv7, pseudonymous | Consent required; separate store from operator data; deletion pipeline | T-LOY-001 |
| `LoyaltyTransaction` | UUIDv7 | Rules-versioned; bounded liability | T-LOY-002 |
| `RewardInstance` | UUIDv7 | Single-use, enforced by unique constraint (INV-07) | T-LOY-003 |
| `OperatorPerformanceSnapshot` | UUIDv7 | Candidate inputs only; no scoring algorithm in this phase | T-PERF-001/002 |
| `RecognitionPeriod` / `RecognitionAward` | UUIDv7 + period key | Published weights, sample gates, human review, appeal path | T-REC-001/002 |

## 5. Control entities (the paper trail)

| Entity | Identity | Rules | Task |
| --- | --- | --- | --- |
| `AuditEvent` | UUIDv7, append-only | Commits with the business change; UPDATE/DELETE revoked (INV-10) | T-FOUND-003 |
| `IdempotencyRecord` | key + organization + route | Unique per (organization, route, key) (INV-15) | T-FOUND-004 |
| `DailyClosing` (HQ) | UUIDv7 + business day | Immutable once accepted; corrections are new records (INV-09) | T-CLOSE-001/004 |
| `Alert` / `Notification` | UUIDv7 | Resolution is a human action; no money state depends on delivery | T-ALERT-001 |
| `OutboxRecord` (client) / sync batch result | UUIDv7 client id | Per-record outcomes; quarantine, never drop | T-OFF-001/003 |
| `EvidenceAsset` | UUIDv7 + storage key | Presigned access, short-lived retention | T-EXP-004 |

## 6. Deliberately absent entities

No general ledger or journal, no fraud score, no route plan, no attendance/geo-fence record, no
customer purchase profile, no operator rating, no chat channel, no payroll record, and no
"permission status" object asserting anything about a location's legality (FR-LOCATION-009). This list
is as important as the tables above: each absence is a decision recorded in `DOMAIN.md` §5.
