/**
 * Database client and transaction helpers.
 *
 * Where this belongs: server/db (infrastructure; the ONLY place SQL is issued). Domain code never sees
 * this module - it goes through repositories.
 * Specification: docs/research/STACK-2026.md §5 (Postgres 18 + Drizzle), ADR-0020 (no migrations on
 *   boot), DATA_MODEL.md §11 (14 constraint invariants), ADR-0017 (RLS session variables per tx).
 * Invariants:
 *   1. Migrations are applied by an explicit deploy step (`npm run db:migrate`) - never at application
 *      start-up (ADR-0020).
 *   2. Every transaction that touches tenant data sets the RLS session variables from the TenantScope.
 *   3. Statement timeouts are configured so a runaway query cannot hold an entrance hostage.
 *   4. No query is constructed by string interpolation of user input.
 * Task ownership: T-SEC-001/003 (scope + RLS), T-ARCH-001 (schema scaffolding),
 *   T-ORG-001 (the pooled client itself).
 */
import { type SQL } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { optionalEnv, requiredEnv, requiredIntEnv } from "@/server/bootstrap/env";
import * as identity from "@/server/db/schema/identity";

/**
 * The schema is assembled here, one entry per module that owns tables. Only `identity` exists today;
 * each later slice registers its own schema in this object and nothing else needs to change.
 */
export const schema = { ...identity } as const;

export type Database = NodePgDatabase<typeof schema>;

/**
 * The narrowest surface a repository needs: execute one statement, get rows back.
 *
 * Both the pooled node-postgres client and the embedded Postgres used by tests satisfy it, which is
 * what lets repository tests run without a container while still executing real SQL. Repositories
 * take this rather than `Database` for exactly that reason.
 */
export interface SqlExecutor {
  /**
   * Deliberately not generic in the row type: the two drivers disagree on the exact result shape,
   * and a generic signature here makes neither assignable. Repositories narrow the rows they read
   * with an explicit cast instead, which keeps the SQL and the row contract next to each other.
   */
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

let pool: Pool | undefined;
let database: Database | undefined;

/**
 * The process-wide pooled client.
 *
 * Lazy on purpose: importing this module must not require `DATABASE_URL`, so that unit tests and
 * documentation tooling can import the schema without a database. The first call opens the pool.
 *
 * Pool sizing and statement timeout come from the environment (`DATABASE_POOL_MAX`,
 * `DATABASE_STATEMENT_TIMEOUT_MS`) so an operator can tune them without a rebuild.
 */
export function db(): Database {
  if (database) return database;

  pool = new Pool({
    connectionString: requiredEnv("DATABASE_URL"),
    max: requiredIntEnv("DATABASE_POOL_MAX", 10),
    // A statement that runs away is worse than a statement that fails: at a busy entrance the
    // connection it holds is the resource everything else is waiting for.
    statement_timeout: requiredIntEnv("DATABASE_STATEMENT_TIMEOUT_MS", 5_000),
    // `TRUSTED_PROXY_HOPS` is a perimeter concern and belongs to the web tier, not the pool.
    application_name: optionalEnv("OTEL_SERVICE_NAME", "majelishub"),
  });

  database = drizzle(pool, { schema });
  return database;
}

/** Closes the pool. Used by the worker shutdown path and by tests. */
export async function closeDb(): Promise<void> {
  if (!pool) return;
  const closing = pool;
  pool = undefined;
  database = undefined;
  await closing.end();
}

export interface DbTransaction {
  /** Opaque handle; repositories are the only consumers. */
  readonly scopeId: string;
}

/**
 * @throws Error("Not implemented: T-ARCH-001") — the transactional helper belongs to the schema
 * scaffolding task: it must also apply the RLS session variables from the scope (T-SEC-001), and
 * shipping it without that would give later slices a helper that looks safe and is not.
 */
export async function withTransaction<T>(
  scope: import("@/shared/contracts/scope").TenantScope,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  void scope;
  void fn;
  throw new Error("Not implemented: T-ARCH-001");
}
