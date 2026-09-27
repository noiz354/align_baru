/**
 * INTEGRATION TEST - auth/session-repository.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-ORG-001 · Requirement(s): NFR-SEC-001, NFR-SEC-002
 * Specification: SECURITY.md §2 (session rules) and §10 (revocation is one action), RETENTION.md
 *   (sessions 30 days), DATA_MODEL.md §1
 *
 * Why these behaviours: "a restart does not log anyone out" and "revocation takes effect immediately"
 * are statements about rows, not about code. They are asserted here against the committed migration.
 *
 * Fixtures are synthetic (docs/testing/TEST-DATA.md); no real person appears in any row.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
  deleteExpiredSessions,
  deleteSessionById,
  findSessionById,
  listSessionsForUser,
} from "@/server/db/repositories/sessions";
import { createTestDatabase, type TestDatabaseHandle } from "../../support/database";

let handle: TestDatabaseHandle;
let database: TestDatabaseHandle["database"];

const USER_ID = crypto.randomUUID();
const OTHER_USER_ID = crypto.randomUUID();
/** Synthetic fixture: not a real address, and never contacted. */
const EMAIL = "panitia.alfalah@example.test";

const T0 = "2026-09-27T02:00:00.000Z";

async function seedUsers(): Promise<void> {
  await database.execute(sql`
    INSERT INTO users (id, name, email, created_at, updated_at)
    VALUES
      (${USER_ID}::uuid, ${"Panitia Al-Falah"}, ${EMAIL}, ${T0}::timestamptz, ${T0}::timestamptz),
      (${OTHER_USER_ID}::uuid, ${"Panitia Baiturrahman"}, ${"panitia.baiturrahman@example.test"},
       ${T0}::timestamptz, ${T0}::timestamptz)
  `);
}

async function seedSession(
  userId: string,
  options: { updatedAt?: string; expiresAt?: string; userAgent?: string } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await database.execute(sql`
    INSERT INTO sessions (id, user_id, token, expires_at, user_agent, created_at, updated_at)
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      ${`tok_${id}`},
      ${options.expiresAt ?? "2026-09-27T10:00:00.000Z"}::timestamptz,
      ${options.userAgent ?? "Mozilla/5.0 (test fixture)"},
      ${T0}::timestamptz,
      ${options.updatedAt ?? T0}::timestamptz
    )
  `);
  return id;
}

beforeAll(async () => {
  handle = await createTestDatabase();
  database = handle.database;
});

afterAll(async () => {
  await handle?.close();
});

beforeEach(async () => {
  await database.execute(sql`DELETE FROM sessions`);
  await database.execute(sql`DELETE FROM users`);
  await seedUsers();
});

/**
 * Drizzle wraps driver errors, so the constraint name lives on `cause`. Both shapes are read because
 * the point of the assertion is the constraint, not the wrapper.
 */
async function constraintOf(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    const wrapped = (error as { cause?: { constraint?: string } })?.cause;
    return wrapped?.constraint ?? (error as { constraint?: string })?.constraint;
  }
  return undefined;
}

describe("session store (T-ORG-001)", () => {
  test("finds a session by id and returns null rather than throwing when there is none", async () => {
    const sessionId = await seedSession(USER_ID);

    const found = await findSessionById(database, sessionId);
    expect(found?.id).toBe(sessionId);
    expect(found?.userId).toBe(USER_ID);

    expect(await findSessionById(database, crypto.randomUUID())).toBeNull();
  });

  test("lists one user's sessions newest first and never another user's", async () => {
    const older = await seedSession(USER_ID, { updatedAt: T0 });
    const newer = await seedSession(USER_ID, {
      updatedAt: "2026-09-27T03:00:00.000Z",
      userAgent: "Mozilla/5.0 (phone)",
    });
    await seedSession(OTHER_USER_ID, { updatedAt: "2026-09-27T04:00:00.000Z" });

    const sessions = await listSessionsForUser(database, USER_ID);

    expect(sessions.map((session) => session.id)).toEqual([newer, older]);
    expect(sessions.every((session) => session.userId === USER_ID)).toBe(true);
    expect(sessions[0]?.userAgent).toBe("Mozilla/5.0 (phone)");
  });

  test("revoking deletes the row, so the session cannot authenticate again", async () => {
    const sessionId = await seedSession(USER_ID);

    expect(await deleteSessionById(database, sessionId)).toBe(true);
    expect(await findSessionById(database, sessionId)).toBeNull();
  });

  test("revoking an already-revoked session reports false instead of an error", async () => {
    const sessionId = await seedSession(USER_ID);
    await deleteSessionById(database, sessionId);

    expect(await deleteSessionById(database, sessionId)).toBe(false);
  });

  test("removes only expired sessions, keeping live ones", async () => {
    const expired = await seedSession(USER_ID, { expiresAt: "2026-09-27T02:30:00.000Z" });
    const live = await seedSession(USER_ID, { expiresAt: "2026-09-27T10:00:00.000Z" });

    const deleted = await deleteExpiredSessions(database, new Date("2026-09-27T03:00:00.000Z"));

    expect(deleted).toBe(1);
    expect(await findSessionById(database, expired)).toBeNull();
    expect((await findSessionById(database, live))?.id).toBe(live);
  });

  test("a session cannot outlive its user", async () => {
    const sessionId = await seedSession(USER_ID);
    await database.execute(sql`DELETE FROM users WHERE id = ${USER_ID}::uuid`);

    expect(await findSessionById(database, sessionId)).toBeNull();
  });

  test("rejects a malformed email at the database boundary, not only in the application", async () => {
    const constraint = await constraintOf(
      database.execute(sql`
        INSERT INTO users (id, name, email, created_at, updated_at)
        VALUES (${crypto.randomUUID()}::uuid, ${"Tanpa Email"}, ${"not-an-email"},
                ${T0}::timestamptz, ${T0}::timestamptz)
      `),
    );

    expect(constraint).toBe("users_email_shape");
  });

  test("refuses a block that carries no reason", async () => {
    const constraint = await constraintOf(
      database.execute(sql`
        UPDATE users SET blocked_until = ${"2026-10-27T00:00:00.000Z"}::timestamptz
        WHERE id = ${USER_ID}::uuid
      `),
    );

    expect(constraint).toBe("users_blocked_reason_present");
  });
});
