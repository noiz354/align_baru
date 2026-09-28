// HomeOps — database client (T-PLAT-003, ADR-002, ADR-003).
//
// The single place `postgres`/`drizzle-orm` are imported (MODULE-MAP.md §4: \"Any file outside
// src/server/db importing the DB driver\" is a forbidden edge, enforced by ESLint T-PLAT-006).
// One connection pool per process; no second datastore exists (ARCHITECTURE.md §3).
// Wave2: PGlite dev fallback (pglite://, file:, /tmp, ./, .db) mirrors yomi/majelishub — real PG
// when DATABASE_URL is postgres://, file-backed PGlite when it starts with pglite:.

import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { account, session, user, verification } from './schema/auth';
import {
  activityEvent,
  auditLog,
  idempotencyKey,
  outboxMessage,
  rateLimitBucket,
  schedulerJobRun,
} from './schema/platform';
import { household, householdMember, householdSettings, invitation } from './schema/tenancy';
import { room } from './schema/rooms';
import { choreDefinition, choreOccurrence } from './schema/chores';

/**
 * The schema object handed to Drizzle. Explicit imports (no barrel): the module map forbids
 * cross-module re-export files (ARCHITECTURE.md §4.1 L-6).
 */
export const schema = {
  // auth (Better Auth-owned tables, DATA_MODEL.md §2.1)
  user,
  session,
  account,
  verification,
  // tenancy
  household,
  householdSettings,
  householdMember,
  invitation,
  // platform
  activityEvent,
  auditLog,
  rateLimitBucket,
  idempotencyKey,
  outboxMessage,
  schedulerJobRun,
  // wave2 vertical
  room,
  choreDefinition,
  choreOccurrence,
} as const;

export type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema> | PgliteDatabase<Schema>;
export type DbClient = Sql;
export type DbTransaction = TransactionSql;

type Cache = { readonly sql?: Sql; readonly db: Db; readonly pglite?: PGlite };
let cache: Cache | null = null;

function isPgliteUrl(url: string): boolean {
  return (
    url.startsWith('pglite://') ||
    url.startsWith('pglite:') ||
    url.startsWith('file:') ||
    url.includes('/tmp/') ||
    url.endsWith('.db')
  );
}

/**
 * Lazily create the pool. Reading `DATABASE_URL` here (not at module load) keeps `next build` and
 * the unit-test project working without a database (T-PLAT-021, TESTING.md §2).
 */
export function getDb(): Db {
  return getCache().db;
}

export function getSql(): Sql {
  const c = getCache();
  if (!c.sql) throw new Error('getSql() not available for PGlite (use getDb() directly)');
  return c.sql;
}

/** True when a database is configured — used by health readiness and by integration-test skipping. */
export function isDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = env.DATABASE_URL?.trim();
  return typeof url === 'string' && url.length > 0;
}

/** Cheapest possible round-trip, for readiness probes (T-PLAT-024). Throws when the DB is down. */
export async function pingDatabase(): Promise<void> {
  const c = getCache();
  if (c.sql) await c.sql`select 1`;
  else await (c.db as PgliteDatabase<Schema>).execute('select 1');
}

/** Close the pool (graceful shutdown, ADR-015; used by scripts and by test teardown). */
export async function closeDb(): Promise<void> {
  if (!cache) return;
  if (cache.sql) await cache.sql.end({ timeout: 5 });
  // PGlite closes via file handle; no explicit close needed for now
  cache = null;
}

export function isPgliteDb(db: Db): boolean {
  return !(db as PostgresJsDatabase<Schema>).execute || typeof (db as PgliteDatabase<Schema>).query === 'object';
}

function getCache(): Cache {
  if (cache) return cache;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local, start Postgres 18 (docker compose up -d postgres), then run npm run db:migrate.',
    );
  }
  if (isPgliteUrl(url)) {
    const dataDir = url.replace(/^pglite:\/\//, '').replace(/^file:\/\//, '') || '/tmp/homeops-pglite';
    const pgliteUrl = url.startsWith('pglite://') ? url : `file://${dataDir}`;
    // PGlite constructor expects path; for pglite:// we pass the path part
    const path = pgliteUrl.replace(/^pglite:\/\//, '').replace(/^file:\/\//, '');
    const pglite = new PGlite(path || '/tmp/homeops-pglite');
    const db = drizzlePglite({ client: pglite, schema }) as unknown as PgliteDatabase<Schema>;
    cache = { db, pglite };
    return cache;
  }
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: true,
    transform: { undefined: null },
    onnotice: () => {},
  });
  cache = { sql, db: drizzlePg(sql, { schema }) as unknown as Db };
  return cache;
}
