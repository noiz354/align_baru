CREATE TYPE "public"."activity_type" AS ENUM('HOUSEHOLD_CREATED', 'HOUSEHOLD_SETTINGS_CHANGED', 'MEMBER_INVITED', 'MEMBER_JOINED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'MEMBER_LEFT', 'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_ARCHIVED', 'ROOM_OVERRIDE_SET', 'ROOM_OVERRIDE_EXPIRED', 'CHORE_CREATED', 'CHORE_UPDATED', 'CHORE_PAUSED', 'CHORE_RESUMED', 'CHORE_ARCHIVED', 'CHORE_COMPLETED', 'CHORE_SKIPPED', 'CHORE_SNOOZED', 'CHORE_REASSIGNED', 'CHORE_REOPENED', 'TRASH_STATE_CHANGED', 'TRASH_COLLECTION_ASSIGNED', 'TRASH_COLLECTION_COMPLETED', 'RESOURCE_CREATED', 'RESOURCE_LEVEL_CHANGED', 'RESOURCE_RESTOCKED', 'RESOURCE_MODE_CHANGED', 'SHOPPING_ITEM_ADDED', 'SHOPPING_ITEM_PURCHASED', 'ASSET_CREATED', 'PLAN_CREATED', 'PLAN_PAUSED', 'PLAN_RESUMED', 'SERVICE_RECORDED', 'ISSUE_REPORTED', 'ISSUE_ACKNOWLEDGED', 'ISSUE_PROGRESSED', 'ISSUE_RESOLVED', 'ISSUE_CLOSED', 'ISSUE_COMMENTED', 'ALERT_ACKNOWLEDGED', 'ALERT_SNOOZED', 'ALERT_RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."outbox_state" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'HELPER');--> statement-breakpoint
CREATE TYPE "public"."week_start" AS ENUM('MONDAY', 'SUNDAY');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"type" "activity_type" NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_activity_summary_length" CHECK (char_length("activity_event"."summary") <= 200),
	CONSTRAINT "ck_activity_retained" CHECK ("activity_event"."retain_until" > "activity_event"."occurred_at")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_kind" text,
	"target_id" text,
	"outcome" text NOT NULL,
	"ip_hash" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_audit_outcome" CHECK ("audit_log"."outcome" in ('OK', 'DENIED'))
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"household_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"entity_kind" text,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_idempotency_status" CHECK ("idempotency_key"."status" in ('COMMITTED', 'IN_FLIGHT', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "outbox_message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid,
	"dedupe_key" text NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" "outbox_state" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "ck_outbox_attempts_bounded" CHECK ("outbox_message"."attempts" <= 8)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler_job_run" (
	"job" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_succeeded_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"last_error_class" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_duration_ms" integer,
	"last_processed_count" integer
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"week_starts_on" "week_start" DEFAULT 'MONDAY' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"created_by_member_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_household_name_not_blank" CHECK (length(trim("household"."name")) > 0),
	CONSTRAINT "ck_household_name_length" CHECK (char_length("household"."name") <= 40),
	CONSTRAINT "ck_household_timezone_not_blank" CHECK ("household"."timezone" <> '')
);
--> statement-breakpoint
CREATE TABLE "household_member" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_color" text,
	"role" "role" DEFAULT 'MEMBER' NOT NULL,
	"away_from" date,
	"away_until" date,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_member_display_name_length" CHECK (char_length("household_member"."display_name") between 1 and 40),
	CONSTRAINT "ck_member_away_range" CHECK ("household_member"."away_from" is null or "household_member"."away_until" is null or "household_member"."away_until" >= "household_member"."away_from")
);
--> statement-breakpoint
CREATE TABLE "household_settings" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"maintenance_lead_days" integer DEFAULT 7 NOT NULL,
	"snooze_max_hours" integer DEFAULT 24 NOT NULL,
	"info_expiry_days" integer DEFAULT 14 NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"daily_cap_ceiling" integer DEFAULT 10 NOT NULL,
	"room_override_max_hours" integer DEFAULT 168 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_settings_lead_days" CHECK ("household_settings"."maintenance_lead_days" between 0 and 90),
	CONSTRAINT "ck_settings_snooze_hours" CHECK ("household_settings"."snooze_max_hours" between 1 and 168),
	CONSTRAINT "ck_settings_info_expiry" CHECK ("household_settings"."info_expiry_days" between 1 and 90),
	CONSTRAINT "ck_settings_daily_cap" CHECK ("household_settings"."daily_cap_ceiling" between 1 and 50),
	CONSTRAINT "ck_settings_override_hours" CHECK ("household_settings"."room_override_max_hours" between 1 and 168),
	CONSTRAINT "ck_settings_quiet_hours_pair" CHECK (("household_settings"."quiet_hours_start" is null and "household_settings"."quiet_hours_end" is null) or
          ("household_settings"."quiet_hours_start" is not null and "household_settings"."quiet_hours_end" is not null))
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"invited_email" text,
	"role" "role" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_member_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_invitation_expires_after_create" CHECK ("invitation"."expires_at" > "invitation"."created_at"),
	CONSTRAINT "ck_invitation_role_not_owner" CHECK ("invitation"."role" <> 'OWNER')
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "household_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_settings" ADD CONSTRAINT "household_settings_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_session_user" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_expires" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_activity_household_time" ON "activity_event" USING btree ("household_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activity_entity" ON "activity_event" USING btree ("household_id","entity_kind","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activity_retention" ON "activity_event" USING btree ("retain_until");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_household_time" ON "audit_log" USING btree ("household_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idempotency_household_key" ON "idempotency_key" USING btree ("household_id","client_request_id","operation");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outbox_dedupe" ON "outbox_message" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_outbox_due" ON "outbox_message" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_window" ON "rate_limit_bucket" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_household_name_lower" ON "household" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_household_user" ON "household_member" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_member_household" ON "household_member" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_member_user" ON "household_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invitation_token_hash" ON "invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_invitation_household_state" ON "invitation" USING btree ("household_id","accepted_at","revoked_at");