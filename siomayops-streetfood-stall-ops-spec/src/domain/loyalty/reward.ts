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

export class RewardAlreadyRedeemedError extends Error {
  constructor() {
    super("Reward already redeemed");
    this.name = "RewardAlreadyRedeemedError";
  }
}

export class RewardExpiredError extends Error {
  constructor() {
    super("Reward expired");
    this.name = "RewardExpiredError";
  }
}

export function redeemReward(
  instance: RewardInstance,
  saleId: string,
  now: Date
): { readonly instance: RewardInstance; readonly outcome: "REDEEMED" } {
  if (instance.redeemedAt) {
    throw new RewardAlreadyRedeemedError();
  }
  if (instance.expiresAt && now > instance.expiresAt) {
    throw new RewardExpiredError();
  }
  if (!saleId) throw new Error("saleId required");
  const updated: RewardInstance = {
    ...instance,
    redeemedAt: now,
    redeemedSaleId: saleId,
  };
  return { instance: updated, outcome: "REDEEMED" };
}

export function computeEarn(rules: LoyaltyRules, saleTotalMinor: number): number {
  if (saleTotalMinor <= 0) return 0;
  if (rules.earnPerMinorSpent <= 0) return 0;
  const points = Math.floor(saleTotalMinor * rules.earnPerMinorSpent);
  return Math.min(points, rules.periodCapPoints);
}
