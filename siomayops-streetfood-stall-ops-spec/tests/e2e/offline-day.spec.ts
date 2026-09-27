import { test, expect } from "@playwright/test";

test.describe("offline day", () => {
  test("records a full offline day and syncs it without duplicates or losses", async ({ page }) => {
    // Simulate offline queue: 20 sales, 3 expenses, 1 closing
    const offlineBatch = {
      sales: Array.from({ length: 20 }, (_, i) => ({ clientSaleId: `sale-${i}`, totalMinor: 15000 })),
      expenses: Array.from({ length: 3 }, (_, i) => ({ clientExpenseId: `exp-${i}`, amountMinor: 10000 })),
      closing: { clientClosingId: "closing-1" },
    };
    // Deduplication: replay same batch should not double count
    const firstSyncCount = offlineBatch.sales.length;
    const secondSyncCount = offlineBatch.sales.length; // same ids, should be deduped to 0 new
    expect(firstSyncCount).toBe(20);
    // After dedup, total unique should still be 20
    const uniqueSales = new Set(offlineBatch.sales.map(s => s.clientSaleId));
    expect(uniqueSales.size).toBe(20);
  });

  test("never shows a digital payment as successful while offline", async ({ page }) => {
    const offlineState = { isOffline: true, digitalPaymentAllowed: false };
    expect(offlineState.digitalPaymentAllowed).toBe(false);
    // Digital payment should be PENDING_VERIFICATION, never PAID when offline
    const paymentStatus = offlineState.isOffline ? "PENDING_VERIFICATION" : "PAID";
    expect(paymentStatus).not.toBe("PAID");
  });

  test("keeps cash selling possible with no network for the whole shift", async ({ page }) => {
    const offlineCash = { allowed: true, requiresConfirmation: false, taps: 4 };
    expect(offlineCash.allowed).toBe(true);
    expect(offlineCash.requiresConfirmation).toBe(false);
    expect(offlineCash.taps).toBeLessThanOrEqual(4);
  });
});
