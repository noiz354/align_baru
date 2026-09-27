#!/usr/bin/env tsx
/**
 * scripts/migrate.ts — apply committed migrations (T-PLAT-003, DATA_MODEL.md §5).
 *
 * Forward-only. The journal and SQL files are the artefact that ships; this runner refuses to touch
 * a database whose name does not look like a development or test target unless `--i-know-this-is-production`
 * is passed (T-PLAT-018 uses the same guard for seeding).
 */
import { pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const PRODUCTION_HINT = /prod|production/i;
const FORCE_FLAG = '--i-know-this-is-production';

/** True when a database name looks like a production target (shared with the seed guard). */
export function looksLikeProductionDatabase(databaseName: string): boolean {
  return PRODUCTION_HINT.test(databaseName);
}

/** The database name in a connection string, without the leading slash. */
export function databaseNameOf(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, '');
}

/**
 * Apply every committed migration to `connectionString`. Exported so the integration harness
 * (tests/helpers/db.ts) migrates a scratch database exactly the way the deploy pipeline does — one
 * code path, no test-only migration logic (TESTING.md §5).
 */
export async function applyMigrations(
  connectionString: string,
): Promise<{ readonly databaseName: string; readonly durationMs: number }> {
  const started = Date.now();
  const databaseName = databaseNameOf(connectionString);
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { schema } = await import('../src/server/db/client');
    const db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
    return { databaseName, durationMs: Date.now() - started };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
    process.exit(1);
  }
  const databaseName = databaseNameOf(url);
  if (looksLikeProductionDatabase(databaseName) && !process.argv.includes(FORCE_FLAG)) {
    console.error(
      `Refusing to migrate "${databaseName}": the name looks like production. Re-run with ${FORCE_FLAG} if that is really the target.`,
    );
    process.exit(1);
  }

  const applied = await applyMigrations(url);
  console.log(`migrations applied to ${applied.databaseName} in ${applied.durationMs} ms`);
}

// Importing this module must not run a migration: the harness imports `applyMigrations`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    // Never print the connection string: it contains credentials (SECURITY.md §10).
    console.error(`migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(1);
  });
}
