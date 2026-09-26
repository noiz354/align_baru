# QRIS — Design Notes and Honesty Rules

**Document ID:** DOC-PAYMENTS-QRIS
**Status:** Phase 0 specification. **No QRIS integration exists** and none may be built in this phase:
`createDigitalPayment` throws `Not implemented: T-PAY-002`, `verifyProviderCallback` throws
`Not implemented: T-PAY-003`, and there is no provider adapter in `src/server/payments/adapters`.
**Related:** `PAYMENTS.md`, `SETTLEMENT.md`, ADR-0011, ADR-0012, ADR-0033, `docs/research/STACK-2026.md` §2.9

---

## 1. What QRIS is and what that means for us

QRIS (Quick Response Code Indonesian Standard) is Indonesia's national QR payment standard, governed
by Bank Indonesia and ASPI and built on the EMVCo specification with national deviations. It is
accepted through **licensed providers (PJSPs)**, not by talking to a bank directly. Two shapes matter:

| Shape | How it works | What we can know |
| --- | --- | --- |
| **Static QRIS** (merchant-presented) | One printed/stored QR for the merchant; the customer types the amount | Nothing automatically — there is no per-transaction API call and no callback. We know only that the customer says they paid |
| **Dynamic QRIS** (provider-generated) | A QR per transaction with a fixed amount, created through the provider's API | Provider callbacks and/or status queries give verifiable evidence |

The pilot starts with **static QRIS** precisely because provider onboarding (KYC, settlement account,
credentials, callback configuration) is a commercial process we do not control, and because a pilot
must not be blocked by it (ADR-0012).

## 2. The honesty rule (non-negotiable)

> A QRIS payment recorded by the operator is a **claim**, not a fact.
> Until the server has verified evidence, the payment is `PENDING_VERIFICATION` and every screen,
> report and export says **"Menunggu verifikasi"**.

| Event | Recorded state | Displayed wording | Who can change it |
| --- | --- | --- | --- |
| Operator records a static-QRIS payment | `PENDING_VERIFICATION` | "Menunggu verifikasi" | — |
| Provider callback verified (dynamic) | `PAID` | "Dibayar" | System, with verified evidence |
| Provider status query verified | `PAID` | "Dibayar" | System, with verified evidence |
| HQ Finance reconciles with evidence | `PAID` | "Dibayar" | `HQ_FINANCE` with reason + evidence note |
| Provider reports failure/expiry | `FAILED` / `EXPIRED` | "Tidak berhasil" / "Kedaluwarsa" | System |
| Nothing ever | `PAID` from a client, a screenshot, a browser redirect, a verbal claim, or an offline queue | — | Nobody |

Additional rules: verified and unverified digital amounts are never merged in reporting
(FR-PAYMENT-010); unverified items are alerted to HQ Finance when a shift closes with them unresolved
(FR-PAYMENT-015); a rejected callback is recorded and alerted, never applied (FR-PAYMENT-012).

## 3. Provider adapter expectations (`PaymentProvider`)

| Port method | Purpose | Notes for the adapter |
| --- | --- | --- |
| `createPayment` | Dynamic QR creation with a partner reference | Amounts cross as `Money` (integer minor units); provider decimal strings are converted **at the edge only** (ADR-0006) |
| `getStatus` | Verification polling for reconciliation and sweeps | Used by the pending-verification sweep job; result is evidence |
| `refund` | Refund with a distinct refund reference | Requires an explicit refund record and a reason; never automatic |
| `verifyCallback` (via `WebhookVerifier`) | Signature, reference match, amount match, replay guard | Callbacks are untrusted input; verification precedes any parsing side effect |

Provider-agnostic requirements: unique reference per attempt; idempotent creation; callback replay
protection (timestamp window + reference + nonce where available); amount and currency verification
against the sale; secrets server-side only (NFR-SEC-004); sandbox mode impossible to enable in
production and never able to produce `PAID` (ADR-0033).

## 4. Reconciliation workflow (static QRIS)

```text
1. Operator: sale → QRIS → amount confirmed → customer pays → operator records the claim
   → payment PENDING_VERIFICATION, sale completed as "menunggu verifikasi"
2. Evening: HQ Finance verification queue lists pending items (age, value, shift, location)
3. Finance checks one of:
     a) provider/bank statement shows the credit  → verify with evidence note
     b) merchant app dashboard shows the payment  → verify with evidence note (reference captured)
     c) provider status query returns success     → verify (dynamic only)
4. Finance records the reconciliation: outcome (MATCHED / SHORT / OVER / MISSING / DISPUTED),
   reason, evidence note, optional evidence asset → payment becomes PAID, audited
5. Unresolved items stay open with an owner and an SLA; they are never silently written off
```

Amount mismatches (short/over) are recorded as explicit exceptions and reviewed; the sale amount is
never silently repriced.

## 5. Settlement expectations

| Concept | Treatment |
| --- | --- |
| Provider settlement credit | Recorded as an **expectation** (gross, fees, expected net) and matched against the bank credit — a review artefact, not accounting (ADR-0011, FR-SETTLE-005/006) |
| Matching outcomes | `MATCHED`, `SHORT`, `OVER`, `MISSING`, `DISPUTED` with evidence notes |
| Fees | Recorded as a distinct line; never netted silently against sales |
| Timing | Expected T+N per provider agreement; the product never fabricates a settlement date |
| Discrepancies | Routed to Finance with the provider reference; escalated per `RUNBOOK.md` |

## 6. What we will not do (Phase 0 and beyond)

1. No faked payment success, no simulation that can reach `PAID`, no "assume paid for demo" flag.
2. No card data: we do not accept cards, so no PAN, no cardholder data, no card storage questions.
3. No e-wallet or account-balance integration in this phase.
4. No direct bank transfer API integration; a transfer claim is a claim, verified like any other.
5. No offline digital success (ADR-0033), including "temporary success" states.
6. No dependency of money state on a customer screenshot or a notification delivery.
7. No customer app or account requirement to pay.

## 7. Open questions

| # | Question | Owner | Needed by |
| --- | --- | --- | --- |
| Q-1 | Which provider(s) to onboard, and what settlement timing do they offer? | Finance + Owner | VS-6 |
| Q-2 | Verification SLA hours and the Finance rota for the evening queue | Finance | VS-6 |
| Q-3 | Whether the pilot prints a static QR per stall or one per merchant | Ops | VS-6 |
| Q-4 | Which evidence (statement screenshot, dashboard reference) is acceptable for manual reconciliation | Finance | VS-6 |
| Q-5 | Whether dynamic QRIS arrives before or after the pilot's end | Owner | VS-17 |
