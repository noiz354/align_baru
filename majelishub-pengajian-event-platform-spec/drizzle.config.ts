/**
 * Drizzle Kit configuration - migrations are GENERATED here and APPLIED as an explicit deploy step.
 *
 * ADR-0020: no migration is ever applied at application boot. `npm run db:generate` writes reviewed SQL
 * into `drizzle/`; `npm run db:migrate` runs it with the owner role (DATABASE_MIGRATION_URL), which is a
 * different credential from the application role (DATA_MODEL.md §12, DEPLOYMENT.md §3).
 *
 * Task ownership: T-ARCH-001 (schema scaffolding), T-SEC-001 (tenancy schema + RLS).
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Owner role: the only credential allowed to change the schema.
    url: process.env["DATABASE_MIGRATION_URL"] ?? process.env["DATABASE_URL"] ?? "",
  },
  strict: true,
  verbose: true,
});
