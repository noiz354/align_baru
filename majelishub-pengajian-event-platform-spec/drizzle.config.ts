/**
 * Drizzle Kit configuration (ADR-0003, STACK-2026 §5).
 *
 * `db:generate` writes reviewed SQL to `drizzle/`; `db:migrate` applies it. Both are explicit deploy
 * steps — nothing in the application applies a migration on boot (ADR-0020).
 *
 * `DATABASE_URL` is only needed by commands that talk to a database (`db:migrate`, `db:studio`).
 * `db:generate` works from the schema file alone.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/identity.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
