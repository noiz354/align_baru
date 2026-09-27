/**
 * Identity schema — the persistence contract for organizer/volunteer/reviewer/admin accounts.
 *
 * Where this belongs: server/db/schema. Only `src/server/db` and repository adapters may import the
 * Drizzle schema (ARCHITECTURE.md §5); feature code speaks in domain types.
 *
 * Specification:
 *   DATA_MODEL.md §1 (users) and §Global conventions (UUIDv7 PKs, timestamptz UTC, no soft delete)
 *   ADR-0005 (Better Auth owns identity; sessions live in our Postgres)
 *   ADR-0003 (Drizzle), ADR-0020 (migrations are an explicit deploy step — nothing is applied on boot)
 *   SECURITY.md §2 (session rules: HttpOnly/Secure/SameSite, revocation, idle timeout 8 h for
 *     organizer/admin surfaces), §13 (rate limits are durable, never the library's in-memory store)
 *   PRIVACY.md / RETENTION.md (sessions 30 days; rate-limit counters are short-lived abuse data)
 *
 * Field names are snake_case in the database and camelCase in TypeScript, matching Better Auth's
 * default mapping so the adapter needs no per-field overrides.
 *
 * Task ownership: T-ORG-001. The `organizations` / `organization_members` tables that give these users
 * roles are deliberately NOT here — that is T-ORG-002 (organization model) and T-SEC-001 (scope).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

/**
 * `users` — an organizer, volunteer, reviewer or platform operator.
 *
 * Never a participant: attending a kajian does not create a row here (ADR-0005 §Context 1).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** Nullable; E.164 when present. Not required for an account to exist (data minimisation). */
    phoneE164: text("phone_e164"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
    /** Suspension window. `blocked_reason` is mandatory whenever a block is set (DATA_MODEL §1). */
    blockedUntil: timestamp("blocked_until", { withTimezone: true, mode: "date" }),
    blockedReason: text("blocked_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_lower_key").on(sql`lower(${table.email})`),
    // Postgres treats NULLs as distinct, so many users may have no phone without colliding.
    uniqueIndex("users_phone_e164_key").on(table.phoneE164),
    index("users_last_seen_at_idx").on(table.lastSeenAt),
    check("users_email_shape", sql`${table.email} ~* '^[^@]+@[^@]+\\.[^@]+$'`),
    check(
      "users_blocked_reason_present",
      sql`${table.blockedUntil} IS NULL OR (${table.blockedReason} IS NOT NULL AND length(${table.blockedReason}) >= 3)`,
    ),
  ],
);

/**
 * `sessions` — server-side session state. A restart must not log anyone out (SECURITY.md §2, and
 * Better Auth's in-memory alternatives are not used).
 *
 * `token` is the opaque session token held in the cookie; only its hash would be better, but the
 * session store is the lookup mechanism itself, so the value must be retrievable by token.
 * `ip_address` exists because the identity library's session model defines it, but it is never
 *   written: IP tracking is disabled (`src/server/auth/better-auth.ts`), because `PRIVACY.md` §3
 *   records stored IP addresses as hashed. `user_agent` is personal data, retained with the session
 *   (30 days, `RETENTION.md` R29) and never emitted to telemetry (`OBSERVABILITY.md` §7).
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_key").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * `accounts` — credential and OAuth linkage. `password` is populated only by the credential
 * provider and is Better Auth's hashed value; we never store or log a plaintext password.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_key").on(table.providerId, table.accountId),
  ],
);

/** `verifications` — email verification and password-reset tokens (short-lived, single purpose). */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * `auth_rate_limit_counters` — the durable rate-limit store.
 *
 * Why this table exists: Better Auth's default limiter is in-memory and resets on deploy, which
 * ADR-0005 records as unacceptable in production. A row per (policy, subject) bucket is the smallest
 * thing that is shared across replicas and survives a restart.
 *
 * Privacy: `bucket_key` never contains a raw identifier. Callers hash the subject first
 * (`src/server/auth/rate-limit.ts`), so an email or a device id is not written here in the clear.
 * Retention: short, abuse-purpose only — swept by the retention job (`RETENTION.md`).
 */
export const authRateLimitCounters = pgTable(
  "auth_rate_limit_counters",
  {
    bucketKey: text("bucket_key").primaryKey(),
    count: integer("count").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [index("auth_rate_limit_counters_updated_at_idx").on(table.updatedAt)],
);

/** Tables Better Auth's Drizzle adapter needs, keyed the way the adapter expects them. */
export const identitySchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
} as const;

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
