/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * The catalog is CONFIGURATION, never code (ADR-0025): no item names, categories or fallback
 * lists exist in the codebase, and the client renders only what the server returns (FR-MENU-005).
 */
import type { SellingLocationId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";

export interface MenuItemConfig {
  readonly menuItemId: string;
  readonly name: string;
  readonly kind: "SELLABLE" | "COMPONENT" | "PACKAGE";
  readonly components?: readonly { readonly menuItemId: string; readonly quantity: number }[];
  readonly isRetired: boolean;
}

export interface LocationMenuItem {
  readonly menuItemId: string;
  readonly name: string;
  /** resolved by the pricing feature, never by menu */
  readonly price?: Money;
  readonly available: boolean;
  readonly unavailableReason?: string;
}

/** Requirements: FR-MENU-001/002/007. Task: T-MENU-001. */
export async function upsertMenuItem(_input: {
  name: string; kind: MenuItemConfig["kind"];
  components?: MenuItemConfig["components"]; reason: string;
}): Promise<MenuItemConfig> {
  throw new Error("Not implemented: T-MENU-001");
}

/** Requirements: FR-MENU-003/004. Task: T-MENU-002. */
export async function setItemAvailability(_input: {
  sellingLocationId: SellingLocationId; menuItemId: string; available: boolean; reason: string;
}): Promise<LocationMenuItem> {
  throw new Error("Not implemented: T-MENU-002");
}

/** Requirements: FR-MENU-005. Task: T-MENU-002. Server-provided grid order; no client fallback. */
export async function getSellableGrid(_input: {
  sellingLocationId: SellingLocationId;
}): Promise<readonly LocationMenuItem[]> {
  throw new Error("Not implemented: T-MENU-002");
}
