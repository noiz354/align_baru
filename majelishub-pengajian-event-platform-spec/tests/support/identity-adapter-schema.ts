/**
 * Test-only mirror of the identity tables for the Better Auth Drizzle adapter.
 *
 * Why this file exists: `@better-auth/drizzle-adapter` resolves a model field to a **property** of the
 * Drizzle table object, while production talks to Postgres through a `pg` pool, where Better Auth writes
 * raw SQL and needs the real **column** names (`src/server/auth/auth.ts` maps `emailVerified` ->
 * `email_verified`). The same `createAuth` configuration therefore needs a table object whose property
 * names equal the column names when it runs through Drizzle.
 *
 * So this mirror declares the four identity tables with snake_case property names. It is fixture code,
 * not a second schema: `tests/integration/identity/auth-round-trip.test.ts` asserts on every run that
 * these tables have exactly the same columns as `src/server/db/schema/identity.ts`, so the mirror cannot
 * drift away from the migrated schema.
 *
 * Task ownership: T-ORG-001.
 */
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * `id` is declared without `.primaryKey()` on purpose. The Drizzle adapter renders `DEFAULT` for any
 * column it treats as auto-generated, and Better Auth only supplies the id itself when it is not told the
 * database will (`src/server/auth/auth.ts` generates it with `randomUUID()` for exactly this reason).
 * The migrated schema keeps the real primary key; the column NAME set is what the drift test compares.
 */
export const usersSnake = pgTable("users", {
  id: text("id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  email_verified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone_e164: text("phone_e164"),
  last_seen_at: timestamp("last_seen_at", { withTimezone: true }),
  blocked_until: timestamp("blocked_until", { withTimezone: true }),
  blocked_reason: text("blocked_reason"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsSnake = pgTable("sessions", {
  id: text("id"),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  device_label: text("device_label"),
  user_id: text("user_id").notNull(),
});

export const accountsSnake = pgTable("accounts", {
  id: text("id"),
  account_id: text("account_id").notNull(),
  provider_id: text("provider_id").notNull(),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  id_token: text("id_token"),
  access_token_expires_at: timestamp("access_token_expires_at", { withTimezone: true }),
  refresh_token_expires_at: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  user_id: text("user_id").notNull(),
});

export const verificationsSnake = pgTable("verifications", {
  id: text("id"),
  identifier: text("identifier"),
  value: text("value").notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// No indexes here: the adapter only needs columns. Constraints and indexes belong to the migrated
// schema, which is what `createTestDatabase()` applies.

export const identityAdapterSchema = {
  users: usersSnake,
  sessions: sessionsSnake,
  accounts: accountsSnake,
  verifications: verificationsSnake,
};
