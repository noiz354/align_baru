import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { completeOccurrence, findOccurrenceById, findDefinitionById, createOccurrence } from '@/server/db/repositories/chores';
import { randomUUID } from 'node:crypto';

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const householdId = req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId') ?? req.headers.get('x-household-id');
  const memberId = req.headers.get('x-homeops-member') ?? url.searchParams.get('memberId');
  if (!householdId) return NextResponse.json({ error: 'householdId required', code: 'VALIDATION_FAILED' }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: 'memberId required', code: 'VALIDATION_FAILED' }, { status: 400 });
  const db = getDb();
  const existing = await findOccurrenceById(db as never, householdId, id);
  if (!existing) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  if (existing.status === 'COMPLETED') {
    // idempotent: already done, no next creation
    return NextResponse.json({ chore: existing, deduped: true });
  }
  const updated = await completeOccurrence(db as never, householdId, id, memberId);
  if (!updated) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  let nextOccurrence: any = null;
  try {
    const defId = (existing as any).definitionId ?? (updated as any).definitionId;
    if (defId) {
      const def = await findDefinitionById(db as never, householdId, defId as string);
      const kind = (def as any)?.recurrenceKind ?? 'NONE';
      let nextDueOn: string | null = null;
      if (kind === 'DAILY') nextDueOn = addDays((existing as any).dueOn as string, 1);
      else if (kind === 'WEEKLY') nextDueOn = addDays((existing as any).dueOn as string, 7);
      else if (kind === 'MONTHLY') {
        const d = new Date((existing as any).dueOn + 'T00:00:00Z');
        d.setUTCMonth(d.getUTCMonth()+1);
        nextDueOn = d.toISOString().slice(0,10);
      }
      if (nextDueOn) {
        const occurrenceKey = `${defId}:${nextDueOn}`;
        const nextId = randomUUID();
        nextOccurrence = await createOccurrence(db as never, householdId, {
          id: nextId,
          occurrenceKey,
          titleSnapshot: (existing as any).titleSnapshot as string,
          roomIdSnapshot: (existing as any).roomIdSnapshot ?? null,
          dueOn: nextDueOn,
          status: 'OPEN',
          definitionId: defId as string,
        });
      }
    }
  } catch (e) {
    // next creation is best-effort; completion already succeeded
    console.error('next occurrence create failed', e);
  }

  return NextResponse.json({ chore: updated, nextOccurrence });
}
