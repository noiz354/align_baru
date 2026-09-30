import { memoryStore, generateId } from "../../server/db/memory-store";
import type { SellingLocationId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { resolvePriceForSale } from "../pricing";
import { hasCurrentOrFuturePricePolicy } from "./catalog";

export * from "./catalog";
export * from "./analytics";

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

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

// In-memory availability map: key = sellingLocationId|menuItemId
const availabilityMap = new Map<string, { available: boolean; reason: string }>();

export async function upsertMenuItem(input: {
  name: string; kind: "SELLABLE"; reason: string; organizationId?: string; categoryId: string;
  actorId?: string; actorRole?: string;
}): Promise<MenuItemConfig> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const name = input.name.trim();
  const reason = input.reason.trim();
  if (name.length < 2 || name.length > 120) throw Object.assign(new Error("Product name must be 2–120 characters"), { code: "VALIDATION_FAILED", status: 400 });
  if (reason.length < 3 || reason.length > 300) throw Object.assign(new Error("A reason of 3–300 characters is required"), { code: "VALIDATION_FAILED", status: 400 });
  if (input.kind !== "SELLABLE") throw Object.assign(new Error("Only simple sellable items are supported"), { code: "UNSUPPORTED", status: 422 });
  const category = memoryStore.menuCategories.get(input.categoryId);
  if (!category || category.organizationId !== orgId) throw Object.assign(new Error("Menu category not found"), { code: "NOT_FOUND", status: 404 });
  const id = generateId();
  const now = new Date();
  const sortOrder = Array.from(memoryStore.menuItems.values())
    .filter((item) => item.organizationId === orgId)
    .reduce((maximum, item) => Math.max(maximum, item.sortOrder), 0) + 1;
  memoryStore.menuItems.set(id, {
    id,
    organizationId: orgId,
    categoryId: category.id,
    name,
    active: true,
    sortOrder,
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "menu.item_upserted",
    subjectKind: "menu_item",
    subjectId: id,
    reason,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { name, kind: input.kind, categoryId: category.id },
  });
  return { menuItemId: id, name, kind: "SELLABLE", isRetired: false, organizationId: orgId };
}

export async function setMenuItemStatus(input: {
  menuItemId: string; active: boolean; reason: string; organizationId: string; actorId: string; actorRole?: string;
}): Promise<{ menuItemId: string; active: boolean }> {
  const item = memoryStore.menuItems.get(input.menuItemId);
  if (!item || item.organizationId !== input.organizationId) throw Object.assign(new Error("Product not found"), { code: "NOT_FOUND", status: 404 });
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 300) throw Object.assign(new Error("A reason of 3–300 characters is required"), { code: "VALIDATION_FAILED", status: 400 });
  if (item.active === input.active) throw Object.assign(new Error("Product already has this status"), { code: "CONFLICT", status: 409 });
  if (!input.active && hasCurrentOrFuturePricePolicy(item.id, input.organizationId)) {
    throw Object.assign(new Error("A current or future price policy references this product; replace or expire its pricing before deactivation"), { code: "PRECONDITION_FAILED", status: 409 });
  }
  const previousActive = item.active;
  item.active = input.active;
  memoryStore.menuItems.set(item.id, item);
  await writeAuditEvent({
    organizationId: input.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "menu.item_status_changed",
    subjectKind: "menu_item",
    subjectId: item.id,
    reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { active: previousActive },
    afterSummary: { active: item.active },
  });
  return { menuItemId: item.id, active: item.active };
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
