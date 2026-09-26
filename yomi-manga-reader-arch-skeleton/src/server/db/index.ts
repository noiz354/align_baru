/**
 * server/db — database access (Drizzle + postgres driver).
 *
 * Responsibility: connection lifecycle (pool max 10, clean shutdown),
 * the schema (schema.ts → real DDL at T-FOUND-005), migrations runner
 * (boot-time, advisory-locked, expand/contract — DEPLOYMENT.md §4), and
 * the repository implementations (repositories/).
 *
 * Requirements: NFR-SEC-015 (parameterization), NFR-PERF-014 (indexes),
 * NFR-DATA-001/006.
 * Tasks: T-FOUND-005/006 (connection + migrations), T-CATALOG-001 &
 * friends (repositories).
 *
 * Rules:
 * - ONLY module allowed to import drizzle-orm / the driver (rule D2).
 * - Drizzle row types NEVER leak across the boundary: repository impls
 *   map rows → shared DTOs (data-flow.md §7).
 * - Every hot query names its index in a comment (T-PERF-004 gate list).
 *
 * TODO(T-FOUND-005): connection factory (driven by Env.databaseUrl).
 */

/**
 * Database handle (typed placeholder — the real type is the Drizzle DB
 * instance, exported once T-FOUND-005 lands).
 */
export interface Db {
  /**
   * TODO(T-FOUND-005): connection + pool (max 10) with clean shutdown;
   * boot migration runner (advisory lock; idempotent per revision).
   */
  close(): Promise<void>;
}

export function createDb(/* env: Env */): Promise<Db> {
  throw new Error('Not implemented: T-FOUND-005 (database connection)');
}
