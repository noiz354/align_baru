-- 0000_identity_and_tenancy.sql
-- MajelisHub · VS-1 · Tasks: T-ORG-001 (identity + durable rate limiting), T-SEC-001 (tenancy)
-- Contract: DATA_MODEL.md §1 (identity / organizations), §2 (mosques), §11 (constraint invariants),
--           §12 (migration policy) · ADR-0005 (Better Auth), ADR-0017 (shared-schema tenancy),
--           ADR-0020 (migrations are an explicit deploy step, never on boot)
--
-- Operational notes (DATA_MODEL.md §12.5):
--   expected duration : < 2 s on an empty database; this is the first migration of a deployment
--   locking behaviour : CREATE TABLE / CREATE INDEX only - no existing table is locked
--   safe during event : yes (nothing reads or writes these tables before this migration exists)
--   rollback          : DROP TABLE in reverse dependency order (statements listed at the bottom)
--
-- Deliberately NOT in this file: mosque address/coordinates/venues/facilities/contacts
-- (T-MOSQUE-001/002), organization invitations (T-ORG-003), and every later module's tables.

-- --------------------------------------------------------------------------- identity (ADR-0005)
CREATE TABLE "users" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "phone_e164" text,
  "last_seen_at" timestamp with time zone,
  "blocked_until" timestamp with time zone,
  "blocked_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_shape" CHECK ("email" ~* '^[^@]+@[^@]+$'),
  CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email")),
  CONSTRAINT "users_blocked_reason_required" CHECK ("blocked_until" IS NULL OR "blocked_reason" IS NOT NULL)
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
CREATE UNIQUE INDEX "users_phone_e164_unique" ON "users" ("phone_e164");
CREATE INDEX "users_last_seen_at_idx" ON "users" ("last_seen_at" DESC);

CREATE TABLE "sessions" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "device_label" text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" ("token");
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");

CREATE TABLE "accounts" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");

CREATE TABLE "verifications" (
  "id" text PRIMARY KEY,
  "identifier" text,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");

-- Durable rate-limit store. The in-memory default of the auth library is forbidden in production
-- (docs/research/STACK-2026.md §6, ADR-0005, SECURITY.md §13). One row per policy/dimension/window.
CREATE TABLE "rate_limit_buckets" (
  "bucket_key" text PRIMARY KEY,
  "window_start" timestamp with time zone NOT NULL,
  "hits" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rate_limit_hits_non_negative" CHECK ("hits" >= 0)
);
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets" ("window_start");

-- --------------------------------------------------------------------------- tenancy (ADR-0017)
CREATE TYPE "organization_kind" AS ENUM ('MOSQUE', 'COMMUNITY', 'FOUNDATION', 'OTHER');
CREATE TYPE "mosque_kind" AS ENUM ('MASJID', 'MUSHOLLA', 'SURAU', 'HALL', 'CAMPUS', 'OFFICE', 'OTHER');
CREATE TYPE "membership_status" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "kind" "organization_kind" NOT NULL DEFAULT 'MOSQUE',
  "timezone" text NOT NULL DEFAULT 'Asia/Jakarta',
  "is_published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" ("slug");
CREATE INDEX "organizations_is_published_idx" ON "organizations" ("is_published");

CREATE TABLE "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "roles" text[] NOT NULL,
  "mosque_ids" uuid[],
  "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "organization_members_has_role" CHECK (cardinality("roles") >= 1),
  -- Role keys come from docs/security/AUTHZ-MATRIX.md §1 via src/server/db/schema/tenancy.ts ROLE_KEYS.
  CONSTRAINT "organization_members_roles_known" CHECK (
    "roles" <@ ARRAY['PARTICIPANT','SPEAKER','MOSQUE_ADMIN','ORGANIZER','VOLUNTEER','AUDIO_OPERATOR','TRANSCRIPT_REVIEWER','MODERATOR','PLATFORM_ADMIN']::text[]
  )
);
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" ("organization_id", "user_id");
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" ("user_id");

CREATE TABLE "mosques" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "kind" "mosque_kind" NOT NULL DEFAULT 'MASJID',
  "timezone" text NOT NULL DEFAULT 'Asia/Jakarta',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "mosques_org_slug_unique" ON "mosques" ("organization_id", "slug");
-- Composite FK target for child tables (DATA_MODEL.md §11.13): a child can only reference a mosque
-- inside its own organization, which makes a cross-tenant reference structurally impossible.
CREATE UNIQUE INDEX "mosques_id_org_unique" ON "mosques" ("id", "organization_id");
CREATE INDEX "mosques_organization_id_idx" ON "mosques" ("organization_id");
CREATE INDEX "mosques_is_active_idx" ON "mosques" ("is_active");

-- Rollback (manual, in this order):
--   DROP TABLE "mosques"; DROP TABLE "organization_members"; DROP TABLE "organizations";
--   DROP TYPE "membership_status"; DROP TYPE "mosque_kind"; DROP TYPE "organization_kind";
--   DROP TABLE "rate_limit_buckets"; DROP TABLE "verifications"; DROP TABLE "accounts";
--   DROP TABLE "sessions"; DROP TABLE "users";
