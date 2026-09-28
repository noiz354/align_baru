CREATE TYPE "public"."chore_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'SNOOZED');--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"group_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"not_in_use" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "chore_definition" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"room_id" uuid,
	"assignee_member_id" uuid,
	"priority" "chore_priority" DEFAULT 'MEDIUM' NOT NULL,
	"recurrence_kind" text DEFAULT 'NONE' NOT NULL,
	"estimated_minutes" integer,
	"notes" text,
	"paused_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "chore_occurrence" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"definition_id" uuid,
	"occurrence_key" text NOT NULL,
	"source" text DEFAULT 'DEFINITION' NOT NULL,
	"title_snapshot" text NOT NULL,
	"room_id_snapshot" uuid,
	"due_on" date NOT NULL,
	"status" "occurrence_status" DEFAULT 'OPEN' NOT NULL,
	"assignee_member_id" uuid,
	"snoozed_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_definition" ADD CONSTRAINT "chore_definition_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_definition" ADD CONSTRAINT "chore_definition_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_definition" ADD CONSTRAINT "chore_definition_assignee_member_id_household_member_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."household_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence" ADD CONSTRAINT "chore_occurrence_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence" ADD CONSTRAINT "chore_occurrence_definition_id_chore_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."chore_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence" ADD CONSTRAINT "chore_occurrence_room_id_snapshot_room_id_fk" FOREIGN KEY ("room_id_snapshot") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence" ADD CONSTRAINT "chore_occurrence_assignee_member_id_household_member_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."household_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_occurrence" ADD CONSTRAINT "chore_occurrence_completed_by_member_id_household_member_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "public"."household_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_room_household" ON "room" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_room_household_name" ON "room" USING btree ("household_id","name");--> statement-breakpoint
CREATE INDEX "idx_chore_def_household" ON "chore_definition" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_chore_def_room" ON "chore_definition" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_occurrence_household_key" ON "chore_occurrence" USING btree ("household_id","occurrence_key");--> statement-breakpoint
CREATE INDEX "idx_occurrence_household_due" ON "chore_occurrence" USING btree ("household_id","due_on");--> statement-breakpoint
CREATE INDEX "idx_occurrence_household_status" ON "chore_occurrence" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "idx_occurrence_household_room" ON "chore_occurrence" USING btree ("household_id","room_id_snapshot");
