/**
 * Identity schema - the tables Better Auth owns (ADR-0005) plus the durable rate-limit store.
 *
 * Where this belongs: `server/db/schema` - the only place persistence shape is declared. DATA_MODEL.md
 * §1 is the contract; this file is the Drizzle expression of it and the migrations in `drizzle/` are
 * generated from it and reviewed as SQL (ADR-0020: migrations are an explicit deploy step).
 *
 * Rules encoded here:
 *   - `users.email` is unique, lower-cased and shape-checked (DATA_MODEL §1 `users`).
 *   - A blocked account always carries a reason (`blocked_until IS NULL OR blocked_reason IS NOT NULL`).
 *   - Sessions live in the database: a restart or a deploy logs nobody out (SECURITY.md §2).
 *   - Rate-limit counters live in the database, never in process memory
 *     (docs/research/STACK-2026.md §6, ADR-0005 "default rate limiter is in-memory and resets on
 *     deploy"). The bucket table is the durable store behind `src/server/http/rate-limit.ts`.
 *
 * Task ownership: T-ORG-001 (identity integration + durable rate limiting).
 */
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Organizer / volunteer / reviewer / platform account. Never a participant: participants hold a
 * capability token instead (ADR-0005 context 1, ADR-0006).
 *
 * `id` is text because Better Auth issues its own identifiers; domain aggregates keep UUIDv7
 * (DATA_MODEL.md global conventions). The deviation is recorded in TASKS.md T-ORG-001.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** DATA_MODEL §1: optional phone, E.164. Contact data is personal data (PRIVACY.md §4). */
    phoneE164: text("phone_e164"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_phone_e164_unique").on(t.phoneE164),
    index("users_last_seen_at_idx").on(t.lastSeenAt),
    // A dot in the domain part: the stricter of the two shapes this table was specified with (the
    // 2026-09-27 merge of `main` tightened it; the migration and this schema must agree).
    check("users_email_shape", sql`${t.email} ~* '^[^@]+@[^@]+\.[^@]+$'`),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "users_blocked_reason_required",
      sql`${t.blockedUntil} IS NULL OR (${t.blockedReason} IS NOT NULL AND length(${t.blockedReason}) >= 3)`,
    ),
  ],
);

/** Organizer/admin session. Revocable, listable per account, 8h idle timeout (SECURITY.md §2). */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Operator-facing label so a person can recognise and revoke their own devices. */
    deviceLabel: text("device_label"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("sessions_token_unique").on(t.token), index("sessions_user_id_idx").on(t.userId)],
);

/** Credential records (password, passkey, OAuth). Better Auth core model. */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

/** Email verification / password reset / magic-link challenges. Values are short-lived. */
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier"),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/**
 * Durable rate-limit buckets (fixed window).
 *
 * One row per `(policy key, dimension value, window)`. The counter is incremented with a single
 * `INSERT ... ON CONFLICT DO UPDATE` so that N concurrent requests cannot all pass a stale read
 * (the concurrency gap Better Auth documents for its non-atomic get/set path).
 *
 * Retention: abuse counters follow a short documented retention (RETENTION.md); the cleanup job is
 * T-SEC-010.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    /** `${policyKey}:${dimension}:${hashedValue}:${windowStartEpochSeconds}` - never a raw IP. */
    bucketKey: text("bucket_key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_buckets_window_start_idx").on(t.windowStart), check("rate_limit_hits_non_negative", sql`${t.hits} >= 0`)],
);
