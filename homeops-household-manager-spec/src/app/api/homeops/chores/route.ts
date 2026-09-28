import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { listOccurrences, createDefinition, createOccurrence } from '@/server/db/repositories/chores';
import { randomUUID } from 'node:crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const householdId = req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });
  const db = getDb();
  const chores = await listOccurrences(db as never, householdId);
  return NextResponse.json({ householdId, chores });
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_FAILED' }, { status: 422 }); }
  const url = new URL(req.url);
  const householdId = (body?.householdId ?? req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId') ?? '').trim();
  const memberId = (body?.memberId ?? req.headers.get('x-homeops-member') ?? url.searchParams.get('memberId') ?? '').trim();
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const recurrenceKindRaw = typeof body?.recurrenceKind === 'string' ? body.recurrenceKind.trim().toUpperCase() : 'NONE';
  const recurrenceKind = ['NONE','DAILY','WEEKLY','MONTHLY'].includes(recurrenceKindRaw) ? recurrenceKindRaw : 'NONE';
  const roomId = typeof body?.roomId === 'string' && body.roomId.trim() ? body.roomId.trim() : null;
  const dueOn = typeof body?.dueOn === 'string' && body.dueOn.trim() ? body.dueOn.trim() : new Date().toISOString().slice(0,10); // YYYY-MM-DD Jakarta
  if (!householdId) return NextResponse.json({ error: 'householdId required', code: 'VALIDATION_FAILED' }, { status: 422 });
  if (!memberId) return NextResponse.json({ error: 'memberId required', code: 'VALIDATION_FAILED' }, { status: 422 });
  if (!title || title.length < 2) return NextResponse.json({ error: 'title minimal 2 huruf', code: 'VALIDATION_FAILED', fields: { title: 'minimal 2' } }, { status: 422 });
  if (title.length > 80) return NextResponse.json({ error: 'title maksimal 80', code: 'VALIDATION_FAILED' }, { status: 422 });

  const db = getDb();
  const definitionId = randomUUID();
  try {
    const def = await createDefinition(db as never, householdId, {
      id: definitionId,
      title,
      roomId,
      assigneeMemberId: null,
      createdByMemberId: memberId,
      recurrenceKind,
    });
    // Create occurrence for dueOn with deterministic key
    const occurrenceKey = `${definitionId}:${dueOn}`;
    const occId = randomUUID();
    const occ = await createOccurrence(db as never, householdId, {
      id: occId,
      occurrenceKey,
      titleSnapshot: title,
      roomIdSnapshot: roomId,
      dueOn,
      status: 'OPEN',
      definitionId,
    });
    return NextResponse.json({ definition: def, occurrence: occ }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return NextResponse.json({ error: msg, code: 'INTERNAL' }, { status: 500 });
  }
}
