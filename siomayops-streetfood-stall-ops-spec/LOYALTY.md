# LOYALTY

**Document ID:** DOC-LOYALTY
**Status:** Phase 0 (specification; **no points algorithm, no redemption logic implemented**)
**Related:** FR-LOYALTY-*, ADR-0028, `PRIVACY.md`, `SALES.md`, `docs/loyalty/*`

---

## 1. Design goal

A street customer decides in ~10 seconds whether a loyalty scheme is worth their attention.
So: **no app install, no account creation at the stall, no forms.** Identify once (usually just
a phone number), earn automatically, and everything else happens in the background.

**Non-negotiable:** loyalty is opt-in, purpose-bound (UU PDP), and never a prerequisite for
buying.

---

## 2. Identification approaches (compared)

| Approach | Usability | Privacy | Ops cost | Fraud exposure | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Phone number (E.164)** | ★★★★ (everyone can say a number) | Medium (PII, but familiar) | Low | Medium (someone could use another's number) | **PRIMARY** for MVP |
| **QR membership card / token** | ★★★★★ (scan, no typing) | High (opaque token) | Medium (needs a card/screen) | Low–medium (card sharing) | **PRIMARY (future)**; best when a customer returns often |
| **Anonymous device token** | ★★★★ (invisible) | High (no PII) | Low | High (device reset ⇒ lost/re-earned) | OPTIONAL fallback for privacy-preferring customers |
| **Full customer account (email/password)** | ★ (friction) | Medium | Medium | Low | **REJECTED** for street context |

Decision (ADR-0028): support phone-first with QR tokens as an upgrade path; store the minimum
(`phone hash` + display mask), never names or addresses, and always record consent.

---

## 3. Core model

```ts
interface Customer {
  customerId: string;             // opaque
  organizationId: string;
  identity: {
    phoneHash: string;            // hashed; raw number held only where operationally required
    phoneMasked: string;          // "+62 8•• •••• 123"
    qrToken?: string;             // rotating, revocable
    deviceToken?: string;         // anonymous fallback
  };
  consent: {
    optedInAt: Date;
    basis: "EXPLICIT_OPT_IN";
    purposes: Array<"LOYALTY_ACCRUAL" | "REDEMPTION" | "CAMPAIGN_MESSAGES">;
    withdrawnAt?: Date;
  };
}

interface LoyaltyAccount {
  loyaltyAccountId: string;
  customerId: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  // balance is DERIVED from transactions — never a mutable counter as truth
}

interface Reward {
  rewardId: string;
  name: string;                       // "Gratis 1 Tahu"
  kind: "FREE_ITEM" | "DISCOUNT" | "POINTS" | "CAMPAIGN";
  scope: { organizationId: string; areaIds?: string[]; sellingLocationIds?: string[] };
  validity: { from: Date; until: Date };
  requiresOnlineVerification: boolean; // policy per ADR-0028
}

interface RewardInstance {
  rewardInstanceId: string;
  rewardId: string;
  loyaltyAccountId: string;
  issuedAt: Date;
  expiresAt: Date;
  status: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";  // single-use
}
```

**Anti-double-redeem design:** a reward is granted as a **single-use instance** with a unique
constraint on its redemption. Concurrent attempts lose cleanly; a replayed request returns the
original redemption.

---

## 4. Conceptual flow

```text
Customer
   ↓
Scan Loyalty QR / Identify (phone or token)   ← consent recorded on first identify
   ↓
Sale
   ↓
Earn  (accrual rule; algorithm deferred to a later slice)
   ↓
Reward Available
   ↓
Redeem  (single-use, server-verified, adjustment recorded on the sale)
```

### Earning
- Earning is **automatic** on a completed sale once the customer is identified.
- The earn rule is configuration (visit count, spend threshold, item-specific) — **not**
  implemented in Phase 0. `LoyaltyService.earn()` is a stub that throws.
- Earning is idempotent per sale: a replayed sale never double-earns.
- Missed identification (customer didn't want to share) simply means no earning — never a
  blocked sale.

### Redeeming
- Redemption always references a completed sale and a single-use instance.
- The adjustment appears as an explicit **sale adjustment** (`DISCOUNT` or `FREE_ITEM`), never
  as a tampered unit price (`PRICING.md` §5).
- If the reward type requires online verification, offline redemption is refused with a clear
  message and a suggestion to offer cash and let the customer redeem next time (never a fake
  success).
- The operator sees a simple confirmation: "Hadiah: Gratis 1 Tahu — dipakai."

---

## 5. Service port (skeleton contract)

```ts
/**
 * LoyaltyService
 *
 * Future responsibility:
 * - earning
 * - redemption
 * - preventing double redemption
 * - campaign applicability
 *
 * No points algorithm exists during this phase.
 */
export interface LoyaltyService {
  earn(input: EarnLoyaltyInput): Promise<LoyaltyResult>;
  redeem(input: RedeemRewardInput): Promise<RedemptionResult>;
}
```

### Required future behaviours (documented, not implemented)

| Requirement | Behaviour |
| --- | --- |
| Idempotency | `earn` keyed by `(saleId)`; `redeem` keyed by `clientRedemptionId` + reward instance |
| Single-use | Unique constraint on `reward_instance_id` in redemptions |
| Campaign applicability | Scope check (area/location/date/item) before issuing or redeeming |
| Balance integrity | Derived from transactions; no counter drift; totals reproducible |
| Audit | Every issuance/redemption is an audit event with actor and context |
| Privacy | Phone stored hashed where possible; full number only where operationally required, masked elsewhere |

---

## 6. Fraud considerations (design-level)

| Risk | Mitigation |
| --- | --- |
| Operator redeems for a friend without a sale | Redemption requires a sale reference created in the same interaction |
| Customer uses another person's number | Low-value rewards limit incentive; optional OTP for large rewards |
| Reward issued twice for one sale | Idempotent earn keyed by sale |
| Same reward redeemed twice (concurrent devices) | Single-use instance + unique constraint; second attempt returns "already used" |
| Operator "farms" rewards for own number | Pattern detection in HQ reporting (aggregate, review-based, never automated punishment) |
| Data misuse (phone list) | Access control, masking by default, no bulk export without permission + audit |

Fraud handling is **review-based**, never automated sanctions against operators
(FR-PERF-004).

---

## 7. Privacy requirements (binding)

1. Explicit opt-in with recorded timestamp and purposes (UU PDP, NFR-PRIVACY-006).
2. Purpose limitation: loyalty data is used for accrual, redemption, and (only with separate
   opt-in) campaign messages.
3. Deletion support: a customer can request deletion; the account, balance, and identifiers are
   removed or irreversibly anonymised, while the *sale* records remain (as required for
   financial integrity) with the loyalty reference detached (FR-LOYALTY-009, NFR-PRIVACY-007).
4. No sale of customer data. No third-party marketing sharing.
5. Minimum retention for loyalty data; redemption evidence kept per `RETENTION.md`.
6. No sensitive-category inference (religion, health, etc.) — not collected, not inferred.

---

## 8. Explicit non-goals

- No wallet/balance in rupiah (that would be a financial product; out of scope and regulated).
- No gifting/transfer of rewards between customers (fraud vector, no demand).
- No card-linked offers, no Open Banking, no payment-method-linked programmes.
- No gamified leaderboards for customers.
- No automatic marketing blasts without explicit campaign consent.
