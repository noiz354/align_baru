import { memoryStore, generateId } from "../../server/db/memory-store";
import type { SellingLocationId, AreaId, MenuItemId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";
import { money } from "../../shared/money/money";
import type { PriceResolution, OverrideMode, PricePolicyRow } from "../../domain/pricing";
import { resolvePrice, evaluateOverrideRequest } from "../../domain/pricing/resolution";
import { writeAuditEvent } from "../audit";
import { createHash } from "crypto";

export type { PriceResolution, OverrideMode };

// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function publishPricePolicy(input: {
  menuItemId: string; scope: "ORG" | "AREA" | "LOCATION"; scopeId: string;
  unitPrice: Money; effectiveFrom: Date; effectiveTo?: Date; reason: string; approvedByUserId?: string; organizationId?: string; createdBy?: string;
}): Promise<{ readonly pricePolicyId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Check overlapping identical specificity? For simplicity, allow but warn
  const id = generateId();
  const now = new Date();
  memoryStore.pricePolicies.set(id, {
    id,
    organizationId: orgId,
    menuItemId: input.menuItemId,
    scope: input.scope,
    scopeId: input.scopeId,
    unitPriceMinor: input.unitPrice.amountMinor,
    currency: "IDR",
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    reason: input.reason,
    createdBy: input.createdBy || "system",
    approvedBy: input.approvedByUserId,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.createdBy,
    action: "price.policy_published",
    subjectKind: "price_policy",
    subjectId: id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { menuItemId: input.menuItemId, scope: input.scope, price: input.unitPrice.amountMinor },
  });
  return { pricePolicyId: id };
}

export async function resolvePriceForSale(input: {
  menuItemId: MenuItemId; areaId?: AreaId; sellingLocationId?: SellingLocationId; at: Date; organizationId?: string;
}): Promise<PriceResolution> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const policies: PricePolicyRow[] = [];
  for (const p of memoryStore.pricePolicies.values()) {
    if (p.organizationId !== orgId) continue;
    if (p.menuItemId !== input.menuItemId) continue;
    policies.push({
      pricePolicyId: p.id,
      menuItemId: p.menuItemId,
      scope: p.scope as any,
      scopeId: p.scopeId,
      unitPriceMinor: p.unitPriceMinor,
      currency: p.currency as "IDR",
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo,
    });
  }
  const scope = {
    organizationId: orgId,
    areaId: input.areaId,
    sellingLocationId: input.sellingLocationId,
  };
  return resolvePrice(input.menuItemId, scope, policies, input.at);
}

export async function preparePriceSetDigest(input: {
  sellingLocationId: SellingLocationId; organizationId?: string; areaId?: string;
}): Promise<{ readonly digest: string; readonly itemCount: number }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const now = new Date();
  const items: { menuItemId: string; priceMinor: number; policyId: string }[] = [];
  for (const menuItem of memoryStore.menuItems.values()) {
    if (menuItem.organizationId !== orgId) continue;
    const res = await resolvePriceForSale({
      menuItemId: menuItem.id,
      sellingLocationId: input.sellingLocationId,
      areaId: input.areaId,
      at: now,
      organizationId: orgId,
    });
    if (res.kind === "RESOLVED") {
      items.push({ menuItemId: menuItem.id, priceMinor: res.unitPriceMinor, policyId: res.pricePolicyId });
    }
  }
  items.sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));
  const hash = createHash("sha256");
  hash.update(JSON.stringify(items));
  const digest = hash.digest("hex").slice(0, 16);
  return { digest, itemCount: items.length };
}

export async function requestPriceOverride(input: {
  shiftId: string; menuItemId: string; proposedPrice: Money; reasonCode: string; note?: string; mode?: OverrideMode; operatorFlags?: readonly string[];
}): Promise<{ readonly overrideId: string; readonly status: "ALLOWED" | "PENDING_APPROVAL" | "REJECTED" }> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  // Resolve base price
  const baseRes = await resolvePriceForSale({
    menuItemId: input.menuItemId,
    sellingLocationId: shift.startLocationId as any,
    at: new Date(),
    organizationId: shift.organizationId,
  });
  if (baseRes.kind !== "RESOLVED") {
    throw Object.assign(new Error("Base price not found, cannot override"), { code: "PRECONDITION_FAILED" });
  }
  const mode: OverrideMode = input.mode || "OPERATOR_ALLOWED";
  const flags = input.operatorFlags || [];
  const decision = evaluateOverrideRequest(mode, baseRes.unitPriceMinor, input.proposedPrice.amountMinor, flags);
  const overrideId = generateId();
  let status: "ALLOWED" | "PENDING_APPROVAL" | "REJECTED";
  if (decision.decision === "ALLOW") status = "ALLOWED";
  else if (decision.decision === "NEEDS_APPROVAL") status = "PENDING_APPROVAL";
  else status = "REJECTED";

  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "OPERATOR",
    actorId: shift.operatorId,
    action: status === "ALLOWED" ? "price.override_applied" : "price.override_requested",
    subjectKind: "price_override",
    subjectId: overrideId,
    reason: input.reasonCode,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { menuItemId: input.menuItemId, proposed: input.proposedPrice.amountMinor, base: baseRes.unitPriceMinor, decision: decision.decision },
  });

  return { overrideId, status };
}

export async function acknowledgePriceSet(input: {
  operatorId: string; priceSetDigest: string; organizationId?: string;
}): Promise<{ acknowledged: boolean }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const now = new Date();
  memoryStore.priceAcknowledgements.set(id, {
    id,
    organizationId: orgId,
    operatorId: input.operatorId,
    priceSetDigest: input.priceSetDigest,
    acknowledgedAt: now,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.operatorId,
    action: "price.acknowledged",
    subjectKind: "price_acknowledgement",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { digest: input.priceSetDigest },
  });
  return { acknowledged: true };
}
