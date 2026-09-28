import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { listRooms } from '@/server/db/repositories/rooms';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const householdId = req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });
  const db = getDb();
  const rooms = await listRooms(db as never, householdId);
  return NextResponse.json({ householdId, rooms });
}
