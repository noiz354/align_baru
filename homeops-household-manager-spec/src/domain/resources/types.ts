// HomeOps - domain skeleton (specification phase). Types and value objects only.
// Owning tasks: T-RES-001..020.

import type { ApproximateLevel, BinaryLevel, Id, Instant, ResourceMode } from '../../shared/types';

/**
 * The level union is mode-exhaustive on purpose: the type system refuses a quantity on an
 * approximate item, and refuses a band level on a counted one (I-RES-001, ADR-011).
 */
export type Level =
  | { readonly mode: 'EXACT'; readonly quantity: number; readonly unit: string }
  | { readonly mode: 'APPROXIMATE'; readonly level: ApproximateLevel }
  | { readonly mode: 'AVAILABLE_UNAVAILABLE'; readonly level: BinaryLevel };

export type Thresholds = {
  /** At or below this, the item is LOW (EXACT only; APPROXIMATE derives bands). */
  readonly lowAt: number;
  /** At or below this, the item is CRITICAL (EXACT: default 1; binary UNAVAILABLE is always critical). */
  readonly criticalAt: number;
};

export type Resource = {
  readonly id: Id;
  readonly householdId: Id;
  readonly name: string;
  readonly category?: string;
  readonly roomId?: Id;
  readonly mode: ResourceMode;
  readonly level: Level;
  /** "How much we like to keep" - used by restock and by the EXACT default threshold. */
  readonly targetQuantity?: number;
  readonly thresholds?: Thresholds;
  readonly notes?: string;
  readonly archivedAt?: Instant;
};

/** Crossing direction matters: alerts fire on transitions, not on every update (I-RES-005). */
export type ThresholdCrossing = {
  readonly resourceId: Id;
  readonly direction: 'ENTERED_LOW' | 'ENTERED_CRITICAL' | 'LEFT_LOW' | 'LEFT_CRITICAL';
  readonly band: 'LOW' | 'CRITICAL';
  readonly atInstant: Instant;
};

export type ShoppingItem = {
  readonly id: Id;
  readonly householdId: Id;
  readonly label: string;
  /** Present when the item was derived from (or linked to) a resource; buying it restocks that resource. */
  readonly resourceId?: Id;
  readonly purchasedAt?: Instant;
  readonly createdByMemberId?: Id;
};
