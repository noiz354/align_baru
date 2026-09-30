# DATA MODEL

**Document ID:** DOC-DATA-MODEL
**Status:** Phase 0 — entity investigation and minimal core model (**no schema implemented**)
**Related:** `DOMAIN.md`, `DOMAIN` invariants, `docs/adr/ADR-0032-identifier-strategy.md`, `RETENTION.md`

---

## 1. Method

We first enumerate every entity the product statement suggests, then **ruthlessly subtract**.
Each entity below is labelled:

- **CORE** — needed in the first six vertical slices (operator → location → shift → menu/price → cash sale → expense → closing).
- **EXTEND** — needed later, modelled now only in interfaces.
- **DEFER** — plausible but not modelled at all in Phase 0.
- **DROP** — considered and rejected, with reason.

Target: a compact, auditable core. A model with 60 tables nobody can explain is worse than
one with 24 tables each of which has an invariant attached.

---

## 2. Entity investigation

| Entity | Verdict | Notes |
| --- | --- | --- |
| Organization | CORE | Tenant root. Every table carries `organization_id`. |
| Region | CORE | Geographic grouping (Jakarta, Bandung…). |
| Area | CORE | Supervisor scope; owns selling points. |
| Operator | CORE | Person + status + contract type. |
| OperatorAssignment | CORE | Operator ↔ stall ↔ area with validity window. |
| Stall | CORE | Vending asset. |
| StallEquipment | EXTEND | Simple list; low risk. |
| SellingLocation (SellingPoint) | CORE | Mangkal point. |
| LocationAssignment / LocationReport | CORE | Per-shift location reports (history = the report list). |
| Shift | CORE | Central unit of accountability. |
| ShiftHandover | EXTEND | Mid-day transfer record. |
| ShiftClosing | CORE | Closing submission (later slice, modelled now). |
| MenuItem | CORE | Configurable catalog. |
| MenuCategory | CORE | Category grouping. |
| MenuAvailability | EXTEND | Per-location availability (later slice). |
| PricePolicy | CORE | Scoped price rules. |
| PriceOverride | EXTEND | Operator/supervisor temporary override. |
| PriceAcknowledgement | CORE | Operator ack of a price version. |
| Sale | CORE | Transaction. |
| SaleItem | CORE | Line with snapshot price. |
| SaleAdjustment | EXTEND | Discounts/packages as explicit adjustments. |
| Payment | CORE | Method, amount, status. |
| PaymentAttempt | EXTEND | Retries per payment (mostly provider-driven). |
| PaymentCallback | EXTEND | Raw verified provider callbacks (dedupe key). |
| PaymentReconciliation | EXTEND | Manual HQ matching. |
| Expense | CORE | Field expense with neutral category + review status. |
| ExpenseEvidence | OPTIONAL | Object-storage reference. |
| ExpenseReview | EXTEND | Review decisions and flags. |
| StockItem | CORE | Configurable stock catalog. |
| StockMovement | CORE | Append-only movement ledger. |
| StockSnapshot | CORE | Start/end counts per shift (derived + counted). |
| StockTransfer | EXTEND | Warehouse issuance with acknowledgement. |
| Customer | EXTEND | Only for loyalty; optional identity. |
| LoyaltyAccount | EXTEND | Identified by phone / QR token / device token. |
| LoyaltyTransaction | EXTEND | Earn/redeem records (no algorithm in Phase 0). |
| Reward | EXTEND | Definition. |
| RewardInstance | EXTEND | Single-use entitlement (anti-double-redeem). |
| Incident | EXTEND | Report + lifecycle. |
| IncidentEvidence | OPTIONAL | Photos. |
| Message | EXTEND | Operational message, threaded. |
| MessageThread | EXTEND | Topic binding (area/stall/shift/incident). |
| OperationalAlert | EXTEND | Actionable alert objects. |
| OperatorMetric | EXTEND | Snapshots per period (reproducible). |
| RecognitionPeriod | EXTEND | Weights + scope + status. |
| RecognitionResult | EXTEND | Ranked factors + override trail. |
| AuditEvent | CORE | Append-only. |
| IdempotencyRecord | CORE | Replay protection. |
| OutboxEvent | CORE | Job/notification dispatch reliability. |
| ReadModelDailyAreaSales | EXTEND | HQ card support. |
| Device | OPTIONAL | Device label for audit; no hardware fingerprinting. |
| Session | DEFER | Owned by the auth library when implemented. |
| Route/DispatchPlan | **DROP** | Product non-goal (route optimisation). |
| LedgerAccount/JournalEntry | **DROP** | Not an accounting system. |
| FraudScore | **DROP** | Explicitly not doing hidden scoring. |
| GeoLocationPing (continuous) | **DROP** | Privacy: no continuous tracking (ADR-0007). |
| PermissionStatusOfLocation | **DROP** | Do not record assumed official permission (FR-LOCATION-010). |

---

## 3. Minimal core model (Phase-1 target)

Field lists are indicative; every table also has: `id` (UUIDv7), `organization_id`,
`created_at`, `created_by`, `updated_at`, `updated_by`, and where applicable
`business_day` (date, Asia/Jakarta).

```text
Organization(id, name, timezone='Asia/Jakarta', currency='IDR')

Region(id, organization_id, name, code)
Area(id, organization_id, region_id, name, code, supervisor_operator_id?)

Operator(id, organization_id, area_id, name, phone_e164, contract_type,
         training_state, status, started_on, active)

Stall(id, organization_id, area_id, code, type, status, notes)
OperatorAssignment(id, operator_id, stall_id, area_id, valid_from, valid_to,
                   assignment_type)

SellingLocation(id, organization_id, area_id, name, address_text, lat, lng,
                landmark, windows_json, usual_fee_note, status, notes)

Shift(id, organization_id, operator_id, stall_id, business_day,
      started_at, ended_at, start_location_id, end_location_id,
      opening_cash, status, planned_start_at?, planned_end_at?)
LocationReport(id, organization_id, shift_id, stall_id, operator_id, selling_location_id,
               arrived_at, departed_at, reason, note, client_report_id,
               optional gps_sample(latitude, longitude, accuracy_meters, captured_at); GPS fields expire under R-25)

MenuItem(id, organization_id, category_id, name, portion_note, active,
         stock_item_id?, is_component, sort_order)
MenuCategory(id, organization_id, name, sort_order)

PricePolicy(id, organization_id, menu_item_id, scope, scope_ref_id,
            amount_minor, currency, effective_from, effective_until,
            reason, created_by, approved_by)
PriceAcknowledgement(id, organization_id, operator_id, price_policy_id,
                     acknowledged_at, device_id?)

Sale(id, organization_id, shift_id, selling_location_id, operator_id, stall_id,
     business_day, occurred_at, server_accepted_at, total_minor, currency,
     status, client_sale_id, note)
SaleItem(id, organization_id, sale_id, menu_item_id, quantity,
         unit_price_minor, line_total_minor, price_policy_id?)

Payment(id, organization_id, sale_id, method, amount_minor, currency, status,
        paid_at?, verified_by, provider_reference?, evidence_ref?, verified_at?)
PaymentCallback(id, organization_id, payment_id?, provider, provider_reference,
                signature_valid, received_at, raw_payload_json, dedupe_key)

Expense(id, organization_id, shift_id, operator_id, selling_location_id?,
        category, amount_minor, currency, incurred_at, description, note,
        evidence_object_key?, review_status, flagged_reason?, reviewed_by?,
        reviewed_at?, client_expense_id)

ShiftClosing(id, organization_id, shift_id, submitted_at, opening_cash_minor,
             cash_sales_minor, cash_expenses_minor, expected_cash_minor,
             counted_cash_minor, cash_variance_minor, digital_expected_minor,
             digital_received_minor, stock_variance_json, notes, status,
             client_closing_id)

StockItem(id, organization_id, code, name, category, unit, active)
StockMovement(id, organization_id, stock_item_id, stall_id?, operator_id?,
              shift_id?, movement_type, quantity, unit_cost_minor?, occurred_at,
              reason, actor_id, client_movement_id)
StockSnapshot(id, organization_id, shift_id, stock_item_id, phase (START|END),
              counted_quantity, expected_quantity?, variance_quantity?, reason?)

TrafficSample(id, organization_id, selling_location_id, sampled_at_hour, estimated_count,
              traffic_band, note?, client_request_id, video_asset_id?, video_status)
TrafficVideoAsset(id, organization_id, selling_location_id, sample_id?, uploaded_at,
                  expires_at, content_type, byte_size, duration_ms, private_storage_key)

AuditEvent(id, organization_id, actor_id, actor_role, action, entity_type,
           entity_id, occurred_at, previous_value_json, new_value_json, reason,
           request_id, ip_hash?, user_agent?)
IdempotencyRecord(id, organization_id, route, idempotency_key, request_hash,
                  response_json, created_at, expires_at)
OutboxEvent(id, organization_id, event_type, payload_json, created_at,
            processed_at?, attempts, last_error?)
```

### Relationships that matter most

```text
Shift 1─* Sale 1─* SaleItem
Shift 1─* Expense
Shift 1─* LocationReport
Shift 1─1 ShiftClosing
Sale  1─1 Payment (MVP: exactly one active payment per sale; more later via PaymentAttempt)
StockItem 1─* StockMovement *─1 Shift (optional)
Operator 1─* Shift *─1 Stall
SellingLocation 1─* TrafficSample; TrafficSample 0..1─1 temporary TrafficVideoAsset
TrafficSample has no operator_id or shift_id; video metadata has no operator_id or shift_id
Everything *─1 Organization
```

---

## 4. Derived vs stored (explicit decisions)

| Value | Decision | Why |
| --- | --- | --- |
| Sale total | **Stored** (from snapshots) | Speed + immutability of history. Recomputation must equal stored value (test). |
| Stock position | **Derived** from movements (+ snapshots for reconciliation) | Prevents double-decrement bugs; movements are the ledger of goods. |
| Expected cash | **Stored at closing** (from the values in force at that time) | Closing is an assertion about a moment; it must not change later. |
| Digital expected settlement | **Stored at closing**, reconciled later | Settlement arrives later than closing. |
| Location history | **Derived** from `LocationReport` rows | One source of truth; no separate history table to drift. |
| Operator metrics | **Stored snapshots**, reproducible | Reproducibility from facts is an NFR (FR-PERF-010). |
| Price effective now | **Derived** by resolution (never stored as "current price") | Avoids a hidden second source of truth. |

---

## 5. Money, time, and identity in the model

- **Money:** `*_minor` integer columns + explicit `currency` where a value could theoretically
  cross currencies. Payment amounts stored as integers; provider decimal strings converted at
  the adapter boundary only (`ADR-0006`).
- **Time:** `TIMESTAMPTZ` UTC everywhere; `business_day DATE` derived using the organization
  timezone with an explicit shift-cut rule (`ADR-0033`). A sale at 00:40 belongs to the
  previous business day.
- **Identity:** UUIDv7 primary keys; human codes (`STL-JKT-014`, `SHF-20260926-0031`) are
  separate, unique, and display-only (`ADR-0032`).
- **Client IDs:** every offline-creatable record carries a `client_*_id` used as the
  idempotency key, retained forever as an alias for reconciliation and audit.

---

## 6. Storage, indexing, and retention sketch (no migrations in Phase 0)

| Concern | Approach |
| --- | --- |
| Hot path indexes | `(organization_id, business_day)`, `(shift_id)`, `(operator_id, business_day)`, unique `(organization_id, client_sale_id)` |
| Partial unique indexes | One active shift per operator/stall (`status IN ('OPEN','ACTIVE','PAUSED','CLOSING')`) |
| Payment dedupe | unique `(provider, provider_reference)`; unique `(organization_id, dedupe_key)` on callbacks |
| Audit | Append-only; index on `(entity_type, entity_id, occurred_at)` and `(actor_id, occurred_at)` |
| Raw payloads | `jsonb` (callbacks) with size guard; encrypted at rest at the platform level |
| Retention | See `RETENTION.md`; audit + financial records kept longest, evidence shortest; raw traffic media ≤24 hours and sample rows provisionally 90 days |
| Archival | Partition-by-business-day or archive tables once volumes justify; triggers documented in `OPERATIONS.md` |
| PII | Operator phone, customer phone/token: minimised, access-scoped, masked in logs and exports by default |

---

## 7. What we will *not* store

1. Continuous position history (only shift-bound reported positions).
2. Customer data beyond what loyalty requires (no names required, no addresses, no ID numbers).
3. Payment credentials/card data of any kind.
4. Hardware fingerprints beyond an optional device label.
5. Assumed legal/permission status of a selling point.
6. Free-text fields that encourage guessing about who was paid in a field expense; the
   description field is for the operator's own words, not for investigators' conclusions.
