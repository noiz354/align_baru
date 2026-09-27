import { describe, it, expect } from "vitest";
import { resolvePrice } from "@/domain/pricing/resolution";
import type { PricePolicyRow } from "@/domain/pricing/resolution";

describe("deterministic price resolution (T-PRICE-002, ADR-0008)", () => {
  const orgId = "org-1";
  const areaId = "area-1";
  const locId = "loc-1";
  const menuId = "menu-1";
  const now = new Date("2026-09-26T10:00:00Z");

  it("prefers LOCATION over AREA over ORG", () => {
    const policies: PricePolicyRow[] = [
      { pricePolicyId: "p-org", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 10000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
      { pricePolicyId: "p-area", menuItemId: menuId, scope: "AREA", scopeId: areaId, unitPriceMinor: 12000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
      { pricePolicyId: "p-loc", menuItemId: menuId, scope: "LOCATION", scopeId: locId, unitPriceMinor: 15000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
    ];
    const res = resolvePrice(menuId, { organizationId: orgId, areaId, sellingLocationId: locId }, policies, now);
    expect(res.kind).toBe("RESOLVED");
    if (res.kind === "RESOLVED") expect(res.unitPriceMinor).toBe(15000);
  });

  it("breaks ties by the newest effectiveFrom", () => {
    const policies: PricePolicyRow[] = [
      { pricePolicyId: "p-old", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 10000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
      { pricePolicyId: "p-new", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 12000, currency: "IDR", effectiveFrom: new Date("2026-09-20") },
    ];
    const res = resolvePrice(menuId, { organizationId: orgId }, policies, now);
    expect(res.kind).toBe("RESOLVED");
    if (res.kind === "RESOLVED") expect(res.pricePolicyId).toBe("p-new");
  });

  it("fails loudly with PRICE_RESOLUTION_AMBIGUOUS on an exact tie", () => {
    const sameTime = new Date("2026-09-10T00:00:00Z");
    const policies: PricePolicyRow[] = [
      { pricePolicyId: "p1", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 10000, currency: "IDR", effectiveFrom: sameTime },
      { pricePolicyId: "p2", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 12000, currency: "IDR", effectiveFrom: sameTime },
    ];
    const res = resolvePrice(menuId, { organizationId: orgId }, policies, now);
    expect(res.kind).toBe("AMBIGUOUS");
  });

  it("returns NOT_SELLABLE rather than zero when no policy exists", () => {
    const res = resolvePrice(menuId, { organizationId: orgId }, [], now);
    expect(res.kind).toBe("NOT_SELLABLE");
  });

  it("ignores expired policies without silently falling back to another scope", () => {
    const policies: PricePolicyRow[] = [
      { pricePolicyId: "p-expired", menuItemId: menuId, scope: "LOCATION", scopeId: locId, unitPriceMinor: 15000, currency: "IDR", effectiveFrom: new Date("2026-09-01"), effectiveTo: new Date("2026-09-10") },
      { pricePolicyId: "p-org", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 10000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
    ];
    const res = resolvePrice(menuId, { organizationId: orgId, areaId, sellingLocationId: locId }, policies, now);
    // Expired location policy ignored, should fallback to ORG
    expect(res.kind).toBe("RESOLVED");
    if (res.kind === "RESOLVED") expect(res.pricePolicyId).toBe("p-org");
  });

  it("preserves the resolved policy id as provenance for the sale line", () => {
    const policies: PricePolicyRow[] = [
      { pricePolicyId: "p-provenance", menuItemId: menuId, scope: "ORG", scopeId: orgId, unitPriceMinor: 10000, currency: "IDR", effectiveFrom: new Date("2026-09-01") },
    ];
    const res = resolvePrice(menuId, { organizationId: orgId }, policies, now);
    expect(res.kind).toBe("RESOLVED");
    if (res.kind === "RESOLVED") expect(res.pricePolicyId).toBe("p-provenance");
  });
});
