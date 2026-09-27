import { defineConfig } from 'drizzle-kit';

/**
 * Migration generation (T-PLAT-003, DATA_MODEL.md §5): forward-only SQL, reviewed and committed.
 * The generated file is the artefact that ships; this config is only the generator's input.
 */
export default defineConfig({
  // Explicit glob, not a barrel: cross-module re-export files are forbidden (ARCHITECTURE.md §4.1 L-6).
  schema: './src/server/db/schema/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://homeops:homeops@localhost:5432/homeops_dev',
  },
  strict: true,
  verbose: true,
});
