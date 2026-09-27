/**
 * Integration test database harness.
 *
 * What it provides: a REAL PostgreSQL database with the project's migrations applied, so integration
 * tests prove constraints, row-level security and transactions against the database instead of a mock
 * (TESTING.md §1.3: "A test that passes with a stub of the thing being tested is worse than no test").
 *
 * Two drivers, identical SQL:
 *   1. PGlite (default) - PostgreSQL compiled to WebAssembly, running in the test process. It is a real
 *      PostgreSQL 18 server (same catalog, same RLS, same constraints), not a simulator, and it keeps
 *      the suite hermetic: no container runtime, no network, no shared state between suites.
 *   2. `INTEGRATION_DATABASE_URL` - a throwaway PostgreSQL server (the service container in
 *      `ops/docker-compose.test.yml`). CI runs the same suite this way (T-TEST-001 owns the container
 *      lifecycle, schema-per-suite isolation and fixture seeding).
 *
 * Classified in `docs/research/STACK-2026.md` §16 as a dev-only harness dependency.
 *
 * Task ownership: T-SEC-001 (first consumer). The full harness - containers, isolated schema per suite,
 * seed generator, flaky detection - is T-TEST-001.
 */
import "./env";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@/server/db/schema";
import type { Db } from "@/server/db/client";

/** Role the application runs as. RLS only applies to a non-superuser, non-owner role (ADR-0017). */
export const TEST_APP_ROLE = "majelishub_app";

export interface TestDatabase {
  /** Drizzle handle used by repositories. */
  readonly db: Db;
  /** Run SQL as the superuser/owner: schema setup, deliberate tampering, RLS verification. */
  readonly exec: (sql: string) => Promise<void>;
  /** Query as the superuser/owner; returns rows. */
  readonly query: <T>(sql: string, params?: readonly unknown[]) => Promise<T[]>;
  /** True when running against an external PostgreSQL server rather than PGlite. */
  readonly isExternalServer: boolean;
  readonly close: () => Promise<void>;
}

/** Every migration in `drizzle/`, in filename order - the same files a deployment applies. */
export function migrationFiles(): { name: string; sql: string }[] {
  const dir = join(process.cwd(), "drizzle");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}

/** Create a database with all migrations applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const externalUrl = process.env["INTEGRATION_DATABASE_URL"];
  return externalUrl ? createExternal(externalUrl) : createPglite();
}

async function createPglite(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  const exec = async (sql: string) => {
    await client.exec(sql);
  };
  for (const migration of migrationFiles()) {
    await exec(migration.sql);
  }
  return {
    db,
    exec,
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const result = await client.query<T>(sql, params as unknown[]);
      return result.rows;
    },
    isExternalServer: false,
    close: async () => {
      await client.close();
    },
  };
}

async function createExternal(connectionString: string): Promise<TestDatabase> {
  const pool = new Pool({ connectionString });
  const db = drizzleNodePg(pool, { schema });
  const exec = async (sql: string) => {
    await pool.query(sql);
  };
  for (const migration of migrationFiles()) {
    await exec(migration.sql);
  }
  return {
    db,
    exec,
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      const result = await pool.query(sql, params as unknown[]);
      return result.rows as T[];
    },
    isExternalServer: true,
    close: async () => {
      await pool.end();
    },
  };
}
