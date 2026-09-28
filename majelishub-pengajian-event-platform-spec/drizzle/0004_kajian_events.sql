-- 0004_kajian_events: the event occurrence table for wave2 vertical
-- Contract: DATA_MODEL.md §4
CREATE TABLE "kajian_events" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "mosque_id" uuid NOT NULL REFERENCES "mosques"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "kajian_events_org_slug_unique" ON "kajian_events" USING btree ("organization_id","slug");
--> statement-breakpoint
CREATE INDEX "kajian_events_org_starts_idx" ON "kajian_events" USING btree ("organization_id","starts_at" DESC);
--> statement-breakpoint
CREATE INDEX "kajian_events_mosque_idx" ON "kajian_events" USING btree ("mosque_id");
--> statement-breakpoint
CREATE INDEX "kajian_events_status_idx" ON "kajian_events" USING btree ("status");
--> statement-breakpoint
-- RLS: tenant isolation (same as mosques)
ALTER TABLE "kajian_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "kajian_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "kajian_events_tenant_isolation" ON "kajian_events"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  )
  WITH CHECK (
    "organization_id"::text = current_setting('app.organization_id', true)
    OR current_setting('app.scope', true) = 'PLATFORM'
  );
