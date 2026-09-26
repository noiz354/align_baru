'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';
import type { Level } from '../../domain/resources/types';

/**
 * Update a resource level (FR-RES-004). The highest-frequency action in the app: no
 * free-text number entry required, optimistic with undo, idempotent per clientRequestId.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-004 - requirements, ADR, design, and tests are listed there.
 */
export async function updateLevelAction(
  _input: { readonly resourceId: string; readonly level: Level; readonly clientRequestId: string },
): Promise<OperationResult<{ readonly resourceId: string; readonly band: 'OK' | 'LOW' | 'CRITICAL' }>> {
  throw new Error('Not implemented: T-RES-004');
}

/**
 * Restock a resource (FR-RES-008). One tap to target/FULL/AVAILABLE; closes the item
 * contribution to the grouped alert only when every listed item is restocked (I-RES-003).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-006 - requirements, ADR, design, and tests are listed there.
 */
export async function restockAction(
  _input: { readonly resourceId: string; readonly clientRequestId: string },
): Promise<OperationResult<{ readonly resourceId: string }>> {
  throw new Error('Not implemented: T-RES-006');
}

/**
 * Mark a shopping item bought (FR-SHOP-003). A linked item restocks its resource; an
 * unlinked item simply disappears, with undo offered for 8 seconds.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-SHOP-003 - requirements, ADR, design, and tests are listed there.
 */
export async function markShoppingItemBoughtAction(
  _input: { readonly itemId: string; readonly clientRequestId: string },
): Promise<OperationResult<{ readonly itemId: string; readonly restockedResourceId?: string }>> {
  throw new Error('Not implemented: T-SHOP-003');
}
