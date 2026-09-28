// HomeOps — chores repository (T-CHORE-001..004). Wave2 narrow vertical: Today + complete.

import { and, eq, lte, sql } from 'drizzle-orm';
import { choreOccurrence, choreDefinition } from '../schema/chores';
import type { DbOrTx } from '../unit-of-work';

export async function listOccurrences(db: DbOrTx, householdId: string) {
  return db
    .select()
    .from(choreOccurrence)
    .where(eq(choreOccurrence.householdId, householdId as never))
    .orderBy(choreOccurrence.dueOn);
}

export async function listTodayOccurrences(db: DbOrTx, householdId: string, today: string) {
  // Overdue + today: dueOn <= today and status OPEN (or SNOOZED but snoozedUntil <= now handled later; for wave2 simple)
  return db
    .select()
    .from(choreOccurrence)
    .where(
      and(
        eq(choreOccurrence.householdId, householdId as never),
        lte(choreOccurrence.dueOn, today as never),
        eq(choreOccurrence.status, 'OPEN' as never),
      ),
    )
    .orderBy(choreOccurrence.dueOn);
}

export async function findOccurrenceById(db: DbOrTx, householdId: string, id: string) {
  const rows = await db
    .select()
    .from(choreOccurrence)
    .where(and(eq(choreOccurrence.id, id as never), eq(choreOccurrence.householdId, householdId as never)))
    .limit(1);
  return rows[0] ?? null;
}

export async function completeOccurrence(
  db: DbOrTx,
  householdId: string,
  occurrenceId: string,
  completedByMemberId: string,
) {
  const now = new Date();
  const [row] = await db
    .update(choreOccurrence)
    .set({
      status: 'COMPLETED' as never,
      completedAt: now as never,
      completedByMemberId: completedByMemberId as never,
      updatedAt: now as never,
    })
    .where(and(eq(choreOccurrence.id, occurrenceId as never), eq(choreOccurrence.householdId, householdId as never)))
    .returning();
  return row ?? null;
}

export async function createOccurrence(
  db: DbOrTx,
  householdId: string,
  input: {
    id: string;
    occurrenceKey: string;
    titleSnapshot: string;
    roomIdSnapshot?: string | null;
    dueOn: string;
    status?: string;
    assigneeMemberId?: string | null;
  },
) {
  const [row] = await db
    .insert(choreOccurrence)
    .values({
      id: input.id as never,
      householdId: householdId as never,
      occurrenceKey: input.occurrenceKey,
      titleSnapshot: input.titleSnapshot,
      roomIdSnapshot: (input.roomIdSnapshot ?? null) as never,
      dueOn: input.dueOn as never,
      status: (input.status ?? 'OPEN') as never,
      assigneeMemberId: (input.assigneeMemberId ?? null) as never,
    })
    .returning();
  return row;
}

export async function createDefinition(
  db: DbOrTx,
  householdId: string,
  input: { id: string; title: string; roomId?: string | null; assigneeMemberId?: string | null; createdByMemberId: string },
) {
  const [row] = await db
    .insert(choreDefinition)
    .values({
      id: input.id as never,
      householdId: householdId as never,
      title: input.title,
      roomId: (input.roomId ?? null) as never,
      assigneeMemberId: (input.assigneeMemberId ?? null) as never,
      createdByMemberId: input.createdByMemberId as never,
    })
    .returning();
  return row;
}
