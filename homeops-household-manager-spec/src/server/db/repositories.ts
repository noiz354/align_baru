// HomeOps — repository composition root (T-PLAT-005, ADR-003, ADR-005).
//
// Which adapter implements which port. Each adapter must:
//  - require a household-scoped context (no unscoped query exists);
//  - map rows to domain objects explicitly (no leaking of database column names upward);
//  - translate constraint violations into domain error codes, never into SQL text.
//
// | Port (src/domain/.../ports.ts)        | Adapter                              | First task  |
// | ------------------------------------- | ------------------------------------ | ----------- |
// | HouseholdRepository                   | src/server/db/repositories/household | T-PLAT-005  |
// | InvitationRepository                  | src/server/db/repositories/household | T-PLAT-005  |
// | MembershipRepository                  | src/server/db/repositories/members   | T-PLAT-005  |
// | ActivityRepository, AuditRepository   | src/server/db/repositories/activity  | T-ACT-001   |
// | IdempotencyStore, RateLimitStore,     | src/server/db/repositories/platform  | T-PLAT-012  |
// |   OutboxStore, SchedulerRunStore      |                                      | T-PLAT-025  |
// | RoomRepository, RoomOverrideRepository| src/server/db/repositories/rooms     | T-ROOM-001  |
// | ChoreDefinitionRepository, …          | src/server/db/repositories/chores    | T-CHORE-001 |
// | TrashRepository                       | src/server/db/repositories/trash     | T-TRASH-001 |
// | ResourceRepository, ShoppingRepository| src/server/db/repositories/resources | T-RES-001   |
// | MaintenanceRepository                 | src/server/db/repositories/maint     | T-MNT-001   |
// | IssueRepository                       | src/server/db/repositories/issues    | T-ISSUE-001 |
// | AlertRepository                       | src/server/db/repositories/alerts    | T-ALERT-001 |

import type { Id } from '../../shared/types';
import type { Clock } from '../../shared/time/clock';
import type { ActivityRepository, AuditRepository } from '../../domain/activity/ports';
import type { HouseholdRepository, InvitationRepository } from '../../domain/household/ports';
import type { MembershipRepository } from '../../domain/members/ports';
import type { IdempotencyStore } from '../../shared/contracts/idempotency';
import type { OutboxStore } from '../../shared/contracts/outbox';
import type { RateLimitStore } from '../../shared/contracts/rate-limit';
import { createActivityRepository, createAuditRepository } from './repositories/activity';
import { createHouseholdRepository, createInvitationRepository } from './repositories/household';
import { createMembershipRepository } from './repositories/members';
import { createIdempotencyStore, createOutboxStore, createRateLimitStore } from './repositories/platform';
import type { IdGenerator } from './id';
import type { DbOrTx } from './unit-of-work';

export const REPOSITORY_PORTS = [
  'household',
  'members',
  'rooms',
  'chores',
  'trash',
  'resources',
  'maintenance',
  'issues',
  'alerts',
  'activity',
] as const;

/**
 * The repositories a feature service receives inside a unit of work. Every one of them is bound to
 * `householdId`: a call that passes a different household id gets an empty/`null` result, so a
 * cross-household read is not merely discouraged but unreachable (ADR-005, T-SEC-002).
 */
export type Repositories = {
  readonly household: HouseholdRepository;
  readonly invitations: InvitationRepository;
  readonly members: MembershipRepository;
  readonly activity: ActivityRepository;
  readonly audit: AuditRepository;
  readonly idempotency: IdempotencyStore;
  readonly rateLimits: RateLimitStore;
  readonly outbox: OutboxStore;
};

export type RepositoryDeps = {
  readonly db: DbOrTx;
  readonly householdId: Id;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly actor?: { readonly userId: Id; readonly memberId: Id };
};

export function createRepositories(deps: RepositoryDeps): Repositories {
  const householdDeps = {
    db: deps.db,
    householdId: deps.householdId,
    clock: deps.clock,
    ...(deps.actor ? { actor: deps.actor } : {}),
  };
  const activityDeps = { db: deps.db, householdId: deps.householdId, clock: deps.clock };
  return {
    household: createHouseholdRepository(householdDeps),
    invitations: createInvitationRepository(householdDeps),
    members: createMembershipRepository(activityDeps),
    activity: createActivityRepository(activityDeps),
    audit: createAuditRepository(activityDeps),
    idempotency: createIdempotencyStore(deps.db),
    rateLimits: createRateLimitStore(deps.db),
    outbox: createOutboxStore(deps.db),
  };
}
