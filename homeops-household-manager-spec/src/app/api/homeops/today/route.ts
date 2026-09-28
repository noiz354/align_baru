import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { listTodayOccurrences } from '@/server/db/repositories/chores';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const householdId = req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId');
  const today = url.searchParams.get('today') ?? '2026-09-28';
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });
  const db = getDb();
  const chores = await listTodayOccurrences(db as never, householdId, today);
  return NextResponse.json({ householdId, today, chores });
}
