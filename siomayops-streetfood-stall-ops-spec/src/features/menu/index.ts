import { memoryStore, generateId } from "../../server/db/memory-store";
import type { SellingLocationId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { resolvePriceForSale } from "../pricing";

export interface MenuItemConfig {
  readonly menuItemId: string;
  readonly name: string;
  readonly kind: "SELLABLE" | "COMPONENT" | "PACKAGE";
  readonly components?: readonly { readonly menuItemId: string; readonly quantity: number }[];
  readonly isRetired: boolean;
  readonly organizationId: string;
}

export interface LocationMenuItem {
  readonly menuItemId: string;
  readonly name: string;
  readonly price?: Money;
  readonly available: boolean;
  readonly unavailableReason?: string;
}

// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

// In-memory availability map: key = sellingLocationId|menuItemId
const availabilityMap = new Map<string, { available: boolean; reason: string }>();

export async function upsertMenuItem(input: {
  name: string; kind: MenuItemConfig["kind"];
  components?: MenuItemConfig["components"]; reason: string; organizationId?: string; categoryId?: string;
}): Promise<MenuItemConfig> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  // Ensure category exists or create default
  let categoryId = input.categoryId;
  if (!categoryId) {
    // Find or create default category
    let cat = Array.from(memoryStore.menuCategories.values()).find(c => c.organizationId === orgId);
    if (!cat) {
      const catId = generateId();
      cat = { id: catId, organizationId: orgId, name: "Default", sortOrder: 0 };
      memoryStore.menuCategories.set(catId, cat);
    }
    categoryId = cat.id;
  }
  const now = new Date();
  memoryStore.menuItems.set(id, {
    id,
    organizationId: orgId,
    categoryId: categoryId!,
    name: input.name,
    active: true,
    sortOrder: memoryStore.menuItems.size,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    action: "menu.item_upserted",
    subjectKind: "menu_item",
    subjectId: id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { name: input.name, kind: input.kind },
  });
  return {
    menuItemId: id,
    name: input.name,
    kind: input.kind,
    components: input.components,
    isRetired: false,
    organizationId: orgId,
  };
}

export async function setItemAvailability(input: {
  sellingLocationId: SellingLocationId; menuItemId: string; available: boolean; reason: string; organizationId?: string;
}): Promise<LocationMenuItem> {
  const key = `${input.sellingLocationId}|${input.menuItemId}`;
  availabilityMap.set(key, { available: input.available, reason: input.reason });
  const menuItem = memoryStore.menuItems.get(input.menuItemId);
  await writeAuditEvent({
    organizationId: input.organizationId || DEFAULT_ORG,
    actorKind: "HQ_USER",
    action: "menu.availability_changed",
    subjectKind: "menu_availability",
    subjectId: input.menuItemId,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { sellingLocationId: input.sellingLocationId, available: input.available },
  });
  return {
    menuItemId: input.menuItemId,
    name: menuItem?.name || "Unknown",
    available: input.available,
    unavailableReason: input.available ? undefined : input.reason,
  };
}

export async function getSellableGrid(input: {
  sellingLocationId: SellingLocationId; organizationId?: string; areaId?: string;
}): Promise<readonly LocationMenuItem[]> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const result: LocationMenuItem[] = [];
  for (const item of memoryStore.menuItems.values()) {
    if (item.organizationId !== orgId) continue;
    if (!item.active) continue;
    const key = `${input.sellingLocationId}|${item.id}`;
    const avail = availabilityMap.get(key);
    const available = avail ? avail.available : true;
    const unavailableReason = avail && !avail.available ? avail.reason : undefined;

    // Resolve price
    let price: Money | undefined;
    try {
      const resolution = await resolvePriceForSale({
        menuItemId: item.id,
        sellingLocationId: input.sellingLocationId,
        areaId: input.areaId,
        at: new Date(),
        organizationId: orgId,
      });
      if (resolution.kind === "RESOLVED") {
        const { money } = await import("../../shared/money/money");
        price = money(resolution.unitPriceMinor, "IDR");
      }
    } catch {
      // ignore
    }

    result.push({
      menuItemId: item.id,
      name: item.name,
      price,
      available,
      unavailableReason,
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export async function listMenuItems(orgId: string): Promise<MenuItemConfig[]> {
  const result: MenuItemConfig[] = [];
  for (const item of memoryStore.menuItems.values()) {
    if (item.organizationId !== orgId) continue;
    result.push({
      menuItemId: item.id,
      name: item.name,
      kind: "SELLABLE",
      isRetired: !item.active,
      organizationId: item.organizationId,
    });
  }
  return result;
}
