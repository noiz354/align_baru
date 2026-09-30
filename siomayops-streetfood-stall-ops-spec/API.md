# API — Contract Catalogue

**Document ID:** DOC-API
**Status:** Contract catalogue with selected implemented vertical slices; handler status is documented per slice.
**Base path:** `/api/v1` · **Format:** JSON over HTTPS · **Auth:** session cookie (planned)
**Related:** `ARCHITECTURE.md` §6, `OFFLINE.md`, `EVENTS.md`, ADR-0013, ADR-0014, ADR-0034

---

## 0. Global contract rules

| Rule | Detail |
| --- | --- |
| Versioning | Path version `/api/v1`. Breaking changes ⇒ `/api/v2` alongside for one deprecation window. Additive fields are non-breaking. |
| Content type | `application/json; charset=utf-8`; uploads via pre-signed URLs, not multipart through the API. |
| Authentication | Session cookie (HttpOnly, Secure, SameSite=Lax) issued by the auth library. Phase 0: none implemented; `AuthPort` shell only. |
| Authorization | Every operation passes `authorize(actor, action, scope)`. Scope ∈ {org, region, area, stall, self}. Denials ⇒ `403 FORBIDDEN` + audit. |
| Idempotency | **All** mutating endpoints require `Idempotency-Key`. Replay returns the original response with `idempotentReplay: true`. |
| Client IDs | Offline-creatable records send their `client*Id`; the server stores it as a unique alias and uses it for reconciliation. |
| Concurrency | Mutations on versioned aggregates send `If-Match: <version>`; mismatch ⇒ `409 CONFLICT` with current state. |
| Money | `{ "amountMinor": 32000, "currency": "IDR" }`. Never floats. Never provider decimal strings at this boundary. |
| Time | ISO-8601 UTC with `Z`. Business day is `YYYY-MM-DD` (Asia/Jakarta) and is **server-derived**. |
| Errors | Envelope: `{ error: { code, message, messageId (localisation key), details?, requestId, retryable } }`. |
| Rate limits | Per identity and per IP; stricter for auth, payment, loyalty redeem, exports. `429` with `Retry-After`. |
| Audit | Every mutating operation emits ≥ 1 audit event; money-affecting ones require a `reason` field where specified. |
| Tracing | `X-Request-Id` (accepted or generated), `traceparent` (W3C) propagated. |
| Pagination | Cursor-based: `?limit=&cursor=`; responses include `nextCursor`. No offset paging on mutable money data. |
| Offline | Every endpoint marked **[OFFLINE-OK]** may be replayed from the device outbox; the server treats replays as idempotent. |

### Error codes (canonical set)

`VALIDATION_FAILED` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` ·
`PRECONDITION_FAILED` · `RATE_LIMITED` · `IDEMPOTENCY_MISMATCH` · `INVALID_TRANSITION` ·
`STALE_DATA` · `PAYMENT_NOT_VERIFIED` · `PROVIDER_UNAVAILABLE` · `INTERNAL`

---

## 1a. `GET /operators/me/location` — Current Operator Location Context

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-LOCATION-004, FR-LOCATION-006, NFR-PRIVACY-011 |
| **Actor** | Operator (self only) |
| **Authentication** | Session required |
| **Authorization** | `location:view`; target is the session operator's self scope; only that operator's active shift and current-area selling points are returned |
| **Input** | None; organization, operator, shift, stall, and area are derived from the session and server records |
| **Output** | `{ generatedAt, gpsCaptureEnabled, activeShift?, currentLocation?, gpsSample?, locationChoices[] }`; precise GPS fields are returned only to the owning operator and only for their open report |
| **Validation** | No active shift returns explicit empty state; multiple active shifts return `409`; suspended/inactive operator cannot use the flow |
| **Caching** | `Cache-Control: private, no-store` |

## 1b. `POST /operators/me/location/events` — Page 10 Coarse Events

| Field | Value |
| --- | --- |
| **Actor / authorization** | Authenticated operator, `location:view`, self scope |
| **Input** | Strict enum-only event: `location_capture_started`, `location_permission_denied` with `reason=denied`, or client-observed `location_save_failed` with `reason=network` |
| **Output** | `{ accepted: true }` |
| **Privacy** | No coordinates, accuracy, capture time, outlet/operator/shift/report IDs, free text, or browser error string. A safe `location_page_viewed` event is emitted on successful context reads; server write outcomes are emitted separately. |

## 1. `POST /shifts` — Start Shift

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-SHIFT-001, FR-SHIFT-003, FR-SHIFT-016 |
| **Actor** | Food Stall Operator (self only) |
| **Authentication** | Session cookie required |
| **Authorization** | scope = `self`; operator status must not be `SUSPENDED`; stall must be in the operator's active assignment |
| **Input** | `{ operatorId, stallId, sellingLocationId, openingCash?: Money, startingStock: [{stockItemId, quantity}], priceSetAcknowledgedAt?, plannedShiftId?, clientShiftId, notes? }` |
| **Output** | `{ shiftId, businessDay, status: "OPEN", startedAt, stockSnapshotId, locationReportId, version }` |
| **Validation** | operator exists + active; stall exists + assignable; location exists + status not `RESTRICTED`/`INACTIVE`; `openingCash ≥ 0`; stock deltas same sign as quantity semantics; `clientShiftId` is UUIDv7 |
| **Errors** | `409 CONFLICT` (operator/stall already has an active shift) · `403 FORBIDDEN` (suspended or unassigned) · `422 VALIDATION_FAILED` · `412 PRECONDITION_FAILED` (location not available) |
| **Idempotency** | Required: `Idempotency-Key` = `clientShiftId` |
| **Rate limiting** | 10/min per operator; burst 3 |
| **Audit** | `ShiftStarted` audit event (actor, stall, location, opening cash) |
| **Offline** | **[OFFLINE-OK]** Shift may be started offline; queued with `clientShiftId`; server may reject on conflict (e.g. another device already started a shift) and the operator must be told precisely why |

## 2. `POST /shifts/{shiftId}/location-reports` — Select Location

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-LOCATION-004, FR-LOCATION-006, FR-LOCATION-011 |
| **Actor** | Operator (own shift) |
| **Authentication** | Session required |
| **Authorization** | `location:report`; shift must be `OPEN`/`PENDING_SYNC`, in the session organization, and owned by the session operator; the selling point must belong to the shift stall's area |
| **Input** | `{ sellingLocationId, trigger, reasonForMove?, note?, clientReportId, gpsSample?: { latitude, longitude, accuracyMeters, capturedAt } }`; GPS sample is optional, one-shot, advisory, and submitted only with this explicit report |
| **Output** | `{ locationReportId, gpsSampleStored }` |
| **Validation** | Selling point must exist in the session organization and not be `INACTIVE`; `MOVE_SITE` requires a reason; coordinates/accuracy are bounded and capture time must be within five minutes of server time; report actor is never client-supplied |
| **Errors** | `400 VALIDATION_FAILED` · `403 FORBIDDEN` (not your shift/outside operation area) · `404 NOT_FOUND` · `409 CONFLICT` · `412 PRECONDITION_FAILED` |
| **Idempotency** | Required: `Idempotency-Key` must equal `clientReportId`; report alias replay is also constrained to the same organization, operator, and shift |
| **Audit** | `location.reported` or `location.gps_sample_saved`; summaries omit coordinates and accuracy |
| **Retention** | GPS fields are scrubbed after 14 days by the current adapter on process start and Page 10 reads/writes. A reliable production scheduled purge and backup-expiry verification remain production gates (R-25). |
| **Offline** | Manual offline reports may use the existing sync path, but that path does not persist GPS samples; Page 10 does not durably queue raw GPS in the browser. |

## 3. `POST /shifts/{shiftId}/location-changes` — Change Location (move)

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-LOCATION-007, FR-LOCATION-008 |
| **Actor** | Operator (own shift) |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; shift `ACTIVE` or `PAUSED` |
| **Input** | `{ newSellingLocationId?, freeTextLocation?: { note, approxLat?, approxLng? }, reason: LocationUpdateReason, note?, reportedAt, clientReportId }` |
| **Output** | `{ reportId, closedPreviousReportId, newLocationId?, locationStatus, suggestedSupervisorNotice? }` |
| **Validation** | exactly one of `newSellingLocationId` / `freeTextLocation`; `reason` from controlled list (`CROWDED`, `ASKED_TO_MOVE`, `CLOSED`, `WEATHER`, `STOCK_OUT`, `BETTER_SPOT`, `OTHER`); free text length bounded |
| **Errors** | `422` (missing/invalid reason) · `409` (already moved to that location) · `403` |
| **Idempotency** | Required: `clientReportId` |
| **Rate limiting** | 20/min per operator |
| **Audit** | `LocationChanged` audit event with reason; previous interval closed |
| **Offline** | **[OFFLINE-OK]** Queued; HQ sees the move when synced, with the device-recorded time |

## 4. `POST /price-acknowledgements` — Acknowledge Price

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-PRICE-005, FR-PRICE-006, FR-PRICE-011 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; acknowledgement set must apply to actor's area/location |
| **Input** | `{ operatorId, pricePolicyIds: string[], acknowledgedAt, deviceLabel?, clientAckId }` |
| **Output** | `{ acknowledgedPolicyIds, remainingUnacknowledgedCount, effectivePriceDigest }` |
| **Validation** | every policy id exists and is currently effective for the actor's scope; digest must match a server-computed digest of the effective price set (prevents "acknowledged" without seeing) |
| **Errors** | `409 STALE_DATA` (prices changed since the client fetched — new digest returned) · `422` |
| **Idempotency** | Required |
| **Rate limiting** | 30/hour per operator |
| **Audit** | `PriceAcknowledged` audit event per policy version |
| **Offline** | **[OFFLINE-OK]** Acknowledgement may be queued but is only valid against the digest the operator actually saw; a stale acknowledgement is rejected so the operator is never credited with acknowledging a price they did not see |

## 5. `POST /sales` — Create Sale

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-SALE-001, FR-SALE-002, FR-SALE-003, FR-SALE-007 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; active shift on the referenced stall |
| **Input** | `{ shiftId, stallId, sellingLocationId, clientSaleId, occurredAt, items: [{ menuItemId, quantity, unitPriceMinor? }], payment: { method, amountMinor, cashReceivedMinor? }, note?, loyaltyRef? }` |
| **Output** | `{ saleId, status: "COMPLETED", total: Money, items: [{ menuItemId, quantity, unitPriceSnapshot, lineTotal }], payment: { paymentId, status }, priceResolvedFrom, stockEffectsPending: boolean }` |
| **Validation** | ≥1 item; quantity ≥ 1 and integer; items exist and are available at the location; if `unitPriceMinor` is supplied it must equal the server-resolved price (otherwise `409 STALE_DATA`); payment amount equals total unless overpayment is allowed for cash (then change is computed and returned) |
| **Errors** | `409 STALE_DATA` (price changed; response carries the new effective price) · `412` (shift not active) · `403` · `422` |
| **Idempotency** | Required: `clientSaleId` (unique per organization, permanent) |
| **Rate limiting** | 120/min per operator (generous — selling is fast) |
| **Audit** | `SaleCompleted` audit event; price snapshot provenance recorded (`price_policy_id`) |
| **Offline** | **[OFFLINE-OK]** Primary offline path. Snapshot is resolved **server-side at acceptance**; the client's displayed price is used only if it matches, and any mismatch is surfaced. The client may not author the snapshot |

## 6. `POST /sales/{saleId}/complete` — Complete Sale (payment resolution)

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-SALE-003, FR-PAYMENT-008, FR-PAYMENT-013 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; sale belongs to actor's shift and is not `VOIDED` |
| **Input** | `{ payment: { method, amountMinor, cashReceivedMinor?, qrisReferenceNote?, evidenceObjectKey? }, clientCompletionId }` |
| **Output** | `{ saleId, saleStatus, paymentId, paymentStatus, requiresVerification: boolean, changeMinor? }` |
| **Validation** | amount equals sale total (cash may exceed → change); method ∈ allowed set for the location; for `QRIS` without a gateway, `paymentStatus` **must** be returned as `PENDING_VERIFICATION` |
| **Errors** | `422 PAYMENT_NOT_VERIFIED` (attempt to claim verified digital payment) · `409` (sale already completed with a different payment) |
| **Idempotency** | Required |
| **Rate limiting** | 120/min per operator |
| **Audit** | `PaymentStarted` (+ `PaymentVerified` only when evidence exists) |
| **Offline** | **[OFFLINE-OK] for cash only.** Digital completion while offline is refused by the client and by the server: the API will never accept a client-asserted `PAID` |

## 7. `POST /payments/cash` — Record Cash Payment

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-CASH-001, FR-CASH-002, FR-CASH-003 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self` |
| **Input** | `{ saleId, amountMinor, cashReceivedMinor, clientPaymentId }` |
| **Output** | `{ paymentId, status: "PAID", changeMinor, shiftCashRunningTotal }` |
| **Validation** | integers only; `cashReceived ≥ amount`; change = received − amount computed server-side |
| **Errors** | `422` · `409` (sale already has a resolved payment) |
| **Idempotency** | Required: `clientPaymentId` |
| **Rate limiting** | 120/min |
| **Audit** | `PaymentCompleted` (method CASH, verifying actor = operator, evidence = cash count at closing) |
| **Offline** | **[OFFLINE-OK]** The canonical offline path; reconciliation with the shift's cash count happens at closing |

## 8. `POST /payments/digital` — Create Digital Payment

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-PAYMENT-001, FR-PAYMENT-004, FR-PAYMENT-013, FR-PAYMENT-015 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; provider must be enabled for the organization |
| **Input** | `{ saleId, method: "QRIS"|"BANK_TRANSFER"|"E_WALLET"|"OTHER_APPROVED_METHOD", amountMinor, providerHint?, clientPaymentId }` |
| **Output** | `{ paymentId, status: "PENDING", intent?: { qrString?, expiresAt?, providerReference? }, requiresOnlineVerification: boolean }` |
| **Validation** | method enabled for org/location; amount matches sale; no existing non-terminal payment for the sale |
| **Errors** | `503 PROVIDER_UNAVAILABLE` · `409` (existing pending payment) · `422` |
| **Idempotency** | Required |
| **Rate limiting** | 30/min per operator |
| **Audit** | `PaymentStarted`; provider request/response recorded raw (encrypted) |
| **Offline** | **NOT [OFFLINE-OK]** Digital payments require connectivity to create a verifiable payment; the operator may record a cash-equivalent placeholder only by switching method explicitly, and the UI must say so plainly |

## 9. `POST /webhooks/payments/{provider}` — Provider Callback (untrusted boundary)

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-PAYMENT-005, FR-PAYMENT-006, FR-PAYMENT-008, FR-PAYMENT-009 |
| **Actor** | External provider (untrusted) |
| **Authentication** | Signature header verification (HMAC/Ed25519 per provider spec) |
| **Authorization** | n/a — authorization is by verified signature + reference lookup |
| **Input** | raw body + signature headers (`X-Signature`, `X-Timestamp`, `X-External-Id`, provider-specific) |
| **Output** | `202 Accepted` (always, to prevent retry storms) with `{ received: true, duplicate: boolean }` |
| **Validation** | signature valid; timestamp within replay window; reference resolvable; amount+currency match the expected payment; idempotency by provider reference |
| **Errors** | Invalid signature ⇒ `401` **and** security audit + alert; unknown reference ⇒ `202` + investigation queue (never 500-loop) |
| **Idempotency** | Enforced by unique `(provider, provider_reference)` on callbacks |
| **Rate limiting** | High ceiling, IP-allowlisted where the provider publishes ranges |
| **Audit** | Raw payload + verification outcome stored; state change only on valid, non-duplicate, matching callbacks |
| **Offline** | n/a (server-to-server) |

## 10. `POST /expenses` — Submit Expense

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-EXPENSE-001, FR-EXPENSE-003, FR-EXPENSE-004 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; active shift (or HQ role with scope) |
| **Input** | `{ shiftId, sellingLocationId?, category, amountMinor, incurredAt, description?, note?, evidenceObjectKey?, clientExpenseId }` |
| **Output** | `{ expenseId, reviewStatus, includedInShiftTotals: boolean, cashImpact: "REDUCES_EXPECTED_CASH"|"NONE" }` |
| **Validation** | `amountMinor > 0`; category from configured list; `incurredAt` within shift ± tolerance; description bounded (no schema that asks *who* was paid) |
| **Errors** | `422` · `412` (no active shift and no HQ scope) |
| **Idempotency** | Required: `clientExpenseId` |
| **Rate limiting** | 30/min per operator |
| **Audit** | `ExpenseSubmitted`; later reviews emit their own events with reasons |
| **Offline** | **[OFFLINE-OK]** Queued; cash expenses reduce expected closing cash on the device immediately (clearly marked as pending sync) |

## 11. `POST /stock-reports` — Report Stock (count / adjustment)

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-STOCK-004, FR-STOCK-005, FR-STOCK-012 |
| **Actor** | Operator (own shift) or Warehouse operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self`/`stall`; shift active for count reports |
| **Input** | `{ shiftId, phase: "START"|"END"|"MID", items: [{ stockItemId, countedQuantity, expectedQuantity?, reason?, note? }], clientStockReportId }` |
| **Output** | `{ snapshotId, items: [{ stockItemId, varianceQuantity, varianceBand, reasonRequired: boolean }], alerts }` |
| **Validation** | quantities ≥ 0 and integral where the unit is discrete; `reason` required when |variance| > tolerance; reason ∈ configured set (incl. `UNKNOWN`) |
| **Errors** | `422` (missing reason for out-of-tolerance variance) · `412` |
| **Idempotency** | Required |
| **Rate limiting** | 30/min |
| **Audit** | `StockAdjusted`/snapshot recorded with actor and reason |
| **Offline** | **[OFFLINE-OK]** Counts are queued; expected quantities are recomputed server-side; the UI must show "count recorded on device" until accepted |

## 12. `POST /restock-requests` — Request Restock

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-STOCK-009 |
| **Actor** | Operator |
| **Authentication** | Session required |
| **Authorization** | scope = `self` |
| **Input** | `{ stallId, requestedForDate, items: [{ stockItemId, requestedQuantity }], urgency, note?, clientRequestId }` |
| **Output** | `{ requestId, status: "REQUESTED", plannedIssuanceAt? }` |
| **Validation** | quantities > 0; stall belongs to actor's area; urgency ∈ {NORMAL, TODAY, URGENT} |
| **Errors** | `422` · `403` |
| **Idempotency** | Required |
| **Rate limiting** | 10/hour per operator |
| **Audit** | `RestockRequested` |
| **Offline** | **[OFFLINE-OK]** Queued; urgency upgrade while offline is preserved by device timestamps |

## 13. `POST /shifts/{shiftId}/closing` — Close Shift / Submit Daily Closing

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-SHIFT-006, FR-SHIFT-008, FR-SETTLE-001..006, FR-CASH-005, FR-CASH-006 |
| **Actor** | Operator (own shift); HQ Finance for corrections |
| **Authentication** | Session required |
| **Authorization** | scope = `self`/`finance`; shift in `CLOSING` |
| **Input** | `{ countedCashMinor, stockCounts: [{ stockItemId, countedQuantity, reason? }], notes?, varianceReason?, digitalReceivedOverrides?: [{ paymentId, receivedMinor }], clientClosingId }` |
| **Output** | `{ closingId, status: "SUBMITTED"|"PENDING_SYNC", summary: { grossSalesMinor, cashSalesMinor, digitalSalesMinor, recordedExpensesMinor, expectedCashMinor, countedCashMinor, cashVarianceMinor, stockVariances }, reviewRequired: boolean }` |
| **Validation** | counted cash integer ≥ 0; all END-phase stock counts present for items tracked; out-of-tolerance variance requires `varianceReason` from configured list (incl. `UNKNOWN`, `WILL_RECOUNT`); digital overrides only with permission |
| **Errors** | `409 CONFLICT` (closing already accepted — returns existing closing) · `422` (missing reason) · `412` (open sales pending sync — the API returns which client IDs are missing) |
| **Idempotency** | Required: `clientClosingId` |
| **Rate limiting** | 20/hour per shift |
| **Audit** | `ShiftClosed` with full summary snapshot; later corrections are separate audited events |
| **Offline** | **[OFFLINE-OK]** with special semantics: closing is stored `PENDING_SYNC` and **remains editable** until the server accepts it; the UI must not claim "closed" while pending |

## 14. `POST /incidents` — Submit Incident

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-INC-001, FR-INC-006 |
| **Actor** | Operator, Supervisor, HQ |
| **Authentication** | Session required |
| **Authorization** | scope = `self`/`area`; operators may report incidents for their own shift/location |
| **Input** | `{ category, severityHint?, description, occurredAt, sellingLocationId?, shiftId?, evidenceObjectKeys?: string[], clientIncidentId }` |
| **Output** | `{ incidentId, status: "OPEN", severityAssigned, ownerAssigned?, escalation: "NONE"|"P1_SAFETY" }` |
| **Validation** | category from configured list; description ≥ 10 chars; occurredAt not absurdly future/past; severity assignment rule applied; safety categories force escalation |
| **Errors** | `422` · `403` |
| **Idempotency** | Required |
| **Rate limiting** | 20/hour per operator |
| **Audit** | `IncidentReported`; subsequent lifecycle moves audited separately |
| **Offline** | **[OFFLINE-OK]** Queued with device time; P1 escalation is attempted on reconnect and flagged as delayed sync in HQ |

## 15. `POST /loyalty/customers/identify` — Identify Loyalty Customer

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-LOYALTY-001, FR-LOYALTY-002, NFR-PRIVACY-006 |
| **Actor** | Operator (on behalf of a customer), Customer (self-service) |
| **Authentication** | Session required (operator); public rate-limited path for customer self-service with QR token |
| **Authorization** | scope = `self` (operator) or token possession (customer) |
| **Input** | `{ identifier: { type: "PHONE"|"QR_TOKEN"|"DEVICE_TOKEN", value }, consentBasis: "EXPLICIT_OPT_IN", saleId? }` |
| **Output** | `{ customerRef (opaque), loyaltyAccountRef?, consentState, earnedPreview?: null }` |
| **Validation** | phone in E.164 +ID format; token well-formed; **no** account created without recorded consent; masked phone returned to the operator (never the full number unless the customer requires it) |
| **Errors** | `404` (unknown token) · `422` (invalid identifier) · `451` (consent missing — cannot proceed) |
| **Idempotency** | Required (identify is safe to replay) |
| **Rate limiting** | 60/min per operator; 10/min per customer identifier |
| **Audit** | `LoyaltyCustomerIdentified` (identifier stored hashed where possible) |
| **Offline** | **NOT [OFFLINE-OK]** — identification requires the server so consent and duplicate-account rules are enforced centrally |

## 16. `POST /loyalty/rewards/{rewardInstanceId}/redeem` — Redeem Reward

| Field | Value |
| --- | --- |
| **Requirement ID** | FR-LOYALTY-004, FR-LOYALTY-010, ADR-0028 |
| **Actor** | Operator (with customer present) |
| **Authentication** | Session required |
| **Authorization** | scope = `self`; reward instance belongs to the identified customer; campaign active |
| **Input** | `{ saleId, operatorId, redeemContext?: { sellingLocationId, shiftId }, clientRedemptionId }` |
| **Output** | `{ redemptionId, status: "REDEEMED", saleAdjustment: { kind: "DISCOUNT"|"FREE_ITEM", amountMinor }, remainingBalancePreview?: null }` |
| **Validation** | reward instance `ISSUED` and not expired; customer identified in this session; identity match against the sale; **single-use enforced by unique constraint** (concurrent attempts lose cleanly) |
| **Errors** | `409 CONFLICT` (`ALREADY_REDEEMED`) · `410 GONE` (expired) · `403` |
| **Idempotency** | Required; replay returns the original redemption, never a second one |
| **Rate limiting** | 20/min per operator; 5/min per customer |
| **Audit** | `RewardRedeemed` with sale linkage; adjustment recorded as an explicit sale adjustment (never as a fake unit price) |
| **Offline** | **Conditional**: reward types flagged `requiresOnlineVerification` must be refused offline. If a campaign is explicitly configured offline-tolerant, redemption is queued but the sale carries an unresolved adjustment flag until verified. Default policy: online-required |

---

## 17. Contract summary table

| # | Endpoint | Offline | Idempotent | Audit | Money impact |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /shifts` | ✅ | ✅ | ✅ | opening cash only |
| 2 | `POST /shifts/{id}/location-reports` | ✅ | ✅ | ✅ | — |
| 3 | `POST /shifts/{id}/location-changes` | ✅ | ✅ | ✅ | — |
| 4 | `POST /price-acknowledgements` | ✅ (digest-bound) | ✅ | ✅ | — |
| 5 | `POST /sales` | ✅ | ✅ | ✅ | ✅ |
| 6 | `POST /sales/{id}/complete` | ✅ cash / ❌ digital | ✅ | ✅ | ✅ |
| 7 | `POST /payments/cash` | ✅ | ✅ | ✅ | ✅ |
| 8 | `POST /payments/digital` | ❌ | ✅ | ✅ | ✅ |
| 9 | `POST /webhooks/payments/{provider}` | n/a | ✅ | ✅ | ✅ |
| 10 | `POST /expenses` | ✅ | ✅ | ✅ | ✅ |
| 11 | `POST /stock-reports` | ✅ | ✅ | ✅ | — |
| 12 | `POST /restock-requests` | ✅ | ✅ | ✅ | — |
| 13 | `POST /shifts/{id}/closing` | ✅ (pending-sync) | ✅ | ✅ | ✅ |
| 14 | `POST /incidents` | ✅ | ✅ | ✅ | — |
| 15 | `POST /loyalty/customers/identify` | ❌ | ✅ | ✅ | — |
| 16 | `POST /loyalty/rewards/{id}/redeem` | ❌ (default) | ✅ | ✅ | ✅ |

Additional read endpoints (HQ, list/detail, exports) follow the same envelope rules and are
enumerated in `docs/operations/API-READ.md`; they are all `scope`-checked and audited when
they export data.

---

## 18. Skeleton mapping

Contracts above describe the intended API surface. Runtime implementation is slice-specific: implemented handlers are listed in the relevant page integration documents. Other planned endpoints may still be skeletons; do not infer runtime support from a contract alone.

---

## Implemented page slice — Transactions (2026-09-30)

The `/transactions` page currently uses these handlers; details and known limitations are recorded in `docs/integration/05-transactions-architecture.md`.

### `GET /api/v1/transactions`

- Requires an authenticated session and `sale:view`.
- Supports optional `businessDay=YYYY-MM-DD`, `stallId`, `status`, `limit` (1–100), and `offset` (0–100000).
- Scope filtering is server-side. Output contains structured IDR minor-unit totals, timestamps, status/payment summary, authorized outlet options, and pagination metadata.
- Current runtime persistence is file-backed `memoryStore`; it is not the planned PostgreSQL query adapter.

### `GET /api/v1/transactions/{transactionId}`

- Requires `sale:view`; returns `404` for absent or out-of-scope transactions.
- Returns persisted sale lines with immutable unit-price snapshots and persisted payment records.

### `POST /api/v1/transactions`

- Requires session permissions `sale:create` and `payment:cash`, an open shift in the caller's server-derived scope, and a non-empty `Idempotency-Key`.
- Input: `{ shiftId, clientSaleId, clientPaymentId, lines: [{ menuItemId, quantity }], cashReceivedMinor }` (optional `occurredAtDevice`, ISO UTC).
- Server resolves prices from active policies, computes integer IDR totals, validates cash, and persists sale + cash payment + stock completion + audit events through the existing features.
- Output: `{ data: { transactionId, status, totalMinor, changeMinor, currency: "IDR" } }`.
- This is online cash only. Digital payments, correction, and void are deliberately not exposed by this page. A payment rejection can leave a persisted `DRAFT` sale because the current file-backed features do not share a SQL transaction boundary.
