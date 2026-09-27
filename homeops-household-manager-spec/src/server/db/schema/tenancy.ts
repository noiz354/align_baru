// HomeOps — identity & tenancy schema (T-PLAT-004, DATA_MODEL.md §2.1, ADR-002, ADR-005).
//
// The tenancy boundary lives in the shape of these tables: every household-scoped table carries
// `household_id NOT NULL`, and the partial unique index on `household_member` is what makes
// "one membership per user per household" a database fact rather than a code convention.

import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

/** Coarse roles; the capability matrix lives in docs/security/AUTHZ-MATRIX.md, not in the database. */
export const roleEnum = pgEnum('role', ['OWNER', 'ADMIN', 'MEMBER', 'HELPER']);
export const weekStartEnum = pgEnum('week_start', ['MONDAY', 'SUNDAY']);

export const household = pgTable(
  'household',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text('name').notNull(),
    /** IANA identifier, validated in the application (I-HH-001) and non-empty here. */
    timezone: text('timezone').notNull(),
    weekStartsOn: weekStartEnum('week_starts_on').notNull().default('MONDAY'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Created by a `user` (auth-library id space), not by a membership that does not exist yet. */
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    /**
     * The membership created in the same transaction (DOMAIN.md §4.1 `createdByMemberId`).
     * Nullable because the household row must exist before the membership row can reference it;
     * `createHousehold` sets it immediately after inserting the OWNER membership (T-HH-001).
     */
    createdByMemberId: uuid('created_by_member_id'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check('ck_household_name_not_blank', sql`length(trim(${table.name})) > 0`),
    check('ck_household_name_length', sql`char_length(${table.name}) <= 40`),
    check('ck_household_timezone_not_blank', sql`${table.timezone} <> ''`),
    // Case-insensitive lookup index. DATA_MODEL.md §2.1 lists this as `uq_household_name_lower`
    // "(soft)"; enforcing it globally would stop two independent households from both being named
    // "Rumah", which no requirement asks for (FR-HH-001 bounds length only). Non-unique by decision
    // — see DECISIONS.md 2026-09-27 and the updated DATA_MODEL.md row.
    index('idx_household_name_lower').on(sql`lower(${table.name})`),
  ],
);

/** 1:1 policy knobs (DATA_MODEL.md §2.1). Defaults are applied by the creating service, not here. */
export const householdSettings = pgTable(
  'household_settings',
  {
    householdId: uuid('household_id')
      .primaryKey()
      .references(() => household.id, { onDelete: 'cascade' }),
    maintenanceLeadDays: integer('maintenance_lead_days').notNull().default(7),
    snoozeMaxHours: integer('snooze_max_hours').notNull().default(24),
    infoExpiryDays: integer('info_expiry_days').notNull().default(14),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    dailyCapCeiling: integer('daily_cap_ceiling').notNull().default(10),
    roomOverrideMaxHours: integer('room_override_max_hours').notNull().default(168),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('ck_settings_lead_days', sql`${table.maintenanceLeadDays} between 0 and 90`),
    check('ck_settings_snooze_hours', sql`${table.snoozeMaxHours} between 1 and 168`),
    check('ck_settings_info_expiry', sql`${table.infoExpiryDays} between 1 and 90`),
    check('ck_settings_daily_cap', sql`${table.dailyCapCeiling} between 1 and 50`),
    check('ck_settings_override_hours', sql`${table.roomOverrideMaxHours} between 1 and 168`),
    // Quiet hours are both-or-neither: a half-configured window is a member-visible bug (I-HH-003).
    check(
      'ck_settings_quiet_hours_pair',
      sql`(${table.quietHoursStart} is null and ${table.quietHoursEnd} is null) or
          (${table.quietHoursStart} is not null and ${table.quietHoursEnd} is not null)`,
    ),
  ],
);

export const householdMember = pgTable(
  'household_member',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    displayName: text('display_name').notNull(),
    /** Palette index, not a colour literal: presentation owns the mapping (DESIGN.md §13). */
    avatarColor: text('avatar_color'),
    role: roleEnum('role').notNull().default('MEMBER'),
    awayFrom: date('away_from'),
    awayUntil: date('away_until'),
    /** Removal is soft: audit history keeps referring to the membership (DATA_MODEL.md §2.1). */
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('uq_member_household_user').on(table.householdId, table.userId),
    index('idx_member_household').on(table.householdId),
    index('idx_member_user').on(table.userId),
    check('ck_member_display_name_length', sql`char_length(${table.displayName}) between 1 and 40`),
    check(
      'ck_member_away_range',
      sql`${table.awayFrom} is null or ${table.awayUntil} is null or ${table.awayUntil} >= ${table.awayFrom}`,
    ),
  ],
);

/** Single-use, expiring, hashed invitations (FR-MEM-003, THREAT_MODEL T-08). */
export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    invitedEmail: text('invited_email'),
    role: roleEnum('role').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByMemberId: uuid('accepted_by_member_id'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Filled from the acting member by the adapter; nullable because the domain Invitation
     *  value does not carry a creator (DOMAIN.md §4.1). */
    createdByMemberId: uuid('created_by_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_invitation_token_hash').on(table.tokenHash),
    index('idx_invitation_household_state').on(table.householdId, table.acceptedAt, table.revokedAt),
    check('ck_invitation_expires_after_create', sql`${table.expiresAt} > ${table.createdAt}`),
    // OWNER is never grantable through an invitation (docs/security/AUTHZ-MATRIX.md §1).
    check('ck_invitation_role_not_owner', sql`${table.role} <> 'OWNER'`),
  ],
);

export const TENANCY_TABLES = [household, householdSettings, householdMember, invitation] as const;
