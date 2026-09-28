/**
 * Registrations & Attendance schema — Wave3 attendee slice.
 * Tables: event_registrations (capability token) + event_attendance (idempotent check-in).
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { kajianEvents } from "./events";

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => kajianEvents.id, { onDelete: "cascade" }),
    attendeeEmail: text("attendee_email").notNull(),
    attendeeName: text("attendee_name").notNull(),
    status: text("status").notNull().default("REGISTERED"),
    tokenHash: text("token_hash").notNull(),
    shortCode: text("short_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_registrations_token_hash_unique").on(t.tokenHash),
    uniqueIndex("event_registrations_short_code_unique").on(t.shortCode),
    uniqueIndex("event_registrations_event_email_unique").on(t.eventId, t.attendeeEmail),
    index("event_registrations_org_idx").on(t.organizationId),
    index("event_registrations_event_idx").on(t.eventId),
  ],
);

export const eventAttendance = pgTable(
  "event_attendance",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => kajianEvents.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrations.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInBy: text("checked_in_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_attendance_registration_unique").on(t.registrationId),
    index("event_attendance_org_event_idx").on(t.organizationId, t.eventId),
    index("event_attendance_event_idx").on(t.eventId),
  ],
);
