/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Loyalty (LOYALTY.md, ADR-0028). No points algorithm exists in this phase; the domain fixes
 * identity, consent and single-use redemption rules so concurrency is decidable later.
 */
export interface LoyaltyRules {
  readonly rulesVersion: string;
  readonly earnPerMinorSpent: number;
  readonly pointValueMinor: number;
  readonly periodCapPoints: number;
  readonly requiresOnlineVerification: boolean;
}

export interface RewardInstance {
  readonly rewardInstanceId: string;
  readonly loyaltyAccountId: string;
  readonly rewardDefinitionId: string;
  readonly periodKey: string;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
  readonly redeemedAt?: Date;
  readonly redeemedSaleId?: string;
}

/** Throws. Task: T-LOY-003. Exactly one concurrent redemption may succeed (INV-06). */
export function redeemReward(
  _instance: RewardInstance,
  _saleId: string,
  _now: Date
): { readonly instance: RewardInstance; readonly outcome: "REDEEMED" } {
  throw new Error("Not implemented: T-LOY-003");
}

/** Throws. Task: T-LOY-002. No earning on self-operated transactions (FR-LOYALTY-011). */
export function computeEarn(_rules: LoyaltyRules, _saleTotalMinor: number): number {
  throw new Error("Not implemented: T-LOY-002");
}
