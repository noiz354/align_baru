// HomeOps — database client (T-PLAT-003, ADR-002, ADR-003).
//
// The single place `postgres`/`drizzle-orm` are imported (MODULE-MAP.md §4: "Any file outside
// src/server/db importing the DB driver" is a forbidden edge, enforced by ESLint T-PLAT-006).
// One connection pool per process; no second datastore exists (ARCHITECTURE.md §3).

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql, type TransactionSql } from 'postgres';
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
} as const;

export type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema>;
export type DbClient = Sql;
export type DbTransaction = TransactionSql;

type Cache = { readonly sql: Sql; readonly db: Db };
let cache: Cache | null = null;

/**
 * Lazily create the pool. Reading `DATABASE_URL` here (not at module load) keeps `next build` and
 * the unit-test project working without a database (T-PLAT-021, TESTING.md §2).
 */
export function getDb(): Db {
  return getCache().db;
}

export function getSql(): Sql {
  return getCache().sql;
}

/** True when a database is configured — used by health readiness and by integration-test skipping. */
export function isDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = env.DATABASE_URL?.trim();
  return typeof url === 'string' && url.length > 0;
}

/** Cheapest possible round-trip, for readiness probes (T-PLAT-024). Throws when the DB is down. */
export async function pingDatabase(): Promise<void> {
  await getSql()`select 1`;
}

/** Close the pool (graceful shutdown, ADR-015; used by scripts and by test teardown). */
export async function closeDb(): Promise<void> {
  if (!cache) return;
  await cache.sql.end({ timeout: 5 });
  cache = null;
}

function getCache(): Cache {
  if (cache) return cache;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    // Fail with an actionable message, never with a default or a silent no-op (T-PLAT-021).
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local, start Postgres 18 (docker compose up -d postgres), then run npm run db:migrate.',
    );
  }
  const sql = postgres(url, {
    // Household scale: a handful of concurrent requests plus one scheduler tick (PERFORMANCE.md).
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: true,
    // Every instant is stored and compared in UTC (ADR-007).
    transform: { undefined: null },
    onnotice: () => {
      // Notices (e.g. "table does not exist, skipping") are not member-facing and must not leak.
    },
  });
  cache = { sql, db: drizzle(sql, { schema }) };
  return cache;
}
