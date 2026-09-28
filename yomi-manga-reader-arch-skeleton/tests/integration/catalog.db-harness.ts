/**
 * Shared harness for the T-CATALOG-001 integration suites.
 *
 * Task: T-CATALOG-001 (INT-CAT-001, INT-CHAP-001). Requirements: NFR-DATA-001,
 * NFR-DATA-002, NFR-SEC-015, NFR-PERF-014.
 *
 * WHY THIS EXISTS: every assertion in the two suites must run against a REAL,
 * MIGRATED PostgreSQL 18 (TEST_STRATEGY §1 rule 3). Asserting against the
 * Drizzle types would prove nothing — a schema that only typechecks has not
 * been tested, and neither has a query that only compiles.
 *
 * ── WHY ONE DATABASE PER SUITE ────────────────────────────────────────────
 * `vitest.config.ts` still configures `poolOptions.forks.singleFork`, which
 * Vitest 4 removed (every run prints the deprecation), so integration FILES run
 * in parallel processes. Two suites that both TRUNCATE would therefore delete
 * each other's fixtures mid-test — which is exactly what happened before this
 * harness gave each suite its own database. So `openHarness(namespace)` creates
 * a throwaway database named after the suite, migrates it from the shipped
 * `drizzle/` files, and drops it on close.
 *
 * A database (not a schema) is used deliberately: `migrations.ts` pins the
 * drizzle journal to `public` (`MIGRATION_JOURNAL_SCHEMA`), so a per-suite
 * SCHEMA would share one journal and the second suite would believe it had
 * already been migrated into an empty schema.
 *
 * DSN: `DATABASE_URL` — the variable DEPLOYMENT.md §3 declares, which compose
 * supplies (T-FOUND-010). The suites SKIP (never silently pass) without it.
 * Run them with:
 *   docker run -d --name yomi-cat -e POSTGRES_USER=yomi -e POSTGRES_PASSWORD=yomi \
 *     -e POSTGRES_DB=yomi -p 55440:5432 postgres:18.6-bookworm
 *   DATABASE_URL=postgres://yomi:yomi@127.0.0.1:55440/yomi \
 *     npx vitest run tests/integration/catalog.manga.repository.test.ts
 *
 * SAFETY: the per-suite databases are created and dropped by this harness, so
 * the DSN must point at a THROWAWAY server — never at a database anyone keeps
 * data in.
 */

import postgres from 'postgres';
import { describe } from 'vitest';
import { runMigrations } from '../../src/server/db/migrations';
import { createDb, type Db } from '../../src/server/db/client';
import { SCHEMA_TABLES } from '../../src/server/db/schema';
import type { Env, EnvSource } from '../../src/shared/validation';

/** The DSN for the run, or `undefined` when there is no database. */
export const DATABASE_URL = process.env['DATABASE_URL'];

/** `describe` when a DSN is present, `describe.skip` when it is not. */
export const describeDb = DATABASE_URL ? describe : describe.skip;

type RawSql = ReturnType<typeof postgres>;

/** A raw driver handle for catalog assertions the Drizzle builder cannot express. */
export interface Harness {
  /** The application's Drizzle handle (the only handle repositories receive). */
  readonly db: Db;
  /** A raw `postgres` handle, for EXPLAIN and catalog introspection. */
  readonly sql: RawSql;
  /** Empties every table so one test's rows cannot reach the next test. */
  reset(): Promise<void>;
  /** Releases both handles and drops the throwaway database. */
  close(): Promise<void>;
}

/**
 * The only Env field `createDb` reads is `databaseUrl` (DEPLOYMENT.md §3), so a
 * test that owns a real DSN needs no other variable invented (T-FOUND-002 owns
 * the rest of the inventory).
 */
export function testEnv(databaseUrl: string): Env {
  return { databaseUrl } as Env;
}

/** The same DSN with a different database name. */
/**
 * A COMPLETE `EnvSource` for `createCatalogComposition` / `createLibraryComposition`.
 *
 * `testEnv` above is enough for `createDb`, which reads one field. A composition
 * root is different: it calls `loadEnv` itself, and `loadEnv` refuses to start
 * unless all nine variables are present (DEPLOYMENT.md §3, plus the
 * no-variable-values-in-the-error rule of NFR-OBS-006). That refusal is correct
 * and worth keeping — it is why a misconfigured deployment fails at boot rather
 * than at the first query — but a test that wants a composition root must satisfy
 * it.
 *
 * It lives here, beside `testEnv`, because the alternative is a third copy of this
 * literal (media-delivery and seed.harness each have one already) and they drift.
 * The values are throwaway and never leave the test process.
 */
export function envSource(databaseUrl: string): EnvSource {
  return {
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:3000',
    SESSION_SECRET: '0'.repeat(64),
    DATABASE_URL: databaseUrl,
    NEXT_TELEMETRY_DISABLED: '1',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_REGION: 'auto',
    S3_BUCKET: 'yomi-media-test',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key-000000000000',
  };
}

function dsnFor(databaseName: string): string {
  const url = new URL(DATABASE_URL as string);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/**
 * Creates a throwaway database, migrates it through the SHIPPED runner, and
 * returns both handles.
 *
 * The migration is applied by `runMigrations` (T-FOUND-006), never by a
 * hand-written DDL copy, so a suite can never pass against a schema the app
 * would not boot on.
 *
 * @param namespace a short, unique suite name (letters, digits, underscores)
 */
export async function openHarness(namespace: string): Promise<Harness> {
  const base = DATABASE_URL;
  if (base === undefined) throw new Error('DATABASE_URL is unset; the suite must not run.');
  const name = `t_catalog_${namespace.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  const admin = postgres(base, { max: 1, onnotice: () => undefined });
  // `with (force)` closes any leftover connection from a crashed previous run.
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  const url = dsnFor(name);
  await runMigrations({ url });

  const sql = postgres(url, { max: 4, onnotice: () => undefined });
  const db = await createDb(testEnv(url));
  return {
    db,
    sql,
    reset: async () => {
      // One fixed statement; the table list comes from the schema inventory, so
      // no test value ever reaches the SQL text (NFR-SEC-015).
      const tables = SCHEMA_TABLES.map((table) => `"${table}"`).join(', ');
      await sql.unsafe(`truncate table ${tables} restart identity cascade`);
    },
    close: async () => {
      await db.close();
      await sql.end({ timeout: 5 });
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end({ timeout: 5 });
    },
  };
}

/** Anything that can hand over a Drizzle `{ sql, params }` pair. */
interface Sqlable {
  toSQL(): { sql: string; params: unknown[] };
}

function hasToSQL(value: unknown): value is Sqlable {
  return typeof (value as { toSQL?: unknown } | null)?.toSQL === 'function';
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

/**
 * Runs an `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` against a query the repository
 * itself produced, so the plan that is asserted is the plan that ships.
 *
 * Accepts the Drizzle statement builder, a `{ toSQL() }` wrapper, or a promise
 * of either (the catalog query builder is `async`, because resolving genre names
 * to ids is a round trip). It REFUSES a resolved row array, because EXPLAIN-ing
 * rows rather than a statement is exactly the mistake that would make this gate
 * assert nothing.
 *
 * `toSQL()` is the Drizzle-emitted `{ sql, params }` pair; every value in
 * `params` stays a bind parameter, so this helper binds them the same way the
 * repository does (NFR-SEC-015). The only string added here is the fixed
 * `explain (...)` prefix.
 */
export async function explain(sql: RawSql, query: unknown): Promise<string> {
  let statement: unknown = query;
  if (!hasToSQL(statement) && isThenable(statement)) statement = await statement;
  if (!hasToSQL(statement)) {
    throw new Error('explain() needs the Drizzle statement builder, not resolved rows');
  }
  const { sql: text, params } = statement.toSQL();
  const rows = await sql.unsafe(`explain (analyze, buffers, verbose) ${text}`, params as never[]);
  return rows.map((row) => Object.values(row).join(' ')).join('\n');
}
