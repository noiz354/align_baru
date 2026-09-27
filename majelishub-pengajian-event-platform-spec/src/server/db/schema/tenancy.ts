/**
 * Tenancy schema - the tenant, its members/roles, and the first scoped aggregate (mosques).
 *
 * Where this belongs: `server/db/schema`. Contract: DATA_MODEL.md §1 (`organizations`,
 * `organization_members`) and §2 (`mosques`); ADR-0017 (shared schema, `organization_id` on every
 * scoped table, composite FKs so a cross-tenant reference is impossible).
 *
 * Scope note (why this file exists in T-SEC-001 and not only in T-ORG-002/T-MOSQUE-001): tenant
 * isolation cannot be implemented or tested without the tables it protects. Only the columns the
 * isolation and identity work needs are declared here. The organizer-facing CRUD, role-assignment and
 * invitation flows remain T-ORG-002/T-ORG-003; mosque address, coordinates, venues, facilities and
 * contacts remain T-MOSQUE-001/T-MOSQUE-002.
 *
 * Task ownership: T-SEC-001 (scope + RLS), T-ORG-001 (identity).
 */
import { sql } from "drizzle-orm";
import { boolean, check, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";

/** DATA_MODEL §1 `organizations.kind`. */
export const organizationKind = pgEnum("organization_kind", ["MOSQUE", "COMMUNITY", "FOUNDATION", "OTHER"]);

/** DATA_MODEL §2 `mosques.kind`. */
export const mosqueKind = pgEnum("mosque_kind", ["MASJID", "MUSHOLLA", "SURAU", "HALL", "CAMPUS", "OFFICE", "OTHER"]);

/** `organization_members.status` (DATA_MODEL §1: invited -> active -> removed). */
export const membershipStatus = pgEnum("membership_status", ["INVITED", "ACTIVE", "REMOVED"]);

/**
 * Role keys come from the shared contract so the database CHECK constraint and the authorization
 * matrix cannot drift apart (`docs/security/AUTHZ-MATRIX.md` §1, T-SEC-002).
 */
export { ROLE_KEYS, type RoleKey } from "@/shared/contracts/permissions";
import { ROLE_KEYS } from "@/shared/contracts/permissions";

/** The tenant. Every scoped row points here (ADR-0017). */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: organizationKind("kind").notNull().default("MOSQUE"),
    /** IANA name; validated against the catalogue in the application layer (ADR-0018). */
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organizations_slug_unique").on(t.slug),
    index("organizations_is_published_idx").on(t.isPublished),
  ],
);

/**
 * Membership + roles. One row per (organization, user) with a role array, optionally limited to a
 * subset of mosques (FR-ORG-005).
 */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roles: text("roles").array().notNull(),
    /** Empty/NULL = whole organization; otherwise the membership is limited to these mosques. */
    mosqueIds: uuid("mosque_ids").array(),
    status: membershipStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_unique").on(t.organizationId, t.userId),
    index("organization_members_user_id_idx").on(t.userId),
    check("organization_members_has_role", sql`cardinality(${t.roles}) >= 1`),
    check(
      "organization_members_roles_known",
      sql`${t.roles} <@ ARRAY[${sql.raw(ROLE_KEYS.map((k) => `'${k}'`).join(", "))}]::text[]`,
    ),
  ],
);

/**
 * A place of worship / community site. The first tenant-scoped aggregate, and the table the isolation
 * suite uses to prove both enforcement layers.
 */
export const mosques = pgTable(
  "mosques",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: mosqueKind("kind").notNull().default("MASJID"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mosques_org_slug_unique").on(t.organizationId, t.slug),
    // Composite FK target for child tables (DATA_MODEL §11.13): a child can only reference a mosque
    // inside its own organization.
    uniqueIndex("mosques_id_org_unique").on(t.id, t.organizationId),
    index("mosques_organization_id_idx").on(t.organizationId),
    index("mosques_is_active_idx").on(t.isActive),
  ],
);
