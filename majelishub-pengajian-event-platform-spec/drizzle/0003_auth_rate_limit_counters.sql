-- Migration 0003 — auth_rate_limit_counters: the durable counter store for auth policies.
--
-- Task: T-ORG-001 / T-SEC-010 · Specification: SECURITY.md §13, ADR-0005 (Better Auth's in-memory
--   limiter resets on deploy — unacceptable in production).
-- Drizzle schema: the columns are read and written with parameterised SQL by
--   `src/server/db/repositories/auth-rate-limit-counters.ts`; no Drizzle table object is declared for it
--   (the repository is the contract, and `ops/db-migrate.mjs` applies this file like any other).
-- Applied by: `npm run db:migrate` (ops/db-migrate.mjs) and by tests/support/{db,database}.ts. Never at
--   application boot (ADR-0020).
--
-- Operational notes (DATA_MODEL.md §12.5):
--   expected duration : < 1 s (new, empty table)
--   locking behaviour : ACCESS EXCLUSIVE on the new table only; nothing else waits
--   safe during event : yes — no existing table is touched
--   rollback          : DROP TABLE auth_rate_limit_counters;  (counters are disposable by design:
--                       losing them widens a rate-limit window, it does not lose product data)
--
-- WHY A SECOND COUNTER TABLE
--   `rate_limit_buckets` (0000) backs the HTTP-dimension policies in `src/server/http/rate-limit.ts` and
--   Better Auth's `customStorage`. This one backs the auth policies in
--   `src/server/auth/rate-limit-counters.ts`, whose suite asserts saturation at `limit + 1` and
--   window-cleanup semantics that the other table does not model. Both arrived with T-ORG-001 from two
--   branches; consolidating them is a follow-up owned by T-SEC-010 (recorded in TASKS.md).

CREATE TABLE "auth_rate_limit_counters" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limit_counters_window_idx" ON "auth_rate_limit_counters" USING btree ("window_started_at");

-- The application role needs the full row lifecycle here: a counter is consumed, updated and eventually
-- deleted by the cleanup job. Bucket keys are HMAC digests (src/server/crypto/subject-hash.ts), so the
-- table holds no identifier in the clear and carries no row-level security, exactly like
-- `rate_limit_buckets`.
REVOKE ALL ON "auth_rate_limit_counters" FROM majelishub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "auth_rate_limit_counters" TO majelishub_app;
