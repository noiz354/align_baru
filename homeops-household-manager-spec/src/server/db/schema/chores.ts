// HomeOps — chores schema (T-CHORE-001, DATA_MODEL.md §2.4). Wave2 narrow vertical: definition + occurrence + Today/complete.

import { sql } from 'drizzle-orm';
import { date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { household, householdMember } from './tenancy';
import { room } from './rooms';

export const chorePriorityEnum = pgEnum('chore_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const occurrenceStatusEnum = pgEnum('occurrence_status', ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'SNOOZED']);

export const choreDefinition = pgTable(
  'chore_definition',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    roomId: uuid('room_id').references(() => room.id, { onDelete: 'set null' }),
    assigneeMemberId: uuid('assignee_member_id').references(() => householdMember.id, { onDelete: 'set null' }),
    priority: chorePriorityEnum('priority').notNull().default('MEDIUM'),
    recurrenceKind: text('recurrence_kind').notNull().default('NONE'),
    estimatedMinutes: integer('estimated_minutes'),
    notes: text('notes'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_chore_def_household').on(table.householdId),
    index('idx_chore_def_room').on(table.roomId),
  ],
);

export const choreOccurrence = pgTable(
  'chore_occurrence',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    definitionId: uuid('definition_id').references(() => choreDefinition.id, { onDelete: 'set null' }),
    occurrenceKey: text('occurrence_key').notNull(),
    source: text('source').notNull().default('DEFINITION'),
    titleSnapshot: text('title_snapshot').notNull(),
    roomIdSnapshot: uuid('room_id_snapshot').references(() => room.id, { onDelete: 'set null' }),
    dueOn: date('due_on').notNull(),
    status: occurrenceStatusEnum('status').notNull().default('OPEN'),
    assigneeMemberId: uuid('assignee_member_id').references(() => householdMember.id, { onDelete: 'set null' }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByMemberId: uuid('completed_by_member_id').references(() => householdMember.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_occurrence_household_key').on(table.householdId, table.occurrenceKey),
    index('idx_occurrence_household_due').on(table.householdId, table.dueOn),
    index('idx_occurrence_household_status').on(table.householdId, table.status),
    index('idx_occurrence_household_room').on(table.householdId, table.roomIdSnapshot),
  ],
);

export const CHORE_TABLES = [choreDefinition, choreOccurrence] as const;
