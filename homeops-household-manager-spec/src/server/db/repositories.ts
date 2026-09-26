// HomeOps - server skeleton (specification phase). Adapter map only.

/**
 * Which adapter implements which port. Each adapter must:
 *  - require a household-scoped context (no unscoped query exists);
 *  - map rows to domain objects explicitly (no leaking of database column names upward);
 *  - translate constraint violations into domain error codes, never into SQL text.
 *
 * The database *shape* lives in DATA_MODEL.md; table definitions and migrations are created in VS-0
 * (T-PLAT-004 onward). src/server/db/schema/ is deliberately absent in this phase
 * (ARCHITECTURE.md section 9).
 *
 * | Port (src/domain/.../ports.ts) | Adapter | First task |
 * | --- | --- | --- |
 * | HouseholdRepository, InvitationRepository | src/server/db/repositories/household.ts | T-PLAT-005 |
 * | MembershipRepository | .../members.ts | T-PLAT-005 |
 * | RoomRepository, RoomOverrideRepository, RoomEvidencePort | .../rooms.ts | T-PLAT-005 |
 * | ChoreDefinitionRepository, ChoreOccurrenceRepository | .../chores.ts | T-PLAT-005 |
 * | TrashRepository | .../trash.ts | T-PLAT-005 |
 * | ResourceRepository, ShoppingRepository | .../resources.ts | T-PLAT-005 |
 * | MaintenanceRepository | .../maintenance.ts | T-PLAT-005 |
 * | IssueRepository | .../issues.ts | T-PLAT-005 |
 * | AlertRepository | .../alerts.ts | T-PLAT-005 |
 * | ActivityRepository, AuditRepository | .../activity.ts | T-PLAT-005 |
 */

export const REPOSITORY_PORTS = [
  'household', 'members', 'rooms', 'chores', 'trash',
  'resources', 'maintenance', 'issues', 'alerts', 'activity',
] as const;

export function createRepositories(): never {
  throw new Error('Not implemented: T-PLAT-005');
}
