/**
 * PHASE 0 shell. No schema exists yet and NO migration may be generated or pushed in this phase
 * (ADR-0004, ADR-0036). `drizzle-kit push` is forbidden on shared environments permanently.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true
} satisfies Config;
