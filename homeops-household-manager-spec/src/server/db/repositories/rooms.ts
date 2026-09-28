// HomeOps — rooms repository (T-ROOM-001). Wave2 narrow vertical.

import { eq, and } from 'drizzle-orm';
import { room } from '../schema/rooms';
import type { DbOrTx } from '../unit-of-work';

export async function listRooms(db: DbOrTx, householdId: string) {
  return db
    .select()
    .from(room)
    .where(eq(room.householdId, householdId as never))
    .orderBy(room.sortOrder);
}

export async function findRoomById(db: DbOrTx, householdId: string, roomId: string) {
  const rows = await db
    .select()
    .from(room)
    .where(and(eq(room.id, roomId as never), eq(room.householdId, householdId as never)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRoom(
  db: DbOrTx,
  householdId: string,
  input: { id: string; name: string; sortOrder: number; groupLabel?: string },
) {
  const [row] = await db
    .insert(room)
    .values({
      id: input.id as never,
      householdId: householdId as never,
      name: input.name,
      sortOrder: input.sortOrder,
      groupLabel: input.groupLabel ?? null,
    })
    .returning();
  return row;
}
