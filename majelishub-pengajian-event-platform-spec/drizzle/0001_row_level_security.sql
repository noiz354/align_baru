-- 0001_row_level_security.sql
-- MajelisHub · VS-1 · Task: T-SEC-001 (tenant isolation, layer 3)
-- Contract: ADR-0017 (shared-schema multi-tenancy with layered enforcement), SECURITY.md §4,
--           docs/security/AUTHZ-MATRIX.md §4.1 (scope, not just role)
--
-- Operational notes (DATA_MODEL.md §12.5):
--   expected duration : < 1 s (three tables, empty or small)
--   locking behaviour : ACCESS EXCLUSIVE while ENABLE ROW LEVEL SECURITY rewrites the table catalog
--                       entry; on a populated deployment run it outside an event window
--   safe during event : only when the tables are small; otherwise schedule it
--   rollback          : DROP POLICY ...; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
--
-- WHY THIS EXISTS
--   The application's scoped WHERE clause (repositories) is the PRIMARY control. RLS is the backstop
--   for the case where a future query forgets the predicate: with the session variables set and the
--   connection running as the non-superuser application role, the database itself refuses to return
--   another organization's rows. ADR-0017 explicitly rejects RLS as the ONLY control.
--
-- WHY NOT ALL TABLES
--   `users`, `sessions`, `accounts`, `verifications` and `rate_limit_buckets` are global identity and
--   transport tables, not tenant aggregates (ADR-0017: "participant identity can be global while roles
--   stay scoped"). They are protected by the authorization guard (T-SEC-002), not by RLS, and they are
--   never exposed through a scoped endpoint. Every tenant aggregate added later MUST be added here in
--   the same migration that creates it - the isolation suite enumerates scoped tables and fails the
--   build when one has no policy.

-- --------------------------------------------------------------------------- application role
-- Created NOLOGIN on purpose: credentials are never committed. Deployment grants LOGIN and sets the
-- password from the secret store (DEPLOYMENT.md §3, DATABASE_URL uses this role;
-- DATABASE_MIGRATION_URL uses the owner role, which is the only role allowed to run migrations).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'majelishub_app') THEN
    CREATE ROLE majelishub_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO majelishub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO majelishub_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO majelishub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO majelishub_app;
-- The application role must never be able to bypass RLS or change the schema it runs against.
ALTER ROLE majelishub_app NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM majelishub_app;

-- --------------------------------------------------------------------------- policies
-- Session variables are set per transaction by src/server/db/client.ts (set_config(..., is_local=true)).
-- A missing variable yields NULL, the comparison is NULL, the policy is not satisfied: fail closed.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mosques" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_tenant_isolation" ON "organizations"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING (
    "id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  )
  WITH CHECK (
    "id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  );

CREATE POLICY "organization_members_tenant_isolation" ON "organization_members"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  )
  WITH CHECK (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  );

CREATE POLICY "mosques_tenant_isolation" ON "mosques"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  )
  WITH CHECK (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  );

-- PLATFORM scope is a documented exception, not a superuser bypass: it is only set for a session that
-- holds `platform.operate`, and every such action is reason-required and audited
-- (docs/security/AUTHZ-MATRIX.md §4.5/§4.7, SECURITY.md §10).

-- Verification (executed by tests/integration/security/isolation.test.ts):
--   1. an unscoped SELECT inside a scoped transaction returns only the current organization's rows;
--   2. a cross-organization INSERT is rejected by WITH CHECK;
--   3. an unset session variable returns zero rows rather than all rows.
