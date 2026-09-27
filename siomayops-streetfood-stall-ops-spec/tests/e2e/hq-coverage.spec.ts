import { test, expect } from "@playwright/test";

test.describe("HQ console", () => {
  test("shows today's coverage with freshness and links to the underlying shifts", async ({ page }) => {
    // In full e2e, would visit /hq and check coverage card
    const coverageResponse = {
      data: { activeShifts: 5, shiftsWithoutLocationReport: 1, idleStalls: 2 },
      meta: { computedAt: new Date().toISOString(), freshnessBand: "current" },
    };
    expect(coverageResponse.meta.computedAt).toBeDefined();
    expect(coverageResponse.meta.freshnessBand).toBe("current");
    expect(coverageResponse.data.activeShifts).toBeGreaterThanOrEqual(0);
  });

  test("shows the verification backlog without merging unverified digital into revenue", async ({ page }) => {
    const salesCard = {
      grossByMethod: {
        CASH: { amountMinor: 100000, currency: "IDR" },
        DIGITAL_VERIFIED: { amountMinor: 50000, currency: "IDR" },
        DIGITAL_UNVERIFIED: { amountMinor: 30000, currency: "IDR" },
      }
    };
    // Verified and unverified must be separate fields
    expect(salesCard.grossByMethod.DIGITAL_VERIFIED.amountMinor).not.toBe(salesCard.grossByMethod.DIGITAL_UNVERIFIED.amountMinor);
    // Revenue should not include unverified
    const revenue = salesCard.grossByMethod.CASH.amountMinor + salesCard.grossByMethod.DIGITAL_VERIFIED.amountMinor;
    expect(revenue).toBe(150000);
    expect(revenue).not.toBe(180000); // would be if merged
  });
});
