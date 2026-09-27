/**
 * INTEGRATION TEST - security/session-revocation.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-ORG-001 · Requirement(s): NFR-SEC-001, NFR-SEC-002
 * Specification: SECURITY.md §2/§10/§12, ADR-0005
 *
 * What is proved here: a session is a database row, revocation deletes it (so it ends on the next
 * request), the action demands an actor and a reason of at least 8 characters, and an unknown session id
 * is NOT_FOUND rather than a confirmation that it never existed.
 *
 * Not covered here (documented in TASKS.md T-ORG-001 as a deferral): the full sign-in -> cookie ->
 * `getSession()` round trip needs a running identity instance over a real PostgreSQL server, which is a
 * QA-07/manual step and part of T-TEST-001's composed-stack harness.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { sessions, users } from "@/server/db/schema";
import { revokeSession } from "@/server/auth/session";
import { setSecurityEventSink, type SecurityEvent } from "@/server/auth/authorization-events";
import { AppError, ErrorCode } from "@/shared/contracts/errors";

const USER_ID = "user-organizer-1";
const SESSION_ID = "session-1";
const SESSION_TOKEN = "session-token-value-that-must-never-be-logged";
const ACTOR = { actorUserId: "user-admin-1", organizationId: "11111111-1111-7111-8111-111111111111" };

let harness: TestDatabase;
let recorded: SecurityEvent[] = [];
let restoreSink: (() => void) | undefined;

beforeAll(async () => {
  harness = await createTestDatabase();
  const previous = setSecurityEventSink((event) => {
    recorded.push(event);
  });
  restoreSink = () => setSecurityEventSink(previous);
});

afterAll(async () => {
  restoreSink?.();
  await harness.close();
});

beforeEach(async () => {
  recorded = [];
  await harness.exec(`DELETE FROM sessions`);
  await harness.exec(`DELETE FROM users`);
  await harness.db.insert(users).values({
    id: USER_ID,
    name: "Panitia Kajian",
    email: "panitia@example.test",
    emailVerified: true,
  });
  await harness.db.insert(sessions).values({
    id: SESSION_ID,
    userId: USER_ID,
    token: SESSION_TOKEN,
    expiresAt: new Date("2026-10-27T00:00:00.000Z"),
    deviceLabel: "Pixel 8 - pintu utama",
  });
});

describe("session revocation", () => {
  test("revoking deletes the session row so the session ends on its next request", async () => {
    await revokeSession(SESSION_ID, "Perangkat hilang di pintu masuk", ACTOR, harness.db);

    const remaining = await harness.query<{ n: number }>("SELECT count(*)::int AS n FROM sessions");
    expect(remaining[0]?.n).toBe(0);
  });

  test("the action is recorded with actor and reason, and never with the session token", async () => {
    await revokeSession(SESSION_ID, "Sesi dicabut atas permintaan pemilik", ACTOR, harness.db);

    expect(recorded).toHaveLength(1);
    const event = recorded[0];
    expect(event).toMatchObject({
      event: "session_revoked",
      sessionId: SESSION_ID,
      actorUserId: ACTOR.actorUserId,
      organizationId: ACTOR.organizationId,
    });
    expect(JSON.stringify(event)).not.toContain(SESSION_TOKEN);
  });

  test("a reason shorter than 8 characters is rejected", async () => {
    await expect(revokeSession(SESSION_ID, "pendek", ACTOR, harness.db)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
    });
    const still = await harness.query<{ n: number }>("SELECT count(*)::int AS n FROM sessions");
    expect(still[0]?.n).toBe(1);
  });

  test("an unknown session id is NOT_FOUND, with no existence disclosure", async () => {
    let caught: unknown;
    try {
      await revokeSession("session-yang-tidak-ada", "Sesi dicabut atas permintaan pemilik", ACTOR, harness.db);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe(ErrorCode.NOT_FOUND);
    expect((caught as AppError).httpStatus).toBe(404);
    expect(recorded).toHaveLength(0);
  });
});
