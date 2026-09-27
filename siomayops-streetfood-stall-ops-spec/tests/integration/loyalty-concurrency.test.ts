import { describe, it, expect, beforeEach } from "vitest";
import { memoryStore, generateId } from "@/server/db/memory-store";
import { redeemReward, createRewardInstance } from "@/features/loyalty";

describe("reward redemption concurrency (T-LOY-003)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("lets exactly one of two concurrent redemptions succeed (INV-06)", async () => {
    const orgId = "org-1";
    const accountId = generateId();
    memoryStore.loyaltyAccounts.set(accountId, {
      id: accountId,
      organizationId: orgId,
      consentGiven: true,
      createdAt: new Date(),
    });

    const { rewardInstanceId } = await createRewardInstance({
      loyaltyAccountId: accountId,
      rewardDefinitionId: "def-1",
      periodKey: "2026-09",
      organizationId: orgId,
    });

    const sale1 = generateId();
    const sale2 = generateId();

    const results = await Promise.allSettled([
      redeemReward({ rewardInstanceId, saleId: sale1, clientRedeemId: generateId(), organizationId: orgId }),
      redeemReward({ rewardInstanceId, saleId: sale2, clientRedeemId: generateId(), organizationId: orgId }),
    ]);

    const fulfilled = results.filter(r => r.status === "fulfilled") as any[];
    const redeemed = fulfilled.filter(r => r.value.outcome === "REDEEMED");
    const already = fulfilled.filter(r => r.value.outcome === "ALREADY_REDEEMED");

    // Exactly one should succeed, one should be already redeemed
    expect(redeemed.length).toBe(1);
    expect(already.length).toBe(1);
  });

  it("returns a non-punitive ALREADY_REDEEMED outcome to the loser", async () => {
    const orgId = "org-1";
    const accountId = generateId();
    memoryStore.loyaltyAccounts.set(accountId, {
      id: accountId,
      organizationId: orgId,
      consentGiven: true,
      createdAt: new Date(),
    });
    const { rewardInstanceId } = await createRewardInstance({
      loyaltyAccountId: accountId,
      rewardDefinitionId: "def-1",
      periodKey: "2026-09",
      organizationId: orgId,
    });

    await redeemReward({ rewardInstanceId, saleId: generateId(), clientRedeemId: generateId(), organizationId: orgId });
    const second = await redeemReward({ rewardInstanceId, saleId: generateId(), clientRedeemId: generateId(), organizationId: orgId });
    expect(second.outcome).toBe("ALREADY_REDEEMED");
  });

  it("records the redemption in the loyalty ledger with the rules version - via audit", async () => {
    const orgId = "org-1";
    const accountId = generateId();
    memoryStore.loyaltyAccounts.set(accountId, {
      id: accountId,
      organizationId: orgId,
      consentGiven: true,
      createdAt: new Date(),
    });
    const { rewardInstanceId } = await createRewardInstance({
      loyaltyAccountId: accountId,
      rewardDefinitionId: "def-1",
      periodKey: "2026-09",
      organizationId: orgId,
    });
    await redeemReward({ rewardInstanceId, saleId: generateId(), clientRedeemId: generateId(), organizationId: orgId });
    expect(memoryStore.auditEvents.some(e => e.action === "loyalty.redeemed")).toBe(true);
  });
});
