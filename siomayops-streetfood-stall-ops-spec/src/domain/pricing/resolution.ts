export type PriceScopeKind = "ORG" | "AREA" | "LOCATION";
export type OverrideMode = "HQ_ONLY" | "SUPERVISOR_APPROVED" | "OPERATOR_ALLOWED";

export interface PricePolicyRow {
  readonly pricePolicyId: string;
  readonly menuItemId: string;
  readonly scope: PriceScopeKind;
  readonly scopeId: string;
  readonly unitPriceMinor: number;
  readonly currency: "IDR";
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
}

export type PriceResolution =
  | { readonly kind: "RESOLVED"; readonly pricePolicyId: string; readonly unitPriceMinor: number; readonly currency: "IDR" }
  | { readonly kind: "NOT_SELLABLE"; readonly menuItemId: string }
  | { readonly kind: "AMBIGUOUS"; readonly candidatePolicyIds: readonly string[] };

const SCOPE_PRIORITY: Record<PriceScopeKind, number> = {
  LOCATION: 3,
  AREA: 2,
  ORG: 1,
};

export function resolvePrice(
  menuItemId: string,
  scope: { organizationId: string; areaId?: string; sellingLocationId?: string },
  policies: readonly PricePolicyRow[],
  at: Date
): PriceResolution {
  const relevant = policies.filter(p => {
    if (p.menuItemId !== menuItemId) return false;
    if (p.effectiveFrom > at) return false;
    if (p.effectiveTo && p.effectiveTo <= at) return false;
    // scope match
    if (p.scope === "ORG" && p.scopeId === scope.organizationId) return true;
    if (p.scope === "AREA" && scope.areaId && p.scopeId === scope.areaId) return true;
    if (p.scope === "LOCATION" && scope.sellingLocationId && p.scopeId === scope.sellingLocationId) return true;
    return false;
  });

  if (relevant.length === 0) {
    return { kind: "NOT_SELLABLE", menuItemId };
  }

  // Find highest scope priority present
  let maxPriority = 0;
  for (const p of relevant) {
    const pri = SCOPE_PRIORITY[p.scope];
    if (pri > maxPriority) maxPriority = pri;
  }
  const candidatesAtPriority = relevant.filter(p => SCOPE_PRIORITY[p.scope] === maxPriority);

  // Within same priority, newest effectiveFrom wins
  let newestTime = 0;
  for (const p of candidatesAtPriority) {
    const t = p.effectiveFrom.getTime();
    if (t > newestTime) newestTime = t;
  }
  const newestCandidates = candidatesAtPriority.filter(p => p.effectiveFrom.getTime() === newestTime);

  if (newestCandidates.length > 1) {
    return { kind: "AMBIGUOUS", candidatePolicyIds: newestCandidates.map(c => c.pricePolicyId) };
  }

  const chosen = newestCandidates[0]!;
  return {
    kind: "RESOLVED",
    pricePolicyId: chosen.pricePolicyId,
    unitPriceMinor: chosen.unitPriceMinor,
    currency: chosen.currency,
  };
}

export function evaluateOverrideRequest(
  mode: OverrideMode,
  basePriceMinor: number,
  proposedPriceMinor: number,
  operatorCapabilityFlags: readonly string[]
): { readonly decision: "ALLOW" | "NEEDS_APPROVAL" | "REJECT"; readonly reasonCode: string } {
  if (!Number.isInteger(basePriceMinor) || !Number.isInteger(proposedPriceMinor)) {
    return { decision: "REJECT", reasonCode: "INVALID_PRICE_NOT_INTEGER" };
  }
  if (proposedPriceMinor <= 0) {
    return { decision: "REJECT", reasonCode: "PRICE_MUST_BE_POSITIVE" };
  }
  // Floor: cannot be below 50% of base without approval, per ADR-0009 reasonable default
  const floor = Math.floor(basePriceMinor * 0.5);
  const ceiling = Math.ceil(basePriceMinor * 2);

  if (proposedPriceMinor < floor) {
    return { decision: "REJECT", reasonCode: "BELOW_FLOOR" };
  }
  if (proposedPriceMinor > ceiling) {
    return { decision: "REJECT", reasonCode: "ABOVE_CEILING" };
  }

  switch (mode) {
    case "HQ_ONLY":
      if (operatorCapabilityFlags.includes("PRICE_OVERRIDE_HQ")) {
        return { decision: "ALLOW", reasonCode: "HQ_OVERRIDE_ALLOWED" };
      }
      return { decision: "REJECT", reasonCode: "HQ_ONLY" };
    case "SUPERVISOR_APPROVED":
      if (operatorCapabilityFlags.includes("PRICE_OVERRIDE_SUPERVISOR")) {
        return { decision: "ALLOW", reasonCode: "SUPERVISOR_OVERRIDE" };
      }
      // Operator can request but needs approval
      return { decision: "NEEDS_APPROVAL", reasonCode: "NEEDS_SUPERVISOR_APPROVAL" };
    case "OPERATOR_ALLOWED":
      // Within 10% bounds auto-allow, else needs approval
      const delta = Math.abs(proposedPriceMinor - basePriceMinor) / basePriceMinor;
      if (delta <= 0.1) {
        return { decision: "ALLOW", reasonCode: "WITHIN_10PCT" };
      }
      return { decision: "NEEDS_APPROVAL", reasonCode: "OUTSIDE_10PCT_NEEDS_APPROVAL" };
    default:
      return { decision: "REJECT", reasonCode: "UNKNOWN_MODE" };
  }
}
