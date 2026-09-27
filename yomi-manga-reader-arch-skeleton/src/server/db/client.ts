/**
 * server/db/client — the connection lifecycle (the only place the PG driver
 * is constructed).
 *
 * Authority: DEPLOYMENT.md §1 ("app pool 10" against server `max_connections
 * 50"), §3 (`DATABASE_URL` is the single DSN, env-injected, never built from
 * user input), §4 (boot applies migrations before serving), ADR-002 (PostgreSQL
 * 18) and ADR-003 (Drizzle `postgres-js` dialect).
 * Requirements: NFR-SEC-015 (parameterization by construction),
 * NFR-OPS-002 (typed env at boot), NFR-DATA-006 (UTC server stamps).
 * Tasks: T-FOUND-005 (this file), T-FOUND-006 (`migrations.ts`),
 * T-SEC-005 (role privileges), UNIT-DB-* / INT-DB-001.
 *
 * ── Driver decision (T-FOUND-005 requires it in the file header) ───────────
 * `postgres` (postgres.js) 3.4.9, NOT `pg` (node-postgres):
 * 1. ADR-003 pins the Drizzle dialect to `drizzle-orm/postgres-js`. Using `pg`
 *    would mean a second dialect for byte-identical SQL.
 * 2. ESM-first. This package is `"type": "module"` on Node 24 and ships as a
 *    Next.js standalone bundle (DEPLOYMENT.md §2); `pg` is CommonJS and adds an
 *    interop edge to every bundler pass for no functional gain.
 * 3. Pooling is a driver option (`max`, `idle_timeout`, `connect_timeout`), so
 *    "app pool 10" is one number in one place rather than a second pool object
 *    to keep in sync with the driver's own bookkeeping.
 * 4. Parameterization is structural. Every value interpolated into a tagged
 *    template becomes a bind parameter, so NFR-SEC-015 is a property of the
 *    API rather than of reviewer vigilance. The three escape hatches that would
 *    break that property are banned here and named in the rules below
 *    (ADR-003 Option E keeps raw SQL, but only for FIXED templates).
 * 5. One less native dependency in the runner image; the same support cadence
 *    as the ORM. Registry rows [12][13] in
 *    docs/research/2026-stack-validation.md pin both to their stable lines.
 *
 * ── Invariants ────────────────────────────────────────────────────────────
 * - `DATABASE_URL` is the ONLY source of connection parameters. The DSN is
 *   never parsed, rewritten or extended with user input (DEPLOYMENT.md §3:
 *   "single URL; no user-controlled DSN parts"). `sslmode` is honoured because
 *   it is part of that operator-provided DSN, not because we add a knob.
 * - The pool NEVER holds a connection open forever: `idle_timeout` returns
 *   spare connections, so a scaled-to-zero deployment does not pin PG slots.
 * - `close()` drains the pool (serverless/SIGTERM: DEPLOYMENT.md §5, RUNBOOK).
 * - The app role is DML-only (DATA_MODEL §18, T-SEC-005): nothing in this file
 *   may issue DDL. DDL lives in `migrations.ts` behind a SEPARATE DSN.
 *
 * Rules:
 * - BANNED here and in every repository: `sql.unsafe(...)`, `db.execute(
 *   sql.raw(userInput))`, and any string-concatenated SQL (NFR-SEC-015).
 *   `sql.unsafe` is only acceptable with a fixed template AND bound args, and
 *   even then the query belongs in a reviewed repository.
 * - Drizzle row types never leave this module: repositories map rows → DTOs
 *   (data-flow.md §7, dependency rule D1/D2).
 * - Every hot query names its index in a comment (T-PERF-004 gate list).
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Notice, Sql } from 'postgres';
import type { Env } from '../../shared/validation';
import * as schema from './schema';

/**
 * Pool ceiling per process — DEPLOYMENT.md §1 ("app pool 10" against server
 * `max_connections 50`).
 *
 * The arithmetic is deliberate: 5 app replicas × 10 = 50, which exhausts the
 * server budget with NO headroom for the maintenance role that runs
 * migrations, the `pgbouncer` option in ADR-002 R2, or operator sessions. Raise
 * `max_connections` in the compose file alongside this constant, or lower this
 * one — never both silently.
 */
export const DB_POOL_MAX = 10;

/** Fail fast on an unreachable/unresolvable database instead of hanging boot. */
export const DB_CONNECT_TIMEOUT_SECONDS = 10;

/** Release idle connections; a 10-connection pool is long-lived per replica. */
export const DB_IDLE_TIMEOUT_SECONDS = 30;

/** Options for {@link createPostgresClient}, all defaulted for the app pool. */
export interface PostgresClientOptions {
  /** Pool ceiling (defaults to {@link DB_POOL_MAX}). */
  readonly max?: number;
  /** TCP/TLS connect timeout in seconds. */
  readonly connectTimeoutSeconds?: number;
  /** Release idle connections after this many seconds. */
  readonly idleTimeoutSeconds?: number;
  /** Receives PostgreSQL NOTICE messages; the default drops them. */
  readonly onNotice?: (notice: Notice) => void;
}

/**
 * A boot/configuration failure that is NOT an API error.
 *
 * Mirrors `ConfigurationError` in `shared/validation`: API_CONTRACT.md §6 has no
 * `CONFIG_*`/`DB_*` code, and T-FOUND-009 owns that table, so this module throws
 * its own error type rather than inventing a code (AGENTS.md §4.7). spec-question
 * for T-FOUND-009: a database outage during boot has no code in the table.
 */
export class DatabaseConfigurationError extends Error {
  /** The VARIABLE or setting name — never the DSN and never a value. */
  readonly subject: string;

  constructor(subject: string, problem: string, options?: ErrorOptions) {
    super(`${subject}: ${problem}`, options);
    this.name = 'DatabaseConfigurationError';
    this.subject = subject;
  }
}

/**
 * Builds the raw driver client. No connection is opened until the first query,
 * so importing this module (in a build, a CLI, a test) is free of side effects.
 *
 * @throws {DatabaseConfigurationError} when the DSN is missing or unparseable.
 */
export function createPostgresClient(
  databaseUrl: string,
  options: PostgresClientOptions = {},
): Sql {
  if (databaseUrl.trim() === '') {
    throw new DatabaseConfigurationError(
      'DATABASE_URL',
      'is required; the database DSN is env-injected only (DEPLOYMENT.md §3)',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    // The value itself must never reach the message (NFR-OBS-006 redaction).
    throw new DatabaseConfigurationError('DATABASE_URL', 'is not a valid URL');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new DatabaseConfigurationError(
      'DATABASE_URL',
      'must be a postgres:// or postgresql:// URL',
    );
  }
  return postgres(databaseUrl, {
    max: options.max ?? DB_POOL_MAX,
    connect_timeout: options.connectTimeoutSeconds ?? DB_CONNECT_TIMEOUT_SECONDS,
    idle_timeout: options.idleTimeoutSeconds ?? DB_IDLE_TIMEOUT_SECONDS,
    // NOTICE is server chatter (CREATE EXTENSION, etc.). Routing it to a
    // caller-supplied sink keeps it out of stdout; the default is silence so
    // the driver's own logging can never leak a DSN.
    onnotice: options.onNotice ?? (() => undefined),
  });
}

/** The Drizzle handle repositories are written against. */
export type Db = ReturnType<typeof createDbCore>['db'];

/** Internal: builds the driver client and its Drizzle wrapper together. */
function createDbCore(env: Env, options: PostgresClientOptions = {}) {
  const client = createPostgresClient(env.databaseUrl, options);
  const database = drizzle(client, { schema });
  const db = Object.assign(database, {
    /**
     * Drains the pool. Called on SIGTERM and at the end of a request-scoped job
     * (DEPLOYMENT.md §5: the image may be replaced at any moment, so in-flight
     * work must not depend on a connection that will never be returned).
     */
    close(): Promise<void> {
      return client.end({ timeout: DB_CONNECT_TIMEOUT_SECONDS });
    },
  });
  return { db, client };
}

/**
 * The application's database handle: connection, pool (max 10) and schema.
 *
 * Async because boot must FAIL FAST: the handle is only handed out after the
 * server has answered a trivial round-trip, so a wrong DSN, a stopped database
 * or a revoked role is a boot failure (DEPLOYMENT.md §4 step 1-2) rather than
 * the first reader's 500. `/readyz` stays the liveness/readiness split
 * (OBSERVABILITY.md §6, T-FOUND-007).
 *
 * @throws {DatabaseConfigurationError} for a missing/invalid DSN or an
 *   unreachable server; the driver's own error stays reachable as `cause` for
 *   the logger and never reaches the message (NFR-OBS-006).
 */
export async function createDb(env: Env, options: PostgresClientOptions = {}): Promise<Db> {
  const { db, client } = createDbCore(env, options);
  try {
    await client`select 1`;
  } catch (cause) {
    await db.close();
    throw new DatabaseConfigurationError(
      'DATABASE_URL',
      'could not reach the database (check the DSN, the server, and pg_hba)',
      { cause },
    );
  }
  return db;
}

/** Closes a handle produced by {@link createDb}; safe to call twice. */
export async function closeDb(db: Db): Promise<void> {
  await db.close();
}
