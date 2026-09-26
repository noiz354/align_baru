// HomeOps - domain skeleton (specification phase). Ports only.

import type { Id, LocalDate } from '../../shared/types';
import type { ChoreDefinition, ChoreOccurrence } from './types';

export type ChoreDefinitionRepository = {
  findById(householdId: Id, definitionId: Id): Promise<ChoreDefinition | null>;
  listByHousehold(householdId: Id, options?: { readonly includeArchived?: boolean }): Promise<readonly ChoreDefinition[]>;
  insert(definition: ChoreDefinition): Promise<void>;
  update(definition: ChoreDefinition): Promise<void>;
  archive(householdId: Id, definitionId: Id): Promise<void>;
  /** Materialisation input: active definitions with no open occurrence (the anti-stacking query). */
  listNeedingOccurrence(householdId: Id, horizonDays: number): Promise<readonly ChoreDefinition[]>;
};

export type ChoreOccurrenceRepository = {
  findById(householdId: Id, occurrenceId: Id): Promise<ChoreOccurrence | null>;
  /** The unique occurrenceKey makes this the idempotency check for materialisation (I-CHORE-003). */
  findByKey(householdId: Id, occurrenceKey: string): Promise<ChoreOccurrence | null>;
  findOpenByDefinition(householdId: Id, definitionId: Id): Promise<ChoreOccurrence | null>;
  listOpenByHousehold(householdId: Id): Promise<readonly ChoreOccurrence[]>;
  listByDefinition(householdId: Id, definitionId: Id, limit: number): Promise<readonly ChoreOccurrence[]>;
  insert(occurrence: ChoreOccurrence): Promise<void>;
  /** Transitions only; adapters must reject writes to terminal occurrences (OCCURRENCE_NOT_OPEN). */
  update(occurrence: ChoreOccurrence): Promise<void>;
};

export type ReopenWindowPort = {
  /** Reopen is allowed for the completer within 24 h, and for OWNER/ADMIN with a reason (T-CHORE-005). */
  canReopen(householdId: Id, input: {
    readonly completedAtInstant: string;
    readonly completerMemberId: Id;
    readonly actorMemberId: Id;
    readonly actorRole: string;
    readonly nowInstant: string;
  }): boolean;
};
