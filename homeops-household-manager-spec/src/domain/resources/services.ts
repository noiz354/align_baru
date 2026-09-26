// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, ResourceMode } from '../../shared/types';
import type { Level, Resource, ShoppingItem } from './types';

export type ResourceDeps = {
  readonly resources: import('./ports').ResourceRepository;
  readonly shopping: import('./ports').ShoppingRepository;
  readonly clock: Clock;
};

/**
 * Apply a level update (used one, band chips, a counted correction). Idempotent per
 * clientRequestId; EXACT quantities clamp at zero; every update writes a level-history row
 * (FR-RES-012) and feeds crossing detection (I-RES-005).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-004 - requirements, ADR, design, and tests are listed there.
 */
export async function updateResourceLevel(
  _deps: ResourceDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly resourceId: Id;
    readonly nextLevel: Level;
    readonly clientRequestId: string;
  },
): Promise<Resource> {
  throw new Error('Not implemented: T-RES-004');
}

/**
 * Restock (FR-RES-008): set the level to target/FULL/AVAILABLE, remove the item from the
 * grouped alert, remove the derived shopping entry, and record actor/time. Idempotent.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-006 - requirements, ADR, design, and tests are listed there.
 */
export async function recordRestock(
  _deps: ResourceDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly resourceId: Id; readonly clientRequestId: string },
): Promise<Resource> {
  throw new Error('Not implemented: T-RES-006');
}

/**
 * Change the quantity mode (FR-RES-002). Requires explicit confirmation because it resets the
 * level (I-RES-002); the previous level is recorded so the reset is visible in history. Repeating
 * the current mode is a no-op. Thresholds and alerts are re-evaluated under the new semantics.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-007 - requirements, ADR, design, and tests are listed there.
 */
export async function changeQuantityMode(
  _deps: ResourceDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly resourceId: Id;
    readonly mode: ResourceMode;
    readonly targetQuantity?: number;
    readonly confirmed: boolean;
  },
): Promise<Resource> {
  throw new Error('Not implemented: T-RES-007');
}

/**
 * Derive the shopping list from low/critical resources, merged with manual items
 * (FR-SHOP-001/003). Ordering: critical first, then alphabetical within category. Derived items
 * disappear when the resource is restocked; manual items are independent.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-016 - requirements, ADR, design, and tests are listed there.
 */
export async function deriveShoppingList(
  _deps: ResourceDeps,
  _input: { readonly householdId: Id },
): Promise<readonly ShoppingItem[]> {
  throw new Error('Not implemented: T-RES-016');
}

/**
 * Mark a shopping item as bought (FR-SHOP-003). A linked item restocks its resource; an
 * unlinked item simply disappears. Undo is available for 8 s at the UI layer.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-SHOP-003 - requirements, ADR, design, and tests are listed there.
 */
export async function purchaseShoppingItem(
  _deps: ResourceDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly itemId: Id; readonly clientRequestId: string },
): Promise<ShoppingItem> {
  throw new Error('Not implemented: T-SHOP-003');
}
