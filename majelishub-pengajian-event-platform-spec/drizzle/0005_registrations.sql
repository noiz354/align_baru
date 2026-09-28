CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"attendee_email" text NOT NULL,
	"attendee_name" text NOT NULL,
	"status" text DEFAULT 'REGISTERED' NOT NULL,
	"token_hash" text NOT NULL,
	"short_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_attendance" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_kajian_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."kajian_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_event_id_kajian_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."kajian_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_token_hash_unique" ON "event_registrations" USING btree ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_short_code_unique" ON "event_registrations" USING btree ("short_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_email_unique" ON "event_registrations" USING btree ("event_id","attendee_email");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendance_registration_unique" ON "event_attendance" USING btree ("registration_id");
--> statement-breakpoint
CREATE INDEX "event_registrations_org_idx" ON "event_registrations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_registrations_event_idx" ON "event_registrations" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "event_attendance_org_event_idx" ON "event_attendance" USING btree ("organization_id","event_id");
--> statement-breakpoint
CREATE INDEX "event_attendance_event_idx" ON "event_attendance" USING btree ("event_id");
