/**
 * INTEGRATION TEST - audit/chain.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-SEC-007 · Requirement(s): FR-AUDIT-001
 * Specification: SECURITY.md §9, THREAT_MODEL T-17, drizzle/0002_audit_events.sql
 *
 * Rules for this layer (TESTING.md §1/§2): the invariant is proven against the DATABASE - real rows,
 * real grants, real trigger, real verifier. Nothing here mocks the writer or the chain.
 * Why these behaviours: an audit trail that can be edited is not evidence.
 *
 * Concurrency note (docs/testing/CONCURRENCY-TESTS.md guidance #1/#2): the anti-fork mechanism is
 * asserted by its two deterministic halves - the per-organization advisory lock is demonstrably held
 * while the head is read, and the `(organization_id, chain_position)` unique index demonstrably
 * rejects a second claim on the same position. True multi-connection interleaving needs more than one
 * PostgreSQL session, which the hermetic PGlite harness cannot provide; the same assertions run
 * unchanged against `INTEGRATION_DATABASE_URL` once T-TEST-001 supplies containers.
 *
 * Delivered 2026-09-27 (T-SEC-007).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import "../../support/env";
import { createTestDatabase, TEST_APP_ROLE, type TestDatabase } from "../../support/db";
import { auditEvents } from "@/server/db/schema";
import { computeAuditHash, writeAuditEntry } from "@/server/audit/writer";
import { verifyAuditChain } from "@/server/audit/verify";
import { runAuditVerification } from "@/server/audit/verification-job";

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

/** Every test gets its own tenant: a chain is per organization, so tests stay independent. */
async function newOrganization(slug: string): Promise<string> {
  const rows = await harness.query<{ id: string }>(
    "INSERT INTO organizations (slug, name) VALUES ($1, $2) RETURNING id",
    [slug, `Organisasi ${slug}`],
  );
  return rows[0]!.id;
}

function entryFor(organizationId: string, actionKey: string) {
  return {
    organizationId,
    actionKey,
    scopeKind: "ORG",
    actorUserId: "user-organizer",
    actorRole: "ORGANIZER",
    targetType: "event",
    targetId: "55555555-5555-7555-8555-555555555555",
    reason: "Alasan tercatat untuk audit",
    requestId: "req-chain-test",
  };
}

/**
 * Deliberate tampering through the repair switch documented in drizzle/0002_audit_events.sql. It needs a
 * role that already holds UPDATE - which `majelishub_app` does not - so this path is unreachable from the
 * application; it stands for an attacker who owns the database host.
 */
async function tamper(sqlText: string): Promise<void> {
  await harness.exec(
    `BEGIN; SELECT set_config('majelishub.allow_audit_rewrite', 'on', true); ${sqlText} COMMIT;`,
  );
}

/**
 * Runs `sqlText` as the application role. Role and RLS variables are session-scoped and reset
 * afterwards, so a statement that fails on permissions cannot poison the harness session.
 */
async function asAppRole(sqlText: string): Promise<void> {
  await harness.exec(
    `SELECT set_config('app.organization_id', '00000000-0000-0000-0000-000000000000', false);
     SELECT set_config('app.scope', 'ORG', false);
     SELECT set_config('app.user_id', 'user-organizer', false);
     SET ROLE ${TEST_APP_ROLE};`,
  );
  try {
    await harness.exec(sqlText);
  } finally {
    await harness.exec(
      `RESET ROLE;
       SELECT set_config('app.organization_id', '', false);
       SELECT set_config('app.scope', '', false);`,
    );
  }
}

describe("audit chain", () => {
  test("verifies a chain and reports the first broken position", async () => {
    const organizationId = await newOrganization("chain-verifies");
    for (let index = 1; index <= 5; index += 1) {
      await writeAuditEntry(entryFor(organizationId, `audit.read.${index}`), harness.db);
    }

    const clean = await verifyAuditChain(harness.db, organizationId);
    expect(clean).toEqual({ organizationId, ok: true, entries: 5 });

    // Edit the third entry's justification - the oldest classic tamper. The chain must name position 3,
    // not merely report that something is wrong.
    await tamper(
      `UPDATE audit_events SET reason = 'alasan yang sudah diganti'
        WHERE organization_id = '${organizationId}' AND chain_position = 3;`,
    );

    const afterEdit = await verifyAuditChain(harness.db, organizationId);
    expect(afterEdit.ok).toBe(false);
    expect(afterEdit.brokenAtPosition).toBe(3);
    expect(afterEdit.reason).toContain("stored hash does not match");
    expect(afterEdit.entries).toBe(5);
  });

  test("detects a row edited directly in the database", async () => {
    const organizationId = await newOrganization("chain-edited-row");
    const first = await writeAuditEntry(entryFor(organizationId, "attendance.correct"), harness.db);
    const second = await writeAuditEntry(entryFor(organizationId, "checkin.correct"), harness.db);

    // The editor changes the recorded actor AND rewrites the hash column, so the row is internally
    // self-consistent. Recomputation from the content still disagrees, and the next entry still links to
    // the original hash - so the forgery cannot be hidden by editing one row.
    await tamper(
      `UPDATE audit_events
          SET actor_user_id = 'user-lain',
              hash = '${"b".repeat(64)}'
        WHERE organization_id = '${organizationId}' AND chain_position = 1;`,
    );

    const rows = await harness.query<{ hash: string; prevHash: string | null }>(
      'SELECT hash, prev_hash AS "prevHash" FROM audit_events WHERE organization_id = $1 ORDER BY chain_position',
      [organizationId],
    );
    expect(rows[0]!.hash).toBe("b".repeat(64));
    expect(rows[0]!.hash).not.toBe(first.hash);
    expect(rows[1]!.prevHash).toBe(first.hash);

    const report = await verifyAuditChain(harness.db, organizationId);
    expect(report.ok).toBe(false);
    expect(report.brokenAtPosition).toBe(1);

    // The verifier is not simply "broken forever": an untouched entry still recomputes to its own hash.
    const recomputed = computeAuditHash({
      input: { ...entryFor(organizationId, "checkin.correct"), occurredAt: new Date(second.occurredAt) },
      chainPosition: second.chainPosition,
      prevHash: second.prevHash,
      occurredAt: new Date(second.occurredAt),
    });
    expect(recomputed).toBe(second.hash);
  });

  test("refuses an UPDATE, DELETE or TRUNCATE attempt from the application role", async () => {
    const organizationId = await newOrganization("chain-append-only");
    await writeAuditEntry(entryFor(organizationId, "audit.read"), harness.db);

    await expect(
      asAppRole(`UPDATE audit_events SET reason = 'diubah dari aplikasi' WHERE organization_id = '${organizationId}';`),
    ).rejects.toThrow(/permission denied for table audit_events/);

    await expect(
      asAppRole(`DELETE FROM audit_events WHERE organization_id = '${organizationId}';`),
    ).rejects.toThrow(/permission denied for table audit_events/);

    await expect(asAppRole("TRUNCATE audit_events;")).rejects.toThrow(
      /permission denied for table audit_events/,
    );

    // The rows survived, and the two granted verbs still work for the application role.
    const remaining = await harness.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM audit_events WHERE organization_id = $1",
      [organizationId],
    );
    expect(remaining[0]!.n).toBe("1");
  });

  test("refuses an UPDATE without the documented repair switch, even for the table owner", async () => {
    const organizationId = await newOrganization("chain-trigger");
    await writeAuditEntry(entryFor(organizationId, "audit.read"), harness.db);

    await expect(
      harness.exec(
        `UPDATE audit_events SET reason = 'tanpa sakelar perbaikan' WHERE organization_id = '${organizationId}';`,
      ),
    ).rejects.toThrow(/append-only/);

    await expect(
      harness.exec(`DELETE FROM audit_events WHERE organization_id = '${organizationId}';`),
    ).rejects.toThrow(/append-only/);
  });

  test("appends without forking: held lock, contiguous positions, and a unique-index backstop", async () => {
    const organizationId = await newOrganization("chain-concurrent");

    // The writer must hold the per-organization advisory lock while it reads the chain head - that is the
    // serialisation that keeps two writers from claiming the same position.
    await harness.db.transaction(async (tx) => {
      await writeAuditEntry(entryFor(organizationId, "audit.read.locked"), tx);
      const locks = (await tx.execute(
        sql`SELECT count(*)::text AS n FROM pg_locks WHERE locktype = 'advisory'`,
      )) as { rows: { n: string }[] };
      expect(Number(locks.rows[0]?.n ?? "0"), "the per-organization advisory lock is not held").toBeGreaterThanOrEqual(1);
    });

    for (let index = 2; index <= 8; index += 1) {
      await harness.db.transaction((tx) => writeAuditEntry(entryFor(organizationId, `audit.read.${index}`), tx));
    }

    const rows = await harness.query<{ position: string }>(
      "SELECT chain_position::text AS position FROM audit_events WHERE organization_id = $1 ORDER BY chain_position",
      [organizationId],
    );
    expect(rows.map((row) => row.position)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);

    const report = await verifyAuditChain(harness.db, organizationId);
    expect(report).toEqual({ organizationId, ok: true, entries: 8 });

    // The database-level backstop: even a code path that bypasses the writer cannot claim a position
    // twice (CONCURRENCY-TESTS.md writing guidance #4).
    // Drizzle wraps driver errors (`DrizzleQueryError`), so the constraint is read off `.cause`.
    let forkError: unknown;
    try {
      await harness.db.insert(auditEvents).values({
        organizationId,
        chainPosition: 4,
        actionKey: "audit.read.forked",
        scopeKind: "ORG",
        prevHash: "0".repeat(64),
        hash: "a".repeat(64),
      });
    } catch (error) {
      forkError = error;
    }
    expect(String((forkError as { cause?: unknown } | undefined)?.cause ?? forkError)).toContain(
      'duplicate key value violates unique constraint "audit_events_org_position_unique"',
    );

    // A gap is equally impossible to hide: the verifier names the missing position.
    await tamper(
      `DELETE FROM audit_events WHERE organization_id = '${organizationId}' AND chain_position = 4;`,
    );
    const afterGap = await verifyAuditChain(harness.db, organizationId);
    expect(afterGap.ok).toBe(false);
    expect(afterGap.brokenAtPosition).toBe(4);
    expect(afterGap.reason).toContain("expected position 4, found 5");
  });

  test("the verification sweep reports only the broken partition", async () => {
    const healthy = await newOrganization("chain-sweep-healthy");
    const damaged = await newOrganization("chain-sweep-damaged");
    await writeAuditEntry(entryFor(healthy, "audit.read"), harness.db);
    await writeAuditEntry(entryFor(damaged, "audit.read"), harness.db);
    await writeAuditEntry(entryFor(damaged, "audit.export"), harness.db);

    const before = await runAuditVerification(harness.db, { organizationIds: [healthy, damaged] });
    expect(before).toEqual({ checked: 2, broken: [] });

    await tamper(
      `UPDATE audit_events SET actor_user_id = 'user-penyusup'
        WHERE organization_id = '${damaged}' AND chain_position = 2;`,
    );

    const after = await runAuditVerification(harness.db, { organizationIds: [healthy, damaged] });
    expect(after.checked).toBe(2);
    expect(after.broken.map((report) => report.organizationId)).toEqual([damaged]);
    expect(after.broken[0]).toMatchObject({ ok: false, brokenAtPosition: 2 });
  });
});
