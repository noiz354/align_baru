/**
 * Events schema — one occurrence (kajian).
 * Where this belongs: server/db/schema. Contract: DATA_MODEL.md §4 `kajian_events`.
 * Task ownership: T-EVENT-001 (lifecycle) — narrow vertical for MajelisHub wave2.
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { mosques, organizations } from "./tenancy";

export const kajianEvents = pgTable(
  "kajian_events",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    mosqueId: uuid("mosque_id")
      .notNull()
      .references(() => mosques.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("DRAFT"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("kajian_events_org_slug_unique").on(t.organizationId, t.slug),
    index("kajian_events_org_starts_idx").on(t.organizationId, t.startsAt),
    index("kajian_events_mosque_idx").on(t.mosqueId),
    index("kajian_events_status_idx").on(t.status),
  ],
);

export type KajianEventRow = typeof kajianEvents.$inferSelect;
