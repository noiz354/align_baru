// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-RES-001..020.

import type { Id } from '../../shared/types';
import type { Level, Resource, ShoppingItem, ThresholdCrossing } from './types';

export type ResourceRepository = {
  findById(householdId: Id, resourceId: Id): Promise<Resource | null>;
  listByHousehold(
    householdId: Id,
    options?: { readonly includeArchived?: boolean },
  ): Promise<readonly Resource[]>;
  insert(resource: Resource): Promise<void>;
  update(resource: Resource): Promise<void>;
  archive(householdId: Id, resourceId: Id): Promise<void>;
  /** Low/critical set for the dashboard card, the alert engine, and the shopping deriver. */
  listBelowThreshold(householdId: Id): Promise<readonly Resource[]>;
  appendLevelHistory(entry: {
    readonly householdId: Id;
    readonly resourceId: Id;
    readonly fromLevel: Level;
    readonly toLevel: Level;
    readonly actorMemberId: Id;
    readonly reason: 'MANUAL' | 'RESTOCK' | 'MODE_CHANGE' | 'PURCHASE';
    readonly occurredAt: string;
  }): Promise<void>;
  /** householdId first: a crossing has no scope of its own. */
  appendCrossing(householdId: Id, crossing: ThresholdCrossing): Promise<void>;
};

export type ShoppingRepository = {
  listByHousehold(
    householdId: Id,
    options?: { readonly includePurchased?: boolean },
  ): Promise<readonly ShoppingItem[]>;
  insert(item: ShoppingItem): Promise<void>;
  remove(householdId: Id, itemId: Id): Promise<void>;
  markPurchased(householdId: Id, itemId: Id, purchasedAt: string): Promise<void>;
};
