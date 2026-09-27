/**
 * INTEGRATION TEST - audit/coverage.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-SEC-007 · Requirement(s): FR-AUDIT-002
 * Specification: docs/security/AUTHZ-MATRIX.md §4.5, SECURITY.md §12, TASKS.md T-SEC-007
 *
 * Rules for this layer (TESTING.md §1/§2): the invariant is proven against the DATABASE - the entries are
 * read back from `audit_events`, not from the buffer that produced them.
 * Why these behaviours: reason-required actions are exactly the ones that must be explainable later, and
 * an audit write that can fail silently turns every one of them into an unexplainable action.
 *
 * Delivered 2026-09-27 (T-SEC-007).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { organizationMembers, users } from "@/server/db/schema";
import { eq, count } from "drizzle-orm";
import { requirePermission, AUTHORIZATION_MATRIX, grantForRole } from "@/server/auth/permissions";
import { createAuditEventBuffer } from "@/server/audit/sink";
import { writeAuditEntry } from "@/server/audit/writer";
import { verifyAuditChain } from "@/server/audit/verify";
import { REASON_REQUIRED_PERMISSIONS, ROLE_KEYS, type PermissionKey, type RoleKey } from "@/shared/contracts/permissions";
import { organizationScope, platformScope } from "@/shared/contracts/scope";
import { AppError } from "@/shared/contracts/errors";

const ACTOR = "user-organizer";
const AUTHOR = "user-author-lain";
const MOSQUE = "33333333-3333-7333-8333-333333333333";
const EVENT = "55555555-5555-7555-8555-555555555555";
const OTHER_ORG = "22222222-2222-7222-8222-222222222222";
const FOREIGN_MOSQUE = "44444444-4444-7444-8444-444444444444";
const REASON = "Perlu diekspor untuk laporan panitia";

let harness: TestDatabase;
let organizationId: string;

beforeAll(async () => {
  harness = await createTestDatabase();
  const rows = await harness.query<{ id: string }>(
    "INSERT INTO organizations (slug, name) VALUES ('audit-coverage', 'Audit Coverage') RETURNING id",
  );
  organizationId = rows[0]!.id;
});

afterAll(async () => {
  await harness.close();
});

/**
 * The role that holds a key with the documented reason requirement, preferring the explicit
 * `ALLOW_WITH_REASON` cell over a role that merely holds the key (AUTHZ-MATRIX §4.5: the contract list
 * applies to every role, so both shapes must produce a stored reason).
 */
function roleFor(key: PermissionKey): RoleKey {
  const withReason = ROLE_KEYS.find((role) => grantForRole(role, key) === "ALLOW_WITH_REASON");
  if (withReason) return withReason;
  const holder = ROLE_KEYS.find((role) => grantForRole(role, key) !== undefined);
  if (!holder) throw new Error(`No role holds ${key}`);
  return holder;
}

function contextFor(key: PermissionKey, audit: { push(event: never): void }) {
  const role = roleFor(key);
  return {
    actor: {
      userId: ACTOR,
      roles: [role],
      scope: role === "PLATFORM_ADMIN" ? platformScope(organizationId) : organizationScope(organizationId),
    },
    permission: key,
    scopeKind: "ORG" as const,
    // ownerId == actor satisfies ALLOW_OWN cells; subjectOwnerId != actor satisfies separation of duties.
    resource: { organizationId, mosqueId: MOSQUE, eventId: EVENT, ownerId: ACTOR },
    reason: REASON,
    subjectOwnerId: AUTHOR,
    requestedRoles: ["VOLUNTEER"],
    audit,
    role,
  };
}

interface AuditRow {
  chainPosition: number;
  actionKey: string;
  scopeKind: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
}

async function rowsFor(orgId: string): Promise<AuditRow[]> {
  return harness.query<AuditRow>(
    `SELECT chain_position AS "chainPosition", action_key AS "actionKey", scope_kind AS "scopeKind",
            actor_user_id AS "actorUserId", actor_role AS "actorRole", target_type AS "targetType",
            target_id AS "targetId", reason, request_id AS "requestId"
       FROM audit_events WHERE organization_id = $1 ORDER BY chain_position`,
    [orgId],
  );
}

describe("audit coverage", () => {
  test("writes an entry for every reason-required permission", async () => {
    const buffer = createAuditEventBuffer();

    for (const key of REASON_REQUIRED_PERMISSIONS) {
      const { role: _role, ...context } = contextFor(key, buffer as never);
      // Must not throw: every reason-required key is held by somebody with a valid reason supplied.
      requirePermission(context);
    }
    expect(buffer.events.length, "one reason-recorded event per key").toBe(REASON_REQUIRED_PERMISSIONS.length);

    const written = await harness.db.transaction((tx) => buffer.flush(tx));
    expect(written.length).toBe(REASON_REQUIRED_PERMISSIONS.length);

    const rows = await rowsFor(organizationId);
    expect(rows.map((row) => row.actionKey).sort()).toEqual([...REASON_REQUIRED_PERMISSIONS].sort());
    // The reason is stored verbatim for every one of them - that is the whole point of the requirement.
    for (const row of rows) {
      expect(row.reason, `${row.actionKey} stored without a reason`).toBe(REASON);
      expect(row.targetId).toBe("GRANTED_WITH_REASON");
    }
    // Positions are contiguous from 1: coverage gaps would show up as a broken chain.
    expect(rows.map((row) => row.chainPosition)).toEqual(rows.map((_, index) => index + 1));
    expect(await verifyAuditChain(harness.db, organizationId)).toMatchObject({
      ok: true,
      entries: REASON_REQUIRED_PERMISSIONS.length,
    });
  });

  test("records actor, scope, target and reason without content", async () => {
    const buffer = createAuditEventBuffer();
    const { role } = contextFor("audit.export", buffer as never);

    // A grant, and a refusal of a foreign tenant's resource. Both must be auditable; neither may carry
    // the foreign tenant's identifiers.
    requirePermission(contextFor("audit.export", buffer as never));
    expect(() =>
      requirePermission({
        actor: { userId: ACTOR, roles: [role], scope: organizationScope(organizationId) },
        permission: "event.read",
        scopeKind: "ORG",
        resource: { organizationId: OTHER_ORG, mosqueId: FOREIGN_MOSQUE, eventId: EVENT },
        audit: buffer as never,
      }),
    ).toThrow(AppError);

    await harness.db.transaction((tx) => buffer.flush(tx));

    const rows = await rowsFor(organizationId);
    const granted = rows.find((row) => row.actionKey === "audit.export" && row.targetId === "GRANTED_WITH_REASON");
    const denied = rows.find((row) => row.targetId === "DENIED_CROSS_ORGANIZATION");

    expect(granted).toMatchObject({
      actorUserId: ACTOR,
      actorRole: role,
      scopeKind: "ORG",
      targetType: "authorization",
      reason: REASON,
    });
    expect(denied).toBeDefined();
    expect(denied!.actorUserId).toBe(ACTOR);
    expect(denied!.reason, "a denial has no operator justification to store").toBeNull();
    // The audited fact is the OUTCOME, not the object that was refused: no foreign identifier anywhere.
    for (const row of [granted, denied]) {
      for (const value of Object.values(row as unknown as Record<string, unknown>)) {
        expect(String(value ?? "")).not.toContain(OTHER_ORG);
        expect(String(value ?? "")).not.toContain(FOREIGN_MOSQUE);
      }
    }
  });

  test("fails closed when an audit write fails for a security-relevant action", async () => {
    // The security-relevant action: granting a role. The audit entry for it cannot be written (the
    // justification is shorter than the contract minimum), so the grant itself must not survive.
    await expect(
      harness.db.transaction(async (tx) => {
        await tx.insert(users).values({ id: "user-relawan", name: "Relawan Baru", email: "relawan@example.org" });
        await tx.insert(organizationMembers).values({
          organizationId,
          userId: "user-relawan",
          roles: ["VOLUNTEER"],
        });
        await writeAuditEntry(
          {
            organizationId,
            actionKey: "member.manage",
            scopeKind: "ORG",
            actorUserId: ACTOR,
            actorRole: "ORGANIZER",
            targetType: "member",
            targetId: "user-relawan",
            reason: "pendek",
          },
          tx,
        );
      }),
    ).rejects.toSatisfy((error: unknown) =>
      // Drizzle wraps driver errors (`DrizzleQueryError`); the constraint name is on `.cause`.
      String((error as { cause?: unknown } | undefined)?.cause ?? error).includes("audit_events_reason_length"),
    );

    const survivingGrants = await harness.db
      .select({ n: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, "user-relawan"));
    expect(survivingGrants[0]!.n, "the role grant survived a failed audit write").toBe(0);

    const survivingUsers = await harness.db.select({ n: count() }).from(users).where(eq(users.id, "user-relawan"));
    expect(survivingUsers[0]!.n).toBe(0);

    // The chain itself is untouched: a failed append leaves no partial entry behind.
    expect(await verifyAuditChain(harness.db, organizationId)).toMatchObject({ ok: true });
  });

  test("every matrix row that requires a reason names a role that can produce one", () => {
    // Guards the coverage test above against silently shrinking: if a reason-required key lost every
    // role, the loop would still pass while proving nothing.
    for (const key of REASON_REQUIRED_PERMISSIONS) {
      const holders = ROLE_KEYS.filter((role) => grantForRole(role, key) !== undefined);
      expect(holders.length, `${key} reachable by no role`).toBeGreaterThan(0);
      expect(AUTHORIZATION_MATRIX.some((row) => row.key === key)).toBe(true);
    }
  });
});
