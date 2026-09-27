// HomeOps — integration harness (T-PLAT-016, docs/testing/TEST-DATA.md §5/§10).
//
// Contract:
//  - one scratch database **per worker**, migrations applied once (not per test);
//  - between tests, truncate in one statement (dependency order is the database's job) and re-apply
//    the fixture households, so a test never inherits another test's rows;
//  - never connect to a database whose name does not contain "test" or "dev";
//  - the migration path is the *same* code the deploy pipeline runs (scripts/migrate.ts), so the
//    harness cannot drift from production schema handling (TESTING.md §5).
//
// Suites that need a database use `describe.skipIf(!isDatabaseAvailable())` so a checkout without
// Postgres still type-checks, lints, and runs its unit tier.

import postgres from 'postgres';
import { applyMigrations, databaseNameOf } from '../../scripts/migrate';
import { closeDb } from '../../src/server/db/client';
import { seedDevelopmentData } from '../../src/server/db/seed/run';
import { SEED_HOUSEHOLDS, type SeedHousehold } from '../../src/server/db/seed/fixtures';

export type ScratchDatabase = {
  readonly url: string;
  readonly databaseName: string;
  readonly worker: string;
};

const SCRATCH_PATTERN = /(^|[_-])(dev|test|local)([_-]|$)|(dev|test|local)/;

/** True when a scratch database can be prepared from the ambient `DATABASE_URL`. */
export function isDatabaseAvailable(source: NodeJS.ProcessEnv = process.env): boolean {
  const url = source.DATABASE_URL?.trim();
  if (!url) return false;
  try {
    return SCRATCH_PATTERN.test(databaseNameOf(url));
  } catch {
    return false; // not a URL: nothing to connect to
  }
}

/** Refuse anything that is not obviously a scratch target — including a production-looking name. */
export function assertScratchTarget(url: string): string {
  const databaseName = databaseNameOf(url);
  if (!SCRATCH_PATTERN.test(databaseName)) {
    throw new Error(
      `tests/helpers/db: refusing to touch database "${databaseName}" — its name must contain "test", "dev" or "local"`,
    );
  }
  return databaseName;
}

function workerId(): string {
  return process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? String(process.pid);
}

function scratchUrlFor(baseUrl: string, worker: string): string {
  const url = new URL(baseUrl);
  const base = url.pathname.replace(/^\//, '').replace(/_w\d+$/, '');
  url.pathname = `/${base}_w${worker}`;
  return url.toString();
}

let prepared: ScratchDatabase | null = null;

/**
 * Prepare (once per worker) the scratch database: create it if needed, migrate it, seed the fixture
 * households, and point `DATABASE_URL` at it so `getDb()` and the repositories use it.
 */
export async function withScratchDatabase<T>(fn: () => Promise<T>): Promise<T> {
  const baseUrl = process.env.DATABASE_URL?.trim();
  if (!baseUrl)
    throw new Error(
      'tests/helpers/db: DATABASE_URL is not set (see docker-compose.yml service postgres-test)',
    );
  assertScratchTarget(baseUrl);

  if (!prepared) {
    const worker = workerId();
    const url = scratchUrlFor(baseUrl, worker);
    const databaseName = assertScratchTarget(url);
    await createDatabaseIfMissing(baseUrl, databaseName);
    await applyMigrations(url);
    // Point the application client at the scratch database before anything calls getDb().
    process.env.DATABASE_URL = url;
    await closeDb();
    prepared = { url, databaseName, worker };
    await resetFixtures();
  }

  return fn();
}

/** The prepared scratch database, or `null` before the first `withScratchDatabase` call. */
export function scratchDatabase(): ScratchDatabase | null {
  return prepared;
}

async function createDatabaseIfMissing(baseUrl: string, databaseName: string): Promise<void> {
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const sql = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const existing = await sql`select 1 from pg_database where datname = ${databaseName}`;
    if (existing.length === 0) {
      // Identifiers cannot be parameters; the name is validated above and never user-supplied.
      await sql.unsafe(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Every table except the migration journal, in one statement; FK order is handled by CASCADE. */
export async function truncateAll(): Promise<void> {
  const sql = connectScratch();
  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables
      where schemaname = 'public' and tablename <> ${'schema_migration'}
    `;
    if (tables.length === 0) return;
    const quoted = tables.map((row) => `"${row.tablename.replace(/"/g, '""')}"`).join(', ');
    await sql.unsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Truncate, then re-apply the fixture households (HH_MAIN, HH_CONTROL, HH_WIDTH, HH_EMPTY, HH_BUSY). */
export async function resetFixtures(): Promise<void> {
  if (!prepared) throw new Error('tests/helpers/db: resetFixtures needs withScratchDatabase first');
  await truncateAll();
  await seedDevelopmentData();
}

/** The fixture households of TEST-DATA.md §2, addressed by name (a union, so `FIXTURES.HH_MAIN` is
 *  never `string | undefined` and a typo is a compile error). */
export type FixtureHousehold =
  'HH_MAIN' | 'HH_CONTROL' | 'HH_WIDTH' | 'HH_WIDTH_SOUTH' | 'HH_EMPTY' | 'HH_BUSY';

const FIXTURE_NAMES: readonly FixtureHousehold[] = [
  'HH_MAIN',
  'HH_CONTROL',
  'HH_WIDTH',
  'HH_WIDTH_SOUTH',
  'HH_EMPTY',
  'HH_BUSY',
];

export const FIXTURES: Readonly<Record<FixtureHousehold, SeedHousehold>> = Object.fromEntries(
  FIXTURE_NAMES.map((name) => {
    const household = SEED_HOUSEHOLDS.find((entry) => entry.name === name);
    if (!household)
      throw new Error(`tests/helpers/db: fixture household "${name}" is missing from the seed dataset`);
    return [name, household];
  }),
) as Readonly<Record<FixtureHousehold, SeedHousehold>>;

/** HH_MAIN's owner/admin/member/helper, by display name — the composition every suite expects. */
/** HH_MAIN's owner/admin/member/helper, by display name — the composition every suite expects. */
export function fixtureMembers(householdName: FixtureHousehold): ReadonlyMap<string, string> {
  return new Map(FIXTURES[householdName].members.map((member) => [member.displayName, member.id]));
}

/** A fixture household's member id by display name, or `null` when the fixture has no such member. */
export function fixtureMemberId(householdName: FixtureHousehold, displayName: string): string | null {
  return fixtureMembers(householdName).get(displayName) ?? null;
}

function connectScratch(): postgres.Sql {
  if (!prepared) throw new Error('tests/helpers/db: no scratch database prepared');
  return postgres(prepared.url, { max: 1, onnotice: () => {} });
}

/** Release the client between files; Vitest tears the worker down afterwards anyway. */
export async function teardownScratchDatabase(): Promise<void> {
  await closeDb();
  prepared = null;
}
