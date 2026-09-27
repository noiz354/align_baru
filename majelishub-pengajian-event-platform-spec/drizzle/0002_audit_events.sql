-- Migration 0002 — audit_events: the append-only, tamper-evident record.
--
-- Task: T-SEC-007 · Specification: SECURITY.md §9, FR-AUDIT-001..005, RETENTION.md (7 years),
--   docs/security/AUTHZ-MATRIX.md §4.5 (reason-required actions)
-- Drizzle schema: src/server/db/schema/audit.ts (keep the two in sync; `npx drizzle-kit check` compares
--   the schema against the migration set).
-- Applied by: `npm run db:migrate` (ops/db-migrate.mjs, transactional, idempotent) and by
--   tests/support/db.ts. Never at application boot (ADR-0020).
--
-- Operational notes (DATA_MODEL.md §12.5):
--   expected duration : < 1 s on an empty deployment; the table starts empty, so the CREATE TABLE and
--                       the three CREATE INDEX statements cost nothing measurable
--   locking behaviour : ACCESS EXCLUSIVE on `audit_events` only (a new table, so nothing else waits);
--                       the trigger and the RLS statements rewrite that same table's catalog entry
--   safe during event : yes - no existing table is touched and no row is rewritten
--   rollback          : DROP TABLE "audit_events" CASCADE;  (drops the triggers and policies with it.
--                       Rollback DESTROYS EVIDENCE: only valid before the first entry is written;
--                       afterwards export first - RETENTION.md keeps audit for 7 years.)
--
-- What this file adds beyond the table:
--   1. The application role gets SELECT and INSERT only — no UPDATE, no DELETE, no TRUNCATE. The audit
--      trail cannot be rewritten from the API layer even if that layer is fully compromised (T-17).
--   2. A trigger refuses UPDATE/DELETE/TRUNCATE for any role unless the session explicitly sets
--      `majelishub.allow_audit_rewrite = 'on'` — the documented incident/repair switch, which requires a
--      role that already has the grant (i.e. the migration/owner role, not `majelishub_app`).
--   3. Row-level security so an organization can only read and append its own chain entries.

CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"chain_position" bigint NOT NULL,
	"action_key" text NOT NULL,
	"scope_kind" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"target_type" text,
	"target_id" text,
	"reason" text,
	"request_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text,
	"hash" text NOT NULL,
	CONSTRAINT "audit_events_hash_shape" CHECK ("audit_events"."hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_events_prev_hash_shape" CHECK ("audit_events"."prev_hash" IS NULL OR "audit_events"."prev_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_events_position_positive" CHECK ("audit_events"."chain_position" > 0),
	CONSTRAINT "audit_events_reason_length" CHECK ("audit_events"."reason" IS NULL OR char_length("audit_events"."reason") >= 8)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_org_position_unique" ON "audit_events" USING btree ("organization_id","chain_position");
--> statement-breakpoint
CREATE INDEX "audit_events_org_occurred_idx" ON "audit_events" USING btree ("organization_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "audit_events_org_action_idx" ON "audit_events" USING btree ("organization_id","action_key");

-- 1. Grants: append-only for the application role. No UPDATE/DELETE/TRUNCATE anywhere in this file.
REVOKE ALL ON "audit_events" FROM majelishub_app;
GRANT SELECT, INSERT ON "audit_events" TO majelishub_app;

-- 2. Append-only trigger. The switch exists so an incident can be investigated and a corrupted chain
--    repaired deliberately; it is not reachable by `majelishub_app`, which has no UPDATE grant at all.
CREATE OR REPLACE FUNCTION audit_events_refuse_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('majelishub.allow_audit_rewrite', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_events is append-only (T-SEC-007); set majelishub.allow_audit_rewrite to repair a chain deliberately';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_update" BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_refuse_mutation();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_delete" BEFORE DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_refuse_mutation();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_truncate" BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_refuse_mutation();

-- 3. Row-level security: an organization sees and appends only its own chain. PLATFORM scope is the
--    documented exception (docs/security/AUTHZ-MATRIX.md §4.7): platform actions are themselves
--    reason-required and audited.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  )
  WITH CHECK (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  );

-- Verification (executed by tests/integration/audit/chain.test.ts):
--   1. a chain verifies in linear time and reports the first broken position;
--   2. an UPDATE/DELETE attempt from `majelishub_app` fails on the grant;
--   3. an UPDATE by the owner without the repair switch fails on the trigger;
--   4. a row edited with the switch on is detected by the verifier;
--   5. concurrent appends produce no fork (one row per position, contiguous from 1).
