// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-TRASH-001..012.

import type { Id } from '../../shared/types';
import type { TrashContainer, TrashStateEvent } from './types';

export type TrashRepository = {
  findById(householdId: Id, containerId: Id): Promise<TrashContainer | null>;
  listByHousehold(householdId: Id, options?: { readonly includeArchived?: boolean }): Promise<readonly TrashContainer[]>;
  insert(container: TrashContainer): Promise<void>;
  update(container: TrashContainer): Promise<void>;
  archive(householdId: Id, containerId: Id): Promise<void>;
  /** History reads for the container page (last 30 days) and retention pruning (24 months). */
  listStateEvents(householdId: Id, containerId: Id, since: Date): Promise<readonly TrashStateEvent[]>;
  /** householdId first: a state event has no scope of its own (I-XA-001a). */
  appendStateEvent(householdId: Id, event: TrashStateEvent): Promise<void>;
};
