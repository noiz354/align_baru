import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { completeOccurrence, findOccurrenceById } from '@/server/db/repositories/chores';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const householdId = req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId') ?? req.headers.get('x-household-id');
  const memberId = req.headers.get('x-homeops-member') ?? url.searchParams.get('memberId');
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });
  const db = getDb();
  const existing = await findOccurrenceById(db as never, householdId, id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === 'COMPLETED') return NextResponse.json({ chore: existing });
  const updated = await completeOccurrence(db as never, householdId, id, memberId);
  return NextResponse.json({ chore: updated });
}
