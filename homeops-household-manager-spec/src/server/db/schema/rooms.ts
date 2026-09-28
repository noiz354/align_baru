// HomeOps — rooms schema (T-ROOM-001, DATA_MODEL.md §2.3). Wave2 narrow vertical: room list for Today.

import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { household } from './tenancy';

export const room = pgTable(
  'room',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    groupLabel: text('group_label'),
    sortOrder: integer('sort_order').notNull().default(0),
    notInUse: boolean('not_in_use').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_room_household').on(table.householdId),
    index('idx_room_household_name').on(table.householdId, table.name),
  ],
);

export const ROOM_TABLES = [room] as const;
