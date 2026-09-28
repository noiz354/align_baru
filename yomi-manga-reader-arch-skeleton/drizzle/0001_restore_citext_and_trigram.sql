-- Restore the real-Postgres model that 0000 froze out of the migration.
--
-- 0000 was generated while DATABASE_URL pointed at a PGlite-style DSN, so the
-- dev-fallback branch of the schema was baked into the permanent initial migration:
-- `users.email` became `text` instead of `citext`, the two trigram indexes became
-- plain btrees, and both `CREATE EXTENSION` lines were commented out with a note
-- that PGlite has no extensions.
--
-- The consequences were invisible locally and wrong in production: on the PostgreSQL 18
-- that ADR-002 requires, `pg_extension` held nothing but plpgsql, email uniqueness was
-- case-sensitive, and the prefix/contains search that FR-SEARCH-001/004 and NFR-PERF-005
-- rest on had no trigram support.
--
-- 0000 is not edited, because an environment that already applied it would never see the
-- change. This migration is additive and dialect-aware: on real PostgreSQL it restores
-- citext, pg_trgm and the GIN trigram indexes; on the PGlite dev fallback it degrades to
-- the btree/text behaviour 0000 already produces, with a NOTICE, so the documented
-- no-Docker development path keeps working.
--
-- `runMigrations` (T-FOUND-006) applies this through the same journal as 0000.

--> statement-breakpoint
-- Extensions first: the type and the operator class below are both supplied by them.
-- A backend without extension support (PGlite) raises here, and the exception handler
-- keeps the migration reversible-on-failure rather than wedging every later boot.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS "citext"';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'citext unavailable on this backend; users.email stays text (PGlite dev fallback)';
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS "pg_trgm"';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable on this backend; trigram indexes stay btree (PGlite dev fallback)';
END
$$;
--> statement-breakpoint
-- DATA_MODEL §1: `email citext NOT NULL`. Widening text -> citext is a table rewrite, so
-- it only happens when citext actually exists. Case-insensitive uniqueness then comes from
-- the type itself rather than from a lower(email) index.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    EXECUTE 'ALTER TABLE "users" ALTER COLUMN "email" TYPE citext';
  END IF;
END
$$;
--> statement-breakpoint
-- DATA_MODEL §19: GIN trigram indexes on manga.title and manga_alias.alias. 0000 created
-- btree indexes under the same names, so the replacement is a drop + create rather than an
-- additional index — two indexes on one column would make every write pay for both.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'DROP INDEX IF EXISTS "ix_manga_title_trgm"';
    EXECUTE 'DROP INDEX IF EXISTS "ix_manga_alias_alias"';
    EXECUTE 'CREATE INDEX "ix_manga_title_trgm" ON "manga" USING gin ("title" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX "ix_manga_alias_alias" ON "manga_alias" USING gin ("alias" gin_trgm_ops)';
  END IF;
END
$$;
