/**
 * Audit schema - the append-only, tamper-evident record of security-relevant actions.
 *
 * Where this belongs: `server/db/schema`. Feature code never queries this table directly; it goes
 * through `src/server/audit/writer.ts` (the only writer) and `src/server/audit/verify.ts`.
 * Specification: SECURITY.md §9, FR-AUDIT-001..005, RETENTION.md (audit retained 7 years),
 *   TASKS.md T-SEC-007, docs/security/AUTHZ-MATRIX.md §4.5 (reason-required actions).
 *
 * Invariants encoded here (and proved by tests/integration/audit/chain.test.ts):
 *   1. Append-only: the application role holds only SELECT and INSERT (grants in
 *      `drizzle/0002_audit_events.sql`), and a trigger refuses UPDATE/DELETE for everyone else unless a
 *      session explicitly sets the documented repair switch.
 *   2. Tamper-evident: `hash` covers the entry's own content AND `prev_hash`, and
 *      `(organization_id, chain_position)` is unique, so a gap, a reorder or an edit is detectable in
 *      linear time.
 *   3. No content: only identifiers and metadata. `reason` is the operator's own justification
 *      (SECURITY.md §12 requires it to be stored); a token, contact or transcript value never belongs
 *      here, and the shared ban list keeps those names out of every telemetry surface (T-SEC-004).
 *   4. A reason, when present, is at least 8 characters (AUTHZ-MATRIX `✓*`).
 *
 * Privacy: audit data reveals who acted, so access is narrow (RLS below) and its retention is
 * documented (RETENTION.md).
 *
 * Task ownership: T-SEC-007.
 */
import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    /** Partition the chain is scoped to; one chain per organization (no cross-tenant ordering). */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    /** 1-based position in the organization's chain. Gaps and duplicates are both detectable. */
    chainPosition: bigint("chain_position", { mode: "number" }).notNull(),
    /** Permission key (`AUTHORIZATION_MATRIX`) or a documented system action. */
    actionKey: text("action_key").notNull(),
    /** PLATFORM | ORG | MOSQUE | EVENT | OWN. */
    scopeKind: text("scope_kind").notNull(),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    /** Entity type only ("mosque", "transcript"); never another tenant's identifier by accident. */
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** Operator's own justification for a reason-required action (>= 8 characters). */
    reason: text("reason"),
    /** Correlation id, so an audit entry can be tied to telemetry without adding personal data. */
    requestId: text("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** Hash of the previous entry in this partition; NULL for the first entry. */
    prevHash: text("prev_hash"),
    /** sha256 over the canonical payload of this entry, including `prev_hash`. */
    hash: text("hash").notNull(),
  },
  (t) => [
    uniqueIndex("audit_events_org_position_unique").on(t.organizationId, t.chainPosition),
    index("audit_events_org_occurred_idx").on(t.organizationId, t.occurredAt),
    index("audit_events_org_action_idx").on(t.organizationId, t.actionKey),
    check("audit_events_hash_shape", sql`${t.hash} ~ '^[0-9a-f]{64}$'`),
    check("audit_events_prev_hash_shape", sql`${t.prevHash} IS NULL OR ${t.prevHash} ~ '^[0-9a-f]{64}$'`),
    check("audit_events_position_positive", sql`${t.chainPosition} > 0`),
    check("audit_events_reason_length", sql`${t.reason} IS NULL OR char_length(${t.reason}) >= 8`),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
