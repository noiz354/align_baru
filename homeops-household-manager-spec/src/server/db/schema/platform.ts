// HomeOps — cross-cutting platform tables (T-PLAT-010..013, T-PLAT-025, T-ACT-001, DATA_MODEL.md §2.9–2.10).
//
// These tables carry no product feature: they are the operational shell (activity, audit, rate limits,
// idempotency, outbox, scheduler runs). Every row that belongs to a household is scoped by
// `household_id`; the two that do not (rate limits, scheduler runs) are keyed by opaque, hashed
// values so no PII ever lands in them (PRIVACY.md §5, SECURITY.md §8).

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { household } from './tenancy';

export const activityTypeEnum = pgEnum('activity_type', [
  'HOUSEHOLD_CREATED',
  'HOUSEHOLD_SETTINGS_CHANGED',
  'MEMBER_INVITED',
  'MEMBER_JOINED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_REMOVED',
  'MEMBER_LEFT',
  'ROOM_CREATED',
  'ROOM_UPDATED',
  'ROOM_ARCHIVED',
  'ROOM_OVERRIDE_SET',
  'ROOM_OVERRIDE_EXPIRED',
  'CHORE_CREATED',
  'CHORE_UPDATED',
  'CHORE_PAUSED',
  'CHORE_RESUMED',
  'CHORE_ARCHIVED',
  'CHORE_COMPLETED',
  'CHORE_SKIPPED',
  'CHORE_SNOOZED',
  'CHORE_REASSIGNED',
  'CHORE_REOPENED',
  'TRASH_STATE_CHANGED',
  'TRASH_COLLECTION_ASSIGNED',
  'TRASH_COLLECTION_COMPLETED',
  'RESOURCE_CREATED',
  'RESOURCE_LEVEL_CHANGED',
  'RESOURCE_RESTOCKED',
  'RESOURCE_MODE_CHANGED',
  'SHOPPING_ITEM_ADDED',
  'SHOPPING_ITEM_PURCHASED',
  'ASSET_CREATED',
  'PLAN_CREATED',
  'PLAN_PAUSED',
  'PLAN_RESUMED',
  'SERVICE_RECORDED',
  'ISSUE_REPORTED',
  'ISSUE_ACKNOWLEDGED',
  'ISSUE_PROGRESSED',
  'ISSUE_RESOLVED',
  'ISSUE_CLOSED',
  'ISSUE_COMMENTED',
  'ALERT_ACKNOWLEDGED',
  'ALERT_SNOOZED',
  'ALERT_RESOLVED',
]);

/** Append-only household history (I-ACT-001..006, docs/product/ACTIVITY.md). */
export const activityEvent = pgTable(
  'activity_event',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    actorMemberId: uuid('actor_member_id'),
    type: activityTypeEnum('type').notNull(),
    entityKind: text('entity_kind').notNull(),
    entityId: text('entity_id').notNull(),
    /** Snapshot title so history survives renames (I-ACT-005); never a note or free text body. */
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Readonly<Record<string, string | number>>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    retainUntil: timestamp('retain_until', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_activity_household_time').on(table.householdId, table.occurredAt),
    index('idx_activity_entity').on(table.householdId, table.entityKind, table.entityId, table.occurredAt),
    index('idx_activity_retention').on(table.retainUntil),
    check('ck_activity_summary_length', sql`char_length(${table.summary}) <= 200`),
    check('ck_activity_retained', sql`${table.retainUntil} > ${table.occurredAt}`),
  ],
);

/** Operator-facing security trail (SECURITY.md §11, T-AUTH-008). Separate from household activity. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id'),
    actorUserId: text('actor_user_id'),
    action: text('action').notNull(),
    targetKind: text('target_kind'),
    targetId: text('target_id'),
    outcome: text('outcome').notNull(),
    /** Truncated, hashed network identifier — never a full IP (PRIVACY.md §5). */
    ipHash: text('ip_hash'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    retainUntil: timestamp('retain_until', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_audit_created').on(table.occurredAt),
    index('idx_audit_household_time').on(table.householdId, table.occurredAt),
    check('ck_audit_outcome', sql`${table.outcome} in ('OK', 'DENIED')`),
  ],
);

/** Durable rate limiting (SECURITY.md §8, T-PLAT-025): windows survive restarts and instances. */
export const rateLimitBucket = pgTable(
  'rate_limit_bucket',
  {
    /** sha256(class + scope + window): hashed so no email, ip, or id is stored (PRIVACY.md §5). */
    bucketKey: text('bucket_key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('idx_rate_limit_window').on(table.expiresAt)],
);

/**
 * Idempotency keys (docs/api/CONVENTIONS.md §5): a double-tap or retry replays the original result
 * instead of duplicating a row. Stored per household for 24 h. Added to DATA_MODEL.md §2.10 — the
 * convention names the storage but the entity catalogue did not list it (DECISIONS.md 2026-09-27).
 */
export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    clientRequestId: uuid('client_request_id').notNull(),
    operation: text('operation').notNull(),
    status: text('status').notNull(),
    entityKind: text('entity_kind'),
    entityId: text('entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('uq_idempotency_household_key').on(table.householdId, table.clientRequestId, table.operation),
    index('idx_idempotency_expires').on(table.expiresAt),
    check('ck_idempotency_status', sql`${table.status} in ('COMMITTED', 'IN_FLIGHT', 'FAILED')`),
  ],
);

export const outboxStateEnum = pgEnum('outbox_state', ['PENDING', 'PROCESSING', 'PROCESSED', 'DEAD']);

/** Transactional outbox (ADR-009, T-PLAT-012): enqueued in the same transaction as the state change. */
export const outboxMessage = pgTable(
  'outbox_message',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id'),
    /** Unique so a retried transaction cannot enqueue the same delivery twice (I-XA-007). */
    dedupeKey: text('dedupe_key').notNull(),
    topic: text('topic').notNull(),
    /** Ids and enums only — never titles, notes, or free text (PRIVACY.md §5). */
    payload: jsonb('payload').$type<Readonly<Record<string, string | number>>>().notNull(),
    state: outboxStateEnum('state').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastErrorClass: text('last_error_class'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_outbox_dedupe').on(table.dedupeKey),
    index('idx_outbox_due').on(table.state, table.nextAttemptAt),
    check('ck_outbox_attempts_bounded', sql`${table.attempts} <= 8`),
  ],
);

/** Per-job tick bookkeeping so `/api/health?deep=1` can report staleness (OBSERVABILITY.md §5, T-PLAT-011). */
export const schedulerJobRun = pgTable('scheduler_job_run', {
  job: text('job').primaryKey(),
  lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
  lastSucceededAt: timestamp('last_succeeded_at', { withTimezone: true }),
  lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
  lastErrorClass: text('last_error_class'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  lastDurationMs: integer('last_duration_ms'),
  lastProcessedCount: integer('last_processed_count'),
});

/** Advisory-lock keys are hashed into a bigint; kept here so the mapping is reviewable (ADR-013). */
export const advisoryLockNamespace = 0x484f50; // 'HOP' — HomeOps

export const PLATFORM_TABLES = [
  activityEvent,
  auditLog,
  rateLimitBucket,
  idempotencyKey,
  outboxMessage,
  schedulerJobRun,
] as const;
