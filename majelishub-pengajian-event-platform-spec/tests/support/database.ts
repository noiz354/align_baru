/**
 * Embedded PostgreSQL for repository tests (T-ORG-001).
 *
 * Why this exists: repository tests must prove invariants **against a database**, not against a mock
 * (TESTING.md §1/§2). The harness specified by T-TEST-001 uses containerised PostgreSQL 18; this is
 * the same engine compiled to WebAssembly, so the SQL that matters here — `INSERT … ON CONFLICT`,
 * partial and expression indexes, `CHECK` constraints — behaves identically on a machine with no
 * Docker. Nothing about the assertions depends on WASM; pointing the same suites at a container later
 * is a T-TEST-001 configuration change, not a rewrite.
 *
 * Rules:
 *   1. Each suite gets its own database instance. There is no shared state between tests.
 *   2. The schema comes from the committed migration files in `drizzle/`, never from a hand-written
 *      copy, so a test cannot pass against a schema that does not exist in a deployment.
 *   3. Fixtures are synthetic (docs/testing/TEST-DATA.md).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as identity from "@/server/db/schema/identity";

export const testSchema = { ...identity };

const MIGRATION_DIR = "drizzle";

/** The committed migrations, split the way Drizzle Kit writes them. */
export function migrationStatements(): readonly string[] {
  const files = readdirSync(MIGRATION_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return files.flatMap((name) =>
    readFileSync(join(MIGRATION_DIR, name), "utf8").split("--> statement-breakpoint"),
  );
}

export type TestDatabase = ReturnType<typeof drizzle<typeof testSchema>>;

export interface TestDatabaseHandle {
  readonly database: TestDatabase;
  readonly client: PGlite;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabaseHandle> {
  const client = await PGlite.create();
  for (const statement of migrationStatements()) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) await client.exec(trimmed);
  }
  const database = drizzle(client, { schema: testSchema });
  return {
    database,
    client,
    async close() {
      await client.close();
    },
  };
}
