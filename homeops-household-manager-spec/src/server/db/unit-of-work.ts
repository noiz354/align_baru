// HomeOps - server skeleton (specification phase). Boundary contract only.

import type { HouseholdContext } from '../auth/context';

/**
 * One transaction per use case; repository ports never open their own transactions
 * (ARCHITECTURE.md section 10).
 *
 * Rules:
 *  - every repository handle handed to a domain service is scoped to the context's household;
 *  - events and outbox rows are written inside the same transaction as the state change that caused
 *    them, so there are no ghost alerts and no lost activity (I-XA-007);
 *  - the unit of work is the only place that retries a serialization failure.
 *
 * Status: unimplemented by design. Owning task: T-PLAT-005.
 */
export type Repositories = {
  readonly household: unknown; // adapters implement the ports declared in src/domain/*/ports.ts
  readonly members: unknown;
  readonly rooms: unknown;
  readonly chores: unknown;
  readonly trash: unknown;
  readonly resources: unknown;
  readonly maintenance: unknown;
  readonly issues: unknown;
  readonly alerts: unknown;
  readonly activity: unknown;
};

export async function withUnitOfWork<T>(
  _ctx: HouseholdContext,
  _fn: (repos: Repositories) => Promise<T>,
): Promise<T> {
  throw new Error('Not implemented: T-PLAT-005');
}
