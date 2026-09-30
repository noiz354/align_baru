import { memoryStore, type StoredPricePolicy } from "@/server/db/memory-store";
import { resolvePrice, type PricePolicyRow, type PriceResolution } from "@/domain/pricing/resolution";

export interface CatalogFilters {
  search?: string;
  categoryId?: string;
  status?: "ACTIVE" | "INACTIVE";
  sellingLocationId?: string;
  limit?: number;
  offset?: number;
  at?: Date;
}

export interface CatalogPrice {
  policyId: string;
  amountMinor: number;
  currency: "IDR";
  scope: "ORG" | "AREA" | "LOCATION";
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string | null;
  active: boolean;
  canDeactivate: boolean;
  sortOrder: number;
  basePrice: CatalogPrice | null;
  effectivePrice: CatalogPrice | null;
  effectivePriceState: "RESOLVED" | "NOT_SELLABLE" | "AMBIGUOUS";
  pricePolicies: Array<CatalogPrice & { scopeId: string; scopeLabel: string; state: "CURRENT" | "FUTURE" | "EXPIRED" }>;
  totalPolicyCount: number;
}

function toPolicyRow(policy: StoredPricePolicy): PricePolicyRow {
  return {
    pricePolicyId: policy.id,
    menuItemId: policy.menuItemId,
    scope: policy.scope,
    scopeId: policy.scopeId,
    unitPriceMinor: policy.unitPriceMinor,
    currency: policy.currency,
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo,
  };
}

function toPrice(policy: { id: string; unitPriceMinor: number; effectiveFrom: Date; effectiveTo?: Date }): CatalogPrice {
  const stored = memoryStore.pricePolicies.get(policy.id)!;
  return {
    policyId: policy.id,
    amountMinor: policy.unitPriceMinor,
    currency: "IDR",
    scope: stored.scope,
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveTo: policy.effectiveTo?.toISOString() ?? null,
  };
}

function resolvedPrice(result: PriceResolution, policyRows: PricePolicyRow[]): CatalogPrice | null {
  if (result.kind !== "RESOLVED") return null;
  const source = policyRows.find((policy) => policy.pricePolicyId === result.pricePolicyId);
  if (!source) return null;
  return toPrice({ id: source.pricePolicyId, unitPriceMinor: source.unitPriceMinor, effectiveFrom: source.effectiveFrom, effectiveTo: source.effectiveTo });
}

export function listCatalogProducts(organizationId: string, filters: CatalogFilters = {}): {
  data: CatalogProduct[];
  categories: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; label: string }>;
  locations: Array<{ id: string; name: string; areaId: string }>;
  pagination: { total: number; limit: number; offset: number };
  effectiveAt: string;
} {
  const at = filters.at ?? new Date();
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 100));
  const offset = Math.max(0, filters.offset ?? 0);
  const search = filters.search?.trim().toLocaleLowerCase("id-ID");
  const categories = Array.from(memoryStore.menuCategories.values())
    .filter((category) => category.organizationId === organizationId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name }));
  const locations = Array.from(memoryStore.sellingLocations.values())
    .filter((location) => location.organizationId === organizationId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name, areaId }) => ({ id, name, areaId }));
  const areaIds = new Set<string>();
  for (const stall of memoryStore.stalls.values()) if (stall.organizationId === organizationId) areaIds.add(stall.areaId);
  for (const location of memoryStore.sellingLocations.values()) if (location.organizationId === organizationId) areaIds.add(location.areaId);
  const areas = Array.from(areaIds).sort().map((id) => ({ id, label: id }));
  const allProducts = Array.from(memoryStore.menuItems.values())
    .filter((item) => item.organizationId === organizationId)
    .filter((item) => !search || item.name.toLocaleLowerCase("id-ID").includes(search))
    .filter((item) => !filters.categoryId || item.categoryId === filters.categoryId)
    .filter((item) => !filters.status || (filters.status === "ACTIVE" ? item.active : !item.active))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const data = allProducts.slice(offset, offset + limit).map((item): CatalogProduct => {
    const itemPolicies = Array.from(memoryStore.pricePolicies.values())
      .filter((policy) => policy.organizationId === organizationId && policy.menuItemId === item.id)
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
    const policyRows = itemPolicies.map(toPolicyRow);
    const outlet = filters.sellingLocationId ? memoryStore.sellingLocations.get(filters.sellingLocationId) : undefined;
    const scope = outlet?.organizationId === organizationId
      ? { organizationId, areaId: outlet.areaId, sellingLocationId: outlet.id }
      : { organizationId };
    const effective = resolvePrice(item.id, scope, policyRows, at);
    const base = resolvePrice(item.id, { organizationId }, policyRows, at);
    const pricePolicies = itemPolicies.slice(0, 12).map((policy) => ({
      ...toPrice({ id: policy.id, unitPriceMinor: policy.unitPriceMinor, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo }),
      scopeId: policy.scopeId,
      scopeLabel: policy.scope === "ORG" ? "Organisasi"
        : policy.scope === "AREA" ? `Area · ${policy.scopeId}`
        : (memoryStore.sellingLocations.get(policy.scopeId)?.organizationId === organizationId
          ? memoryStore.sellingLocations.get(policy.scopeId)!.name
          : "Lokasi tidak tersedia"),
      state: policy.effectiveFrom > at ? "FUTURE" as const : policy.effectiveTo && policy.effectiveTo <= at ? "EXPIRED" as const : "CURRENT" as const,
    }));
    return {
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: categories.find((category) => category.id === item.categoryId)?.name ?? null,
      active: item.active,
      canDeactivate: item.active && !hasCurrentOrFuturePricePolicy(item.id, organizationId, at),
      sortOrder: item.sortOrder,
      basePrice: resolvedPrice(base, policyRows),
      effectivePrice: resolvedPrice(effective, policyRows),
      effectivePriceState: effective.kind,
      pricePolicies,
      totalPolicyCount: itemPolicies.length,
    };
  });

  return { data, categories, areas, locations, pagination: { total: allProducts.length, limit, offset }, effectiveAt: at.toISOString() };
}

export function getCatalogScopeTarget(input: { organizationId: string; scope: "ORG" | "AREA" | "LOCATION"; scopeId: string }) {
  if (input.scope === "ORG") return input.scopeId === input.organizationId ? { kind: "org" as const, organizationId: input.organizationId } : null;
  if (input.scope === "AREA") {
    const belongs = Array.from(memoryStore.stalls.values()).some((stall) => stall.organizationId === input.organizationId && stall.areaId === input.scopeId)
      || Array.from(memoryStore.sellingLocations.values()).some((location) => location.organizationId === input.organizationId && location.areaId === input.scopeId);
    return belongs ? { kind: "area" as const, organizationId: input.organizationId, areaId: input.scopeId } : null;
  }
  const location = memoryStore.sellingLocations.get(input.scopeId);
  return location?.organizationId === input.organizationId
    ? { kind: "org" as const, organizationId: input.organizationId }
    : null;
}

export function hasCurrentOrFuturePricePolicy(itemId: string, organizationId: string, at = new Date()): boolean {
  return Array.from(memoryStore.pricePolicies.values()).some((policy) => policy.organizationId === organizationId
    && policy.menuItemId === itemId
    && (!policy.effectiveTo || policy.effectiveTo > at));
}
