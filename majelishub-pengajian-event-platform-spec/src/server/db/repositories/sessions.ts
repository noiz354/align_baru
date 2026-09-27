/**
 * Session store operations that MajelisHub owns, rather than the identity library.
 *
 * Where this belongs: server/db/repositories — the only writer of `sessions` outside Better Auth's
 * own adapter.
 *
 * Specification: SECURITY.md §2 (session rules) and §10 ("emergency revocation (session kill) is one
 * action"), RETENTION.md (sessions 30 days).
 *
 * Invariants:
 *   1. Revocation **deletes** the row. A revoked session must stop authenticating immediately, and a
 *      soft-deleted row that still carries its token would keep doing so — so there is no "revoked"
 *      flag here.
 *   2. Raw SQL, parameterised. No user input is ever interpolated (SECURITY.md §7, Injection).
 *
 * Task ownership: T-ORG-001.
 */
import { sql } from "drizzle-orm";

import type { SqlExecutor } from "@/server/db/client";

// Identity ids are compared as TEXT, not uuid: `users.id`/`sessions.id` are Better Auth-issued text
// identifiers in this schema (the deviation recorded in DATA_MODEL.md §1 and TASKS.md T-ORG-001), so a
// `::uuid` cast here fails with "operator does not exist: text = uuid". Values stay UUID-shaped.


export interface StoredSession {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
  readonly userAgent: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  expires_at: Date | string;
  user_agent: string | null;
}

const toDomain = (row: SessionRow): StoredSession => ({
  id: row.id,
  userId: row.user_id,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  expiresAt: new Date(row.expires_at),
  userAgent: row.user_agent,
});

/** Reads one session by id. Returns `null` when it does not exist — existence is not an error here. */
export async function findSessionById(
  database: SqlExecutor,
  sessionId: string,
): Promise<StoredSession | null> {
  const result = await database.execute(sql`
    SELECT id, user_id, created_at, updated_at, expires_at, user_agent
    FROM sessions
    WHERE id = ${sessionId}::text
  `);
  const row = result.rows[0] as SessionRow | undefined;
  return row ? toDomain(row) : null;
}

/** Lists a user's sessions, newest first. Powers the "my sessions" surface (`/sesi-saya`). */
export async function listSessionsForUser(
  database: SqlExecutor,
  userId: string,
): Promise<readonly StoredSession[]> {
  const result = await database.execute(sql`
    SELECT id, user_id, created_at, updated_at, expires_at, user_agent
    FROM sessions
    WHERE user_id = ${userId}::text
    ORDER BY updated_at DESC
  `);
  return result.rows.map((row) => toDomain(row as unknown as SessionRow));
}

/**
 * Revokes a session by deleting its row.
 *
 * @returns `true` when a session existed and was removed, `false` when there was nothing to revoke.
 *   The distinction matters: "already revoked" is a normal outcome during a session-kill, and
 *   reporting it as an error would make an operator retry a successful action.
 */
export async function deleteSessionById(
  database: SqlExecutor,
  sessionId: string,
): Promise<boolean> {
  const result = await database.execute(sql`
    DELETE FROM sessions WHERE id = ${sessionId}::text RETURNING id
  `);
  return result.rows.length > 0;
}

/** Deletes every session whose absolute expiry has passed. Called by the retention job (T-PRIV-003). */
export async function deleteExpiredSessions(
  database: SqlExecutor,
  olderThan: Date,
): Promise<number> {
  const result = await database.execute(sql`
    DELETE FROM sessions WHERE expires_at < ${olderThan.toISOString()}::timestamptz RETURNING id
  `);
  return result.rows.length;
}
