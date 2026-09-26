/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Consent-based identification; single-use redemption enforced by a unique constraint (INV-06);
 * NO points algorithm exists in this phase (FR-LOYALTY-009).
 */
import type { LoyaltyAccountId, RewardInstanceId, SaleId } from "../../shared/types/ids";

export type { LoyaltyAccountId, RewardInstanceId };

/** Requirements: FR-LOYALTY-001/002/003/007. Task: T-LOY-001. Refusal costs the customer nothing. */
export async function identifyCustomer(_input: {
  method: "PHONE_HASH" | "ROTATING_QR_TOKEN" | "ANONYMOUS_DEVICE_TOKEN";
  value: string; consentGiven: boolean; consentTextVersion: string;
}): Promise<{
  readonly loyaltyAccountId: LoyaltyAccountId;
  readonly consentRecorded: boolean;
  readonly rulesVersion: string;
}> {
  throw new Error("Not implemented: T-LOY-001");
}

/** Requirements: FR-LOYALTY-004/005/011. Task: T-LOY-002. No self-award; period caps apply. */
export async function earnOnSale(_input: {
  loyaltyAccountId: LoyaltyAccountId; saleId: SaleId;
}): Promise<{ readonly loyaltyTransactionId: string; readonly pointsDelta: number }> {
  throw new Error("Not implemented: T-LOY-002");
}

/** Requirements: FR-LOYALTY-006/008, ADR-0028. Task: T-LOY-003. Exactly one concurrent winner. */
export async function redeemReward(_input: {
  rewardInstanceId: RewardInstanceId; saleId: SaleId; clientRedeemId: string;
}): Promise<{ readonly outcome: "REDEEMED" | "ALREADY_REDEEMED" | "EXPIRED" | "ONLINE_REQUIRED" }> {
  throw new Error("Not implemented: T-LOY-003");
}

/** Requirements: FR-LOYALTY-010. Task: T-LOY-001. Withdrawal triggers the deletion pipeline. */
export async function withdrawConsent(_input: {
  loyaltyAccountId: LoyaltyAccountId; reason?: string;
}): Promise<{ readonly status: "WITHDRAWN"; readonly deletionScheduled: true }> {
  throw new Error("Not implemented: T-LOY-001");
}
