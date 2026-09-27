import { memoryStore, generateId } from "../../server/db/memory-store";
import type { LoyaltyAccountId, RewardInstanceId, SaleId } from "../../shared/types/ids";
import { redeemReward as domainRedeem, computeEarn } from "../../domain/loyalty/reward";
import { writeAuditEvent } from "../audit";

export type { LoyaltyAccountId, RewardInstanceId };

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

const DEFAULT_RULES = {
  rulesVersion: "v1",
  earnPerMinorSpent: 0.001, // 1 point per 1000 IDR
  pointValueMinor: 1,
  periodCapPoints: 10000,
  requiresOnlineVerification: false,
};

export async function identifyCustomer(input: {
  method: "PHONE_HASH" | "ROTATING_QR_TOKEN" | "ANONYMOUS_DEVICE_TOKEN";
  value: string; consentGiven: boolean; consentTextVersion: string; organizationId?: string;
}): Promise<{
  readonly loyaltyAccountId: LoyaltyAccountId;
  readonly consentRecorded: boolean;
  readonly rulesVersion: string;
}> {
  const orgId = input.organizationId || DEFAULT_ORG;
  if (!input.consentGiven) {
    throw Object.assign(new Error("Consent required"), { code: "PRECONDITION_FAILED" });
  }
  // Find existing by phone hash or token value
  for (const acc of memoryStore.loyaltyAccounts.values()) {
    if (acc.organizationId !== orgId) continue;
    // Simplified: match by value stored as phoneE164
    if (acc.phoneE164 === input.value) {
      return { loyaltyAccountId: acc.id, consentRecorded: acc.consentGiven, rulesVersion: DEFAULT_RULES.rulesVersion };
    }
  }
  const id = generateId();
  const now = new Date();
  memoryStore.loyaltyAccounts.set(id, {
    id,
    organizationId: orgId,
    phoneE164: input.method === "PHONE_HASH" ? input.value : undefined,
    consentGiven: input.consentGiven,
    consentAt: now,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    action: "loyalty.identified",
    subjectKind: "loyalty_account",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { method: input.method },
  });
  return { loyaltyAccountId: id, consentRecorded: true, rulesVersion: DEFAULT_RULES.rulesVersion };
}

export async function earnOnSale(input: {
  loyaltyAccountId: LoyaltyAccountId; saleId: SaleId; organizationId?: string;
}): Promise<{ readonly loyaltyTransactionId: string; readonly pointsDelta: number }> {
  const sale = memoryStore.sales.get(input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  // No self-award: if operatorId equals loyalty account's operator? Simplified: prevent if sale operator is same as account's linked operator (not implemented)
  // For pilot, allow all
  const points = computeEarn(DEFAULT_RULES, sale.totalMinor);
  const txId = generateId();
  // Store as alert or just audit
  await writeAuditEvent({
    organizationId: sale.organizationId,
    actorKind: "OPERATOR",
    action: "loyalty.earned",
    subjectKind: "loyalty_transaction",
    subjectId: txId,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { loyaltyAccountId: input.loyaltyAccountId, saleId: input.saleId, points },
  });
  return { loyaltyTransactionId: txId, pointsDelta: points };
}

export async function redeemReward(input: {
  rewardInstanceId: RewardInstanceId; saleId: SaleId; clientRedeemId: string; organizationId?: string;
}): Promise<{ readonly outcome: "REDEEMED" | "ALREADY_REDEEMED" | "EXPIRED" | "ONLINE_REQUIRED" }> {
  const instance = memoryStore.rewardInstances.get(input.rewardInstanceId);
  if (!instance) throw Object.assign(new Error("Reward not found"), { code: "NOT_FOUND" });
  if (instance.redeemedAt) {
    return { outcome: "ALREADY_REDEEMED" };
  }
  if (instance.expiresAt && new Date() > instance.expiresAt) {
    return { outcome: "EXPIRED" };
  }
  // Concurrency guard: use unique constraint simulation via atomic check
  // In memory, we lock by checking redeemedAt again before setting
  try {
    const result = domainRedeem({
      rewardInstanceId: instance.id,
      loyaltyAccountId: instance.loyaltyAccountId,
      rewardDefinitionId: instance.rewardDefinitionId,
      periodKey: instance.periodKey,
      issuedAt: instance.issuedAt,
      expiresAt: instance.expiresAt,
      redeemedAt: instance.redeemedAt,
      redeemedSaleId: instance.redeemedSaleId,
    }, input.saleId, new Date());
    // Update store
    instance.redeemedAt = result.instance.redeemedAt;
    instance.redeemedSaleId = input.saleId;
    memoryStore.rewardInstances.set(instance.id, instance);
    await writeAuditEvent({
      organizationId: instance.organizationId,
      actorKind: "OPERATOR",
      action: "loyalty.redeemed",
      subjectKind: "reward_instance",
      subjectId: instance.id,
      correlationId: generateId(),
      occurredAt: new Date(),
      afterSummary: { saleId: input.saleId },
    });
    return { outcome: "REDEEMED" };
  } catch (e: any) {
    if (e.name === "RewardAlreadyRedeemedError") return { outcome: "ALREADY_REDEEMED" };
    if (e.name === "RewardExpiredError") return { outcome: "EXPIRED" };
    throw e;
  }
}

export async function withdrawConsent(input: {
  loyaltyAccountId: LoyaltyAccountId; reason?: string; organizationId?: string;
}): Promise<{ readonly status: "WITHDRAWN"; readonly deletionScheduled: true }> {
  const acc = memoryStore.loyaltyAccounts.get(input.loyaltyAccountId);
  if (!acc) throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND" });
  acc.consentGiven = false;
  memoryStore.loyaltyAccounts.set(acc.id, acc);
  await writeAuditEvent({
    organizationId: acc.organizationId,
    actorKind: "OPERATOR",
    action: "loyalty.consent_withdrawn",
    subjectKind: "loyalty_account",
    subjectId: acc.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
  });
  return { status: "WITHDRAWN", deletionScheduled: true };
}

export async function createRewardInstance(input: {
  loyaltyAccountId: string; rewardDefinitionId: string; periodKey: string; organizationId?: string; expiresAt?: Date;
}): Promise<{ rewardInstanceId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Enforce unique per (account, def, period)
  for (const ri of memoryStore.rewardInstances.values()) {
    if (ri.loyaltyAccountId === input.loyaltyAccountId && ri.rewardDefinitionId === input.rewardDefinitionId && ri.periodKey === input.periodKey) {
      throw Object.assign(new Error("Reward already exists for this period"), { code: "CONFLICT" });
    }
  }
  const id = generateId();
  const now = new Date();
  memoryStore.rewardInstances.set(id, {
    id,
    organizationId: orgId,
    loyaltyAccountId: input.loyaltyAccountId,
    rewardDefinitionId: input.rewardDefinitionId,
    periodKey: input.periodKey,
    issuedAt: now,
    expiresAt: input.expiresAt,
  });
  return { rewardInstanceId: id };
}
