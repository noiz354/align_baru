// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-ROOM-001..012.

import type { Id } from '../../shared/types';
import type { Room, RoomEvidence, StatusOverride } from './types';

export type RoomRepository = {
  findById(householdId: Id, roomId: Id): Promise<Room | null>;
  listByHousehold(householdId: Id, options?: { readonly includeArchived?: boolean }): Promise<readonly Room[]>;
  insert(room: Room): Promise<void>;
  update(room: Room): Promise<void>;
  archive(householdId: Id, roomId: Id): Promise<void>;
  /** Soft cap feedback (50 rooms) - a nudge, never a hard wall (docs/domain/ERRORS.md). */
  countActive(householdId: Id): Promise<number>;
};

export type RoomOverrideRepository = {
  findActive(householdId: Id, roomId: Id): Promise<StatusOverride | null>;
  /** householdId first: an override has no scope of its own. */
  insert(householdId: Id, override: StatusOverride): Promise<void>;
  replace(householdId: Id, roomId: Id, override: StatusOverride): Promise<void>;
  deleteExpired(householdId: Id, now: Date): Promise<number>;
};

/** Evidence loader for derivation: one batched query per room list, never one per room (PERFORMANCE.md PB-S3). */
export type RoomEvidencePort = {
  loadEvidence(householdId: Id, roomIds: readonly Id[]): Promise<ReadonlyMap<Id, RoomEvidence>>;
};
