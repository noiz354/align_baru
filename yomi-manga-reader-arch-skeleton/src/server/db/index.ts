/**
 * server/db — database access (Drizzle + `postgres` driver).
 *
 * Responsibility: connection lifecycle (pool max 10, clean shutdown), the
 * schema (schema.ts — the 1:1 mirror of DATA_MODEL.md §1–19), the migration
 * runner (boot-time, advisory-locked, expand/contract — DEPLOYMENT.md §4), and
 * the repository implementations (repositories/).
 *
 * This file is the module's public surface. Everything else is behind it:
 *   - `client.ts`     — the driver client and pool (the only `new postgres()`).
 *   - `columns.ts`    — column primitives (uuid v7, timestamptz, citext, numeric).
 *   - `schema.ts`     — the DDL.
 *   - `migrations.ts` — the boot-time runner and the advisory lock.
 *   - `repositories/` — the only SQL in the app (port implementations).
 *
 * Requirements: NFR-SEC-015 (parameterization), NFR-PERF-014 (indexes),
 * NFR-DATA-001/006, NFR-OPS-004 (expand/contract migrations).
 * Tasks: T-FOUND-005/006 (connection + migrations), T-CATALOG-001 &
 * friends (repositories).
 *
 * Rules:
 * - ONLY module allowed to import drizzle-orm / the driver (rule D2, enforced
 *   by ESLint `no-restricted-imports`).
 * - Drizzle row types NEVER leak across the boundary: repository impls map
 *   rows → shared DTOs (data-flow.md §7).
 * - Every hot query names its index in a comment (T-PERF-004 gate list).
 * - DDL never runs through this module's pool: `migrateOnBoot` takes its own
 *   DDL-capable DSN, because the app role has no DDL (T-SEC-005).
 *
 * Boot order for the composition root (DEPLOYMENT.md §4):
 *   1. `loadEnv()` (T-FOUND-002) → 2. `migrateOnBoot({ url })` (T-FOUND-006)
 *   → 3. `createDb(env)` (this task) → 4. register ports → 5. serve.
 * Steps 2 and 3 are deliberately separate connections: the migration role and
 * the application role are different roles (DEPLOYMENT.md §6.3).
 */

export { DB_POOL_MAX, closeDb, createDb, DatabaseConfigurationError } from './client';
export type { Db, PostgresClientOptions } from './client';
export {
  MIGRATION_JOURNAL_SCHEMA,
  MIGRATION_JOURNAL_TABLE,
  MIGRATION_LOCK_ID,
  migrateOnBoot,
  runMigrations,
} from './migrations';
export type { AppliedMigration, MigrationOptions, MigrationResult } from './migrations';
export {
  SCHEMA_TABLES,
  auditEvent,
  bookmark,
  chapter,
  chapterPage,
  creator,
  genre,
  libraryEntry,
  manga,
  mangaAlias,
  mangaCreator,
  mangaGenre,
  mangaTag,
  readerPreference,
  readingHistory,
  readingProgress,
  resetToken,
  sessions,
  tag,
  uploadJob,
  users,
} from './schema';
export type { SchemaTableName } from './schema';
