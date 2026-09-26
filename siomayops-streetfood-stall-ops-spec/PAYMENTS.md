# PAYMENTS

**Document ID:** DOC-PAYMENTS
**Status:** Phase 0 (specification; **no gateway, no QRIS processing, no reconciliation logic**)
**Related:** FR-PAYMENT-*, ADR-0011, ADR-0012, `SETTLEMENT.md`, `SALES.md`, `SECURITY.md`, `docs/payments/*`

---

## 1. Method model

```text
PaymentMethod
 ├── CASH                     first-class, offline-capable, no third party
 ├── QRIS                     national QR standard (BI/ASPI), via a licensed provider
 ├── BANK_TRANSFER            manual confirmation in MVP; reconciliation drives states
 ├── E_WALLET                 provider-specific; adapter later
 └── OTHER_APPROVED_METHOD    HQ-configured, explicitly approved, audited
```

Each method carries: `requiresOnlineVerification` · `supportsRefund` · `settlementModel`
(`IMMEDIATE` / `T_PLUS_N` / `MANUAL`) · `evidenceRequirement` (`NONE` / `PROVIDER_CALLBACK` /
`HUMAN_CONFIRMATION`).

---

## 2. Payment abstraction boundary (ADR-0011)

```text
Sale
  ↓
Payment Intent / Payment Record
  ↓
Provider Adapter  (port; one adapter per provider)
  ↓
Result (verified evidence or explicit failure)
```

```ts
/**
 * PaymentProvider
 *
 * Infrastructure boundary for future digital payment
 * integrations such as QRIS-compatible providers.
 *
 * No payment gateway implementation belongs in this phase.
 */
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>;
  getStatus(providerReference: string): Promise<PaymentStatus>;

  // Planned additions (contract shape only):
  // verifyCallback?(raw: RawCallback): Promise<VerifiedCallbackResult>;
  // refund?(input: RefundInput): Promise<RefundResult>;
}
```

Design rules for the port:

1. **No provider types leak** into sales, settlement, or reporting. Only `Payment`,
   `PaymentAttempt`, and provider-neutral evidence records cross the boundary.
2. Adapters own: auth/signing, retries, timeouts, and payload→domain mapping.
3. Adapters never decide money state: they return **verified facts**; the state machine decides.
4. Provider references are stored as opaque strings and never used as primary keys.
5. Multi-provider is a configuration concern (per organization / per area), not a code fork.

---

## 3. Payment states

```text
PENDING ──authorized──► AUTHORIZED ──verified──► PAID
   │                        │                      │
   ├──expire──► EXPIRED     ├──fail──► FAILED      └──refund──► REFUNDED
   └──cancel──► CANCELLED   └──cancel──► CANCELLED
```

| State | Meaning | Terminal? | Can still change? |
| --- | --- | --- | --- |
| PENDING | Created, awaiting provider or verification | No | Yes (authorized / expired / failed / cancelled) |
| AUTHORIZED | Provider accepted, not captured | No | Yes |
| PAID | 🔒 Verified money received | Yes (except refund) | Only to REFUNDED |
| FAILED | 🔒 Verified failure | Yes | No (a new payment may be created for the same sale) |
| EXPIRED | TTL passed with no evidence | Yes | No |
| CANCELLED | Withdrawn before any success | Yes | No |
| REFUNDED | Money returned (where supported) | Yes | No |

**Valid transitions and guards** are mirrored in `STATE_MACHINE.md` §9. The two non-negotiable
guards:

1. `→ PAID` requires **verified evidence** (provider callback record, or authorized manual
   reconciliation with an evidence note) — never a client assertion (FR-PAYMENT-004).
2. `→ PAID` requires **amount and currency match** with the sale; mismatch goes to
   `REVIEW_REQUIRED` (manual queue), never to PAID.

---

## 4. Cash (first class)

| Aspect | Design |
| --- | --- |
| Entry | Denominations + "uang pas" chips; typed amount as fallback |
| Fields | sale amount, cash received, change (computed server-side, echoed to UI) |
| Verification | By the shift's cash count at closing — not by a third party |
| Offline | Fully supported (canonical offline path) |
| Change math | Integer minor units only; half-up rounding never needed for integer subtraction |
| Running total | Shift cash running total shown to operator for a quick sanity feel |
| Risk | Cash differences are *expected occasionally*; the design resolves them without accusation |

---

## 5. QRIS (researched 2026 posture)

Validated ecosystem facts (see `docs/research/STACK-2026.md` §2.8 and `docs/payments/QRIS.md`):

- QRIS is a **Bank Indonesia / ASPI** standard; a merchant accepts it **through a licensed
  provider (PJSP)**, not by integrating with BI directly.
- **Static QR**: printed/displayed code; amount is entered by the *customer*; no per-transaction
  API call and no callback. The merchant learns of payment by their own means (notification,
  provider app, bank app).
- **Dynamic QR**: generated per transaction through the provider API with a fixed amount;
  supports `createPayment`, `getStatus`, `refund`, and (Snap-style) signed callbacks. The
  provider payloads carry a partner reference and the amount as a decimal string such as
  `"10000.00"` with currency `IDR` — converted to integer minor units at the adapter boundary.

### MVP: static QR with honest states (ADR-0012)

| Aspect | Decision |
| --- | --- |
| Integration | **None.** No gateway in MVP. Operator displays the merchant's static QRIS (printed or on-phone image) |
| Recording | Operator selects "QRIS" and marks **"Sudah dibayar oleh pelanggan"** ⇒ payment recorded as `PENDING_VERIFICATION` with a note |
| UI wording | "Menunggu verifikasi" — the UI never says "berhasil" |
| Resolution | HQ Finance verifies against the provider/bank statement and performs a **manual reconciliation** (permission + evidence note + audit) which moves the payment to `PAID` |
| Rationale | Works on day one with zero integrations, keeps the books honest, creates the reconciliation queue that a future dynamic integration will consume anyway |
| Risk accepted | Manual verification cost; mitigated by batching in the daily settlement view |

### Later: dynamic QRIS via provider

| Concern | Design stance |
| --- | --- |
| Provider credentials | Per-organization config, secrets in secret manager, never in client |
| Create payment | `createPayment()` returns a provider reference + QR payload + expiry |
| **Callback/webhook** | Signature-verified, timestamp-window checked, replay-protected, de-duplicated by provider reference; raw payload stored |
| **Duplicate callback** | Idempotent: same reference ⇒ no new effect; audit notes the duplicate |
| **Timeout** | `PENDING` past TTL ⇒ `EXPIRED` + alert; sweep job handles it, not the browser |
| **Failed payment** | Verified failure ⇒ `FAILED`; sale remains with an unresolved payment marker and can accept a new payment |
| **Customer says "already paid" but no callback** | Stays `PENDING_VERIFICATION`; HQ Finance resolves via reconciliation queue. **Never** auto-PAID |
| **Refund** | Provider-supported refund only, authorised by HQ Finance, recorded as a new record + audit; where unsupported, a manual process is documented instead of faked |
| **Amount mismatch in callback** | `REVIEW_REQUIRED` (manual), never PAID |
| **Currency mismatch** | Rejected outright |

### What we explicitly will not do

1. Fake a "payment successful" state to keep the UI smooth.
2. Trust a screenshot, an SMS, or a customer's phone screen as proof.
3. Poll the provider from the device in a loop (battery/data/abuse).
4. Store card data (no cards in scope) or wallet credentials.
5. Silently drop an unmatched callback (it goes to an investigation queue).

---

## 6. Evidence model (what counts as proof)

| Evidence type | Produced by | Sufficient for PAID? |
| --- | --- | --- |
| Verified provider callback (signature valid, reference matched, amount matched) | Provider | ✅ (automatic) |
| Provider status query response at reconciliation time | Adapter, on demand | ✅ with recorded query result |
| Provider/bank statement line matched by HQ Finance | Human | ✅ with reconciliation record (who, when, note) |
| Customer screenshot / message | Customer/operator | ❌ (may exist as supporting note inside an expense/incident, never as payment proof) |
| Operator verbal confirmation | Operator | ❌ alone (supports `PENDING_VERIFICATION` only) |
| "The app said success" | Client | ❌ never |

---

## 7. Reconciliation and exceptions (design intent, not implemented)

```text
Digital payment created
      ↓
Expected settlement recorded (amount, fee note if known, expected date)
      ↓
Provider/bank settlement observed
      ↓
Match: full / partial / unmatched / over
      ↓
Variances resolved with reason and audit  (Finance permission)
```

| Exception | Queue | Action |
| --- | --- | --- |
| Pending beyond TTL | Payment exceptions | Verify, expire, or resolve manually |
| Duplicate callback | Audit + reconciliation | Confirm idempotent handling; no double credit |
| Amount mismatch | Review queue | Investigate; correct forward only |
| Settlement missing | Settlement queue | Chase provider; escalate; keep expectation visible |
| Settlement arrived without a local payment | Settlement queue | Find the sale (unmatched deposit); record linkage with reason |
| Refund issued | Refunds view | Link to original; audit |

Fee handling: provider fees are **not** modelled as payment amounts. If needed later, fees are
a separate, explicit cost line with HQ review — never netted silently into sales figures.

---

## 8. Payment security requirements (summary; full detail in `SECURITY.md`)

1. **Idempotency** on creation, callbacks, and reconciliation.
2. **Signed callbacks** verified before any processing; failures are security events.
3. **Provider transaction references** stored and unique per provider.
4. **Amount verification** against the expected sale total.
5. **Currency verification** (`IDR` for MVP) — reject mismatches.
6. **Duplicate callback handling** with explicit dedupe keys.
7. **Replay protection** via timestamp windows + nonce/reference uniqueness.
8. **State machine integrity** — invalid transitions throw and alert, never no-op.
9. **Manual reconciliation** with mandatory actor, reason, and evidence note.
10. **No client-side truth** — the browser can only *request*, never *confirm*.

---

## 9. Reporting rules

| Report | Rule |
| --- | --- |
| Digital sales | Count `PAID` + separately count `PENDING_VERIFICATION` — never merged into "confirmed" |
| Cash sales | Counted from sale records (verified by cash count at closing) |
| Payment mix | Always shows unverified portion explicitly |
| Reconciliation health | % of digital payments resolved within the settlement window |
| Provider fees | Excluded from sales totals; separate cost view when enabled |

**Card rule (HQ dashboard):** "Digital Payments" must show **verified vs unverified** as
distinct numbers. A dashboard that shows one merged digital number is considered incorrect.
