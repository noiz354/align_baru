/**
 * server/db/migrations — the boot-time migration runner (T-FOUND-006).
 *
 * Authority: DEPLOYMENT.md §4 step 2 ("migrations run before serving",
 * expand/contract only, NFR-OPS-004), §6.3 ("database is never rolled back"),
 * ADR-002 (PostgreSQL 18, `pg_trgm`), ADR-003 (drizzle-kit, explicit files,
 * expand/contract discipline), NFR-SEC-013 (migration files are reviewed as
 * code). Requirements: NFR-DATA-001, NFR-OPS-004.
 * Tasks: T-FOUND-006 (this file), T-FOUND-005 (schema it applies),
 * T-SEC-005 (role split), T-PROD-002 (compose boots from scratch).
 *
 * ── Where the migrations live ─────────────────────────────────────────────
 * `drizzle/` at the repository root (ADR-003: "explicit files in `drizzle/`"),
 * which is also what `drizzle.config.ts` writes and what the `db:generate` /
 * `db:migrate` package scripts use. It is NOT under `src/`: it is data, not
 * source, and it must be copied into the runtime image verbatim (DEPLOYMENT.md
 * §2 build stage, "drizzle-kit migration bundle check").
 *
 * ── Invariants ────────────────────────────────────────────────────────────
 * 1. **Advisory lock.** Concurrent boots serialise on a session-level
 *    `pg_advisory_lock` instead of racing. PostgreSQL is the lock manager here
 *    on purpose: it is already the thing being migrated, so there is no second
 *    coordination service to fail (SKILLS.md §6 forbids a broker; the same
 *    reasoning rules out Redis/etcd here). The lock is released in a
 *    `finally`, so a failed migration cannot wedge the next deploy.
 * 2. **Idempotent per revision.** drizzle's journal (`__drizzle_migrations`,
 *    one row per file, `created_at` = the folder's version) is the only source
 *    of truth; a revision is applied iff its version is newer than the newest
 *    applied one. Re-running applies nothing and touches nothing.
 * 3. **Separate DDL role.** The app role has no DDL (T-SEC-005 finalises the
 *    privileges; DATA_MODEL §18 relies on it). Migrations therefore run on
 *    their own DSN — the maintenance role from DEPLOYMENT.md §6
 *    ("app role (DML, no DDL) + maintenance role (separate, manual)"). The
 *    app pool in `client.ts` can never be used to migrate, which is what makes
 *    "no DDL for the app role" enforceable rather than aspirational.
 * 4. **Before serving.** `runMigrations` is awaited by the composition root
 *    (DEPLOYMENT.md §4); it never returns "pending work" to the caller.
 * 5. **Expand/contract only** (NFR-OPS-004). A migration may ADD columns,
 *    tables and indexes; it may not DROP or rename anything the previous app
 *    image reads. Contract steps ship in a later release, after the previous
 *    image is retired (DEPLOYMENT.md §5.3). This is a review rule, not
 *    something a runner can enforce — CONTRIBUTING.md is missing the section
 *    that states it (see the T-FOUND-006 report for the exact text to add).
 *
 * ── DEPLOYMENT.md §3 needs two new optional variables (spec-question) ──────
 * - `MIGRATION_DATABASE_URL` — DDL-capable maintenance DSN. Absent ⇒ the runner
 *   falls back to `DATABASE_URL`, which is correct for dev (one role owns the
 *   schema) and WRONG for prod, where it would fail closed on the missing
 *   `CREATE EXTENSION`/DDL grants instead of silently succeeding.
 * - `MIGRATIONS_DIR` — absolute path to the shipped `drizzle/` directory when
 *   the image layout moves it away from `<module>/../../../drizzle`.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseConfigurationError } from './client';

function isPgliteUrl(url: string): boolean {
  const t = url.trim();
  return (
    t.startsWith('pglite://') ||
    t.startsWith('file:') ||
    t.startsWith('memory:') ||
    t === ':memory:' ||
    t.startsWith('/tmp/') ||
    t.startsWith('./') ||
    t.endsWith('.db')
  );
}

/**
 * The migration advisory-lock id: a session-level `pg_advisory_lock` key.
 *
 * Value = 0x594F4D49 = the ASCII bytes of "YOMI". Any other tool in the
 * ecosystem (a manual `drizzle-kit migrate`, an operator script) can take the
 * same key by name, and the collision space is not shared with unrelated
 * PostgreSQL advisory-lock users by accident.
 */
export const MIGRATION_LOCK_ID = 1_498_108_233;

/** Journal table drizzle records applied revisions in (drizzle config mirrors it). */
export const MIGRATION_JOURNAL_TABLE = '__drizzle_migrations';

/** Journal schema — `public`, so the migration tooling owns no extra schema. */
export const MIGRATION_JOURNAL_SCHEMA = 'public';

/**
 * Default location: the `drizzle/` directory shipped with the repository.
 *
 * Resolution order:
 * 1. `MIGRATIONS_DIR` when set (DEPLOYMENT.md §3 — the escape hatch for an
 *    image layout that moves the directory).
 * 2. `<cwd>/drizzle` when it exists. This is the form that works everywhere
 *    the app actually runs: the Next.js server, `npm run db:migrate`, the
 *    integration suites, and `tsx` scripts — all from the repo root.
 * 3. A module-relative fallback, for a process whose cwd is not the repo root.
 *
 * ── Why not `new URL('../../../drizzle', import.meta.url)` alone ──────────────
 * That form is correct in Node, but Turbopack (Next 16) statically analyses
 * `new URL(<anything>, import.meta.url)` as an **asset reference** and fails
 * the build — with a literal it reports `Can't resolve '../../../drizzle'`,
 * and with an interpolated value it reports `Can't resolve <dynamic>`. Every
 * route that imports `server/db` inherits the failure, so the whole app fails
 * to build. So neither step may use that form: step 2 is cwd-relative, and
 * step 3 composes `import.meta.dirname` (Node ≥ 20.11) with `path.join`.
 */
function resolveMigrationsDir(): string {
  const fromEnv = process.env['MIGRATIONS_DIR'];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;

  const fromCwd = join(process.cwd(), 'drizzle');
  if (existsSync(fromCwd)) return fromCwd;

  // `import.meta.dirname` is a runtime value, not a bundler-tracked asset URL.
  return join(import.meta.dirname, '..', '..', '..', 'drizzle');
}

export const DEFAULT_MIGRATIONS_DIR = resolveMigrationsDir();

/** One applied revision, as recorded in the journal. */
export interface AppliedMigration {
  /** Journal id (insertion order). */
  readonly id: number;
  /** SHA-256 of the migration file at apply time. */
  readonly hash: string;
  /** drizzle's version stamp for the revision. */
  readonly version: number;
}

/** What {@link runMigrations} did. */
export interface MigrationResult {
  /** Revisions applied by THIS call — empty means the database was up to date. */
  readonly applied: readonly AppliedMigration[];
  /** The journal state AFTER the run (the whole history, oldest first). */
  readonly journal: readonly AppliedMigration[];
  /** The advisory-lock key that was held for the duration. */
  readonly lockId: number;
  /** Wall-clock duration of the locked section, in milliseconds. */
  readonly durationMs: number;
}

/** Inputs for {@link runMigrations}. */
export interface MigrationOptions {
  /**
   * DDL-capable DSN (the maintenance role). Never the app pool's DSN in prod
   * (invariant 3) — pass it explicitly so the choice is visible at the call
   * site in the composition root.
   */
  readonly url: string;
  /** Migration directory; defaults to `MIGRATIONS_DIR` then {@link DEFAULT_MIGRATIONS_DIR}. */
  readonly migrationsFolder?: string;
  /** Advisory-lock key; defaults to {@link MIGRATION_LOCK_ID}. */
  readonly lockId?: number;
  /** Receives one line per applied revision (the boot log, OBSERVABILITY.md §3). */
  readonly onApplied?: (migration: AppliedMigration) => void;
}

/**
 * Resolves the migration directory: explicit argument → `MIGRATIONS_DIR` →
 * the repository-relative default.
 *
 * @throws {DatabaseConfigurationError} when the directory or its journal is
 *   missing, so a half-copied image fails at boot with a named cause instead of
 *   a confusing "no migrations" success.
 */
export function resolveMigrationsFolder(explicit?: string): string {
  const folder = explicit ?? process.env['MIGRATIONS_DIR'] ?? DEFAULT_MIGRATIONS_DIR;
  if (!existsSync(`${folder}/meta/_journal.json`)) {
    throw new DatabaseConfigurationError(
      'MIGRATIONS_DIR',
      'has no meta/_journal.json — the drizzle/ directory was not shipped in the image',
    );
  }
  return folder;
}

/**
 * Applies every pending migration, under a PostgreSQL advisory lock, on a
 * single-connection client dedicated to DDL (DEPLOYMENT.md §4 step 2).
 *
 * The client is created with `max: 1` on purpose: a session-level advisory
 * lock belongs to ONE backend, and a pooled client could take the lock on one
 * connection and run the migration on another, which would make the lock a lie.
 * One connection also means the whole locked section is serialised, which is
 * what a boot-time gate needs.
 *
 * @throws {DatabaseConfigurationError} for a missing DSN or migrations folder.
 */
export async function runMigrations(options: MigrationOptions): Promise<MigrationResult> {
  const url = options.url.trim();
  if (url === '') {
    throw new DatabaseConfigurationError(
      'MIGRATION_DATABASE_URL',
      'is required to run migrations (dev may reuse DATABASE_URL)',
    );
  }
  const migrationsFolder = resolveMigrationsFolder(options.migrationsFolder);
  const lockId = options.lockId ?? MIGRATION_LOCK_ID;
  const startedAt = Date.now();
  // PGlite dev fallback: no advisory lock, single in-process DB
  if (isPgliteUrl(url)) {
    let dataDir: string | undefined;
    const t = url.trim();
    if (t.startsWith('pglite://')) dataDir = t.slice('pglite://'.length) || undefined;
    else if (t.startsWith('file:')) dataDir = t.slice('file:'.length);
    else if (t.startsWith('memory:') || t === ':memory:') dataDir = undefined;
    else dataDir = t;
    if (dataDir === '' || dataDir === 'memory') dataDir = undefined;
    const pglite: any = new PGlite(dataDir);
    try {
      const db: any = drizzlePglite(pglite);
      const before = await readJournalPglite(pglite);
      await migratePglite(db, {
        migrationsFolder,
        migrationsTable: MIGRATION_JOURNAL_TABLE,
        migrationsSchema: MIGRATION_JOURNAL_SCHEMA,
      });
      const after = await readJournalPglite(pglite);
      const applied = after.filter((row: any) => !before.some((old: any) => old.hash === row.hash));
      for (const migration of applied) options.onApplied?.(migration);
      return { applied, journal: after, lockId, durationMs: Date.now() - startedAt };
    } finally {
      await (pglite as any).close();
    }
  }
  // max: 1 ⇒ the advisory lock and the DDL share one backend (invariant 1).
  const client = postgres(url, {
    max: 1,
    connect_timeout: 10,
    // A NOTICE (CREATE EXTENSION, ALTER TABLE) is not a warning here; silence
    // keeps the boot log to the lines this function owns.
    onnotice: () => undefined,
  });
  const startedAt2 = Date.now();
  try {
    // Blocking lock: a second boot WAITS for the first instead of failing or
    // racing (T-FOUND-006 edge case "concurrent boots").
    await client`select pg_advisory_lock(${lockId}::bigint)`;
    try {
      const before = await readJournal(client);
      await migratePg(drizzlePg(client), {
        migrationsFolder,
        migrationsTable: MIGRATION_JOURNAL_TABLE,
        migrationsSchema: MIGRATION_JOURNAL_SCHEMA,
      });
      const after = await readJournal(client);
      const applied = after.filter((row) => !before.some((old) => old.hash === row.hash));
      for (const migration of applied) options.onApplied?.(migration);
      return { applied, journal: after, lockId, durationMs: Date.now() - startedAt2 };
    } finally {
      // Released even when a migration failed; a session-level lock dies with
      // the connection anyway, so this is belt and braces (invariant 1).
      await client`select pg_advisory_unlock(${lockId}::bigint)`;
    }
  } finally {
    await client.end({ timeout: 10 });
  }
}

/**
 * Reads the journal oldest-first. A missing table means "nothing applied yet",
 * which is the normal state of a fresh database, so the absence is detected
 * before the SELECT rather than swallowed as an error.
 *
 * The journal's schema/table are interpolated as IDENTIFIERS
 * (`client('name')` in a postgres.js template), never as string values, so a
 * value placeholder can never end up where a table name belongs.
 */
async function readJournal(client: postgres.Sql): Promise<AppliedMigration[]> {
  const [probe] = await client<{ present: boolean }[]>`
    select to_regclass(${`${MIGRATION_JOURNAL_SCHEMA}.${MIGRATION_JOURNAL_TABLE}`}) is not null as present
  `;
  if (probe?.present !== true) return [];
  const rows = await client<
    { id: number; hash: string; created_at: string }[]
  >`select id, hash, created_at from ${client(MIGRATION_JOURNAL_SCHEMA)}.${client(MIGRATION_JOURNAL_TABLE)} order by created_at asc, id asc`;
  return rows.map((row) => ({
    id: Number(row.id),
    hash: row.hash,
    version: Number(row.created_at),
  }));
}

async function readJournalPglite(pglite: any): Promise<AppliedMigration[]> {
  const probe = await pglite.query(
    `select to_regclass('${MIGRATION_JOURNAL_SCHEMA}.${MIGRATION_JOURNAL_TABLE}') is not null as present`,
  );
  if (probe.rows[0]?.present !== true) return [];
  const res = await pglite.query(
    `select id, hash, created_at from "${MIGRATION_JOURNAL_SCHEMA}"."${MIGRATION_JOURNAL_TABLE}" order by created_at asc, id asc`,
  );
  return res.rows.map((row: any) => ({
    id: Number(row.id),
    hash: row.hash,
    version: Number(row.created_at),
  }));
}

/**
 * Boot gate for the composition root (DEPLOYMENT.md §4 step 2).
 *
 * The app MUST await this before serving; `migrationsFolder`/`lockId` are
 * forwarded for tests. This wrapper exists so the boot call site reads as a
 * single documented step and so "migrate then serve" cannot be reordered by a
 * future refactor — the throw is intentional and must abort the boot.
 *
 * spec-question: the composition root (`src/server/composition.ts`, owned by
 * T-CATALOG-002) is the only intended caller; it does not exist yet, so this
 * function is exported and documented, not yet wired.
 */
export async function migrateOnBoot(options: MigrationOptions): Promise<MigrationResult> {
  return runMigrations(options);
}
