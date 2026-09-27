/**
 * Database client and transaction helpers - the ONLY place SQL is issued.
 *
 * Where this belongs: server/db (infrastructure). Domain code never sees this module - it goes through
 * repositories.
 * Specification: docs/research/STACK-2026.md §5 (PostgreSQL 18 + Drizzle), ADR-0020 (no migrations on
 * boot), DATA_MODEL.md §11 (constraint invariants), ADR-0017 (RLS session variables per transaction).
 *
 * Invariants implemented here (T-SEC-001):
 *   1. Migrations are applied by an explicit deploy step (`npm run db:migrate`) - never at application
 *      start-up (ADR-0020).
 *   2. Every transaction that touches tenant data sets the RLS session variables from the TenantScope,
 *      transaction-locally (`set_config(..., true)`), so nothing leaks across pooled connections.
 *   3. The transaction then switches to the non-superuser application role, which is what makes
 *      row-level security actually apply. RLS is the second layer; the scoped WHERE clause in the
 *      repositories is the first (ADR-0017 layers 2 and 3).
 *   4. A malformed or missing scope fails closed before any statement runs.
 *   5. No query is constructed by string interpolation of user input; the only interpolated identifier
 *      is the application role name, which `config()` has already validated as a SQL identifier.
 *
 * Failure cases: connection failure surfaces as an error to the caller (never a silent empty result);
 * statement timeout (`statement_timeout`) prevents a runaway query from holding an entrance hostage;
 * a transaction that throws is rolled back, which also discards the session variables.
 *
 * Task ownership: T-SEC-001 (scope + RLS wiring), T-ARCH-001 (schema scaffolding).
 */
import { sql, type SQL } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { assertScopeUsable, type TenantScope } from "@/shared/contracts/scope";
import { config } from "@/server/config";
import { schema, type Schema } from "./schema";

/** Driver-agnostic handle: repositories accept this whether the driver is `pg` or (in tests) PGlite. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

/** The transaction handle repositories receive inside `withScopedTransaction`. */
export type ScopedTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Alias kept for the stubs that already name it (src/server/audit/writer.ts, T-SEC-007). */
export type DbTransaction = ScopedTx;

/**
 * What a repository accepts: the process-wide handle or a scoped transaction. Repositories never open
 * their own transaction and never read `process.env` - the scope and the handle are always passed in
 * (ADR-0017 layer 2).
 */
export type DbHandle = Db | ScopedTx;

/** Session variables the RLS policies read (drizzle/0001_row_level_security.sql). */
export const RLS_VARIABLES = {
  organizationId: "app.organization_id",
  scopeKind: "app.scope",
  mosqueId: "app.mosque_id",
  eventId: "app.event_id",
  userId: "app.user_id",
} as const;

let pool: Pool | undefined;
let db: Db | undefined;

/** The underlying `pg` pool. Needed by the identity adapter (Better Auth speaks to `pg` directly). */
export function getPool(): Pool {
  getDb();
  if (!pool) throw new Error("Programming error: pool was not created");
  return pool;
}

/** Process-wide Drizzle instance over the `pg` pool. Created lazily; never reconnects on request. */
export function getDb(): Db {
  if (!db) {
    const cfg = config();
    pool = new Pool({
      connectionString: cfg.databaseUrl,
      statement_timeout: cfg.databaseStatementTimeoutMs,
      // A leaked `SET LOCAL` cannot survive a checked-in connection, but a leaked session variable can
      // if a client is reused mid-transaction; resetting on checkout is cheap defence in depth.
      idleTimeoutMillis: 30_000,
    });
    db = drizzleNodePg(pool, { schema });
  }
  return db;
}

/** Used by the worker/migration tooling and by tests that need to close the pool. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

/**
 * The statements that bind a transaction to a tenant. Exported because the isolation test suite needs
 * to prove the second layer on its own (ADR-0017 enforcement: "removes the application's WHERE clause
 * and asserts the database still refuses").
 */
export function rlsStatements(scope: TenantScope, userId?: string): SQL[] {
  assertScopeUsable(scope);
  const statements: SQL[] = [
    sql`SELECT set_config(${RLS_VARIABLES.organizationId}, ${scope.organizationId}, true)`,
    sql`SELECT set_config(${RLS_VARIABLES.scopeKind}, ${scope.kind}, true)`,
    sql`SELECT set_config(${RLS_VARIABLES.mosqueId}, ${scope.mosqueId ?? ""}, true)`,
    sql`SELECT set_config(${RLS_VARIABLES.eventId}, ${scope.eventId ?? ""}, true)`,
    sql`SELECT set_config(${RLS_VARIABLES.userId}, ${userId ?? scope.ownerId ?? ""}, true)`,
  ];
  return statements;
}

/** `SET LOCAL ROLE <app role>` - the identifier is validated by `config()` before it reaches here. */
export function useAppRoleStatement(appRole: string): SQL {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(appRole)) {
    throw new Error("Programming error: application role name is not a valid SQL identifier");
  }
  return sql`SET LOCAL ROLE ${sql.raw(appRole)}`;
}

/**
 * Run `fn` inside a transaction bound to `scope`.
 *
 * Order matters: session variables are set first, then the role switch, so the role change cannot
 * observe a connection state belonging to another tenant. Everything is transaction-local; the pool
 * never carries a tenant between requests.
 */
export async function withScopedTransaction<T>(
  handle: Db,
  scope: TenantScope,
  fn: (tx: ScopedTx) => Promise<T>,
  options?: { userId?: string; appRole?: string },
): Promise<T> {
  assertScopeUsable(scope);
  return handle.transaction(async (tx) => {
    for (const statement of rlsStatements(scope, options?.userId)) {
      await tx.execute(statement);
    }
    const appRole = options?.appRole ?? config().databaseAppRole;
    await tx.execute(useAppRoleStatement(appRole));
    return fn(tx);
  });
}

/**
 * Same, on the process-wide connection pool.
 *
 * @throws Error("Not implemented: T-ARCH-001") is no longer thrown: the transaction helper is real as
 *   of T-SEC-001. Schema scaffolding for the remaining modules is still T-ARCH-001.
 */
export async function withTransaction<T>(
  scope: TenantScope,
  fn: (tx: ScopedTx) => Promise<T>,
  options?: { userId?: string },
): Promise<T> {
  return withScopedTransaction(getDb(), scope, fn, options);
}
