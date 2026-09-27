// HomeOps — activity & audit adapters (T-ACT-001 shape, ports in src/domain/activity/ports.ts).
//
// Append-only by construction: the port exposes no update or delete method other than pruning
// (I-ACT-001). Summaries are snapshots, metadata is bounded and PII-free (I-ACT-003, I-ACT-005).

import { and, desc, eq, gt, lt, lte, sql } from 'drizzle-orm';
import type { Id, Instant } from '../../../shared/types';
import type { Clock } from '../../../shared/time/clock';
import type { ActivityRepository, AuditRepository } from '../../../domain/activity/ports';
import type { ActivityEvent, ActivityType } from '../../../domain/activity/types';
import { activityEvent, auditLog } from '../schema/platform';
import type { DbOrTx } from '../unit-of-work';

export type ActivityAdapterDeps = {
  readonly db: DbOrTx;
  readonly householdId: Id;
  readonly clock: Clock;
};

export function createActivityRepository(deps: ActivityAdapterDeps): ActivityRepository {
  const { db, householdId } = deps;

  return {
    async append(requested: Id, event: ActivityEvent): Promise<void> {
      if (requested !== householdId || event.householdId !== householdId) {
        throw new Error('ActivityRepository.append: event belongs to another household');
      }
      await db.insert(activityEvent).values({
        id: event.id,
        householdId: event.householdId,
        actorMemberId: event.actorMemberId ?? null,
        type: event.type,
        entityKind: event.entity.kind,
        entityId: event.entity.id,
        summary: event.summary,
        metadata: event.metadata ?? null,
        occurredAt: new Date(event.occurredAt),
        retainUntil: new Date(event.retainUntil),
      });
    },

    async list(requested: Id, options) {
      if (requested !== householdId) return { events: [] };
      const conditions = [eq(activityEvent.householdId, householdId)];
      if (options.types && options.types.length > 0) {
        conditions.push(sql`${activityEvent.type} = any(${options.types})`);
      }
      if (options.actorMemberId) conditions.push(eq(activityEvent.actorMemberId, options.actorMemberId));
      if (options.since) conditions.push(gt(activityEvent.occurredAt, new Date(options.since)));
      if (options.until) conditions.push(lte(activityEvent.occurredAt, new Date(options.until)));
      const cursor = decodeCursor(options.cursor);
      if (cursor) {
        // Keyset pagination on (occurred_at, id): no OFFSET on a history surface (DATA_MODEL.md §4).
        conditions.push(
          sql`(${activityEvent.occurredAt}, ${activityEvent.id}) < (${new Date(cursor.occurredAt)}, ${cursor.id})`,
        );
      }
      const rows = await db
        .select()
        .from(activityEvent)
        .where(and(...conditions))
        .orderBy(desc(activityEvent.occurredAt), desc(activityEvent.id))
        .limit(Math.min(Math.max(options.limit, 1), 100));

      const events = rows.map(toActivityEvent);
      const last = rows[rows.length - 1];
      const nextCursor =
        rows.length === Math.min(Math.max(options.limit, 1), 100) && last
          ? encodeCursor({ occurredAt: last.occurredAt.toISOString(), id: last.id })
          : undefined;
      return nextCursor ? { events, nextCursor } : { events };
    },

    async listForEntity(requested: Id, entityKind: string, entityId: Id, limit: number) {
      if (requested !== householdId) return [];
      const rows = await db
        .select()
        .from(activityEvent)
        .where(
          and(
            eq(activityEvent.householdId, householdId),
            eq(activityEvent.entityKind, entityKind),
            eq(activityEvent.entityId, entityId),
          ),
        )
        .orderBy(desc(activityEvent.occurredAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return rows.map(toActivityEvent);
    },

    /** Batched deletes so a prune never holds a long lock (T-PLAT-013, PRIVACY.md §3). */
    async pruneBefore(requested: Id, instant: Instant, batchSize: number): Promise<number> {
      if (requested !== householdId) return 0;
      const size = Math.min(Math.max(batchSize, 1), 5000);
      const due = await db
        .select({ id: activityEvent.id })
        .from(activityEvent)
        .where(
          and(eq(activityEvent.householdId, householdId), lt(activityEvent.retainUntil, new Date(instant))),
        )
        .limit(size);
      if (due.length === 0) return 0;
      const ids = due.map((row) => row.id);
      const deleted = await db
        .delete(activityEvent)
        .where(and(eq(activityEvent.householdId, householdId), sql`${activityEvent.id} = any(${ids})`))
        .returning({ id: activityEvent.id });
      return deleted.length;
    },
  };
}

/** Operator-facing audit trail: ids and outcomes only, never credentials or tokens (T-AUTH-008). */
export function createAuditRepository(deps: ActivityAdapterDeps): AuditRepository {
  const { db, householdId } = deps;
  return {
    async append(requested: Id, entry) {
      if (requested !== householdId) {
        throw new Error('AuditRepository.append: entry belongs to another household');
      }
      await db.insert(auditLog).values({
        householdId: entry.householdId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        targetKind: entry.targetKind ?? null,
        targetId: entry.targetId ?? null,
        outcome: entry.outcome,
        occurredAt: new Date(entry.occurredAt),
        // 12-month retention (SECURITY.md §11).
        retainUntil: new Date(Date.parse(entry.occurredAt) + 365 * 24 * 3_600_000),
      });
    },
  };
}

/** System-level audit writes (auth failures before a household context exists, T-AUTH-008). */
export function createSystemAuditRepository(db: DbOrTx): {
  append(entry: {
    readonly householdId?: Id | null;
    readonly actorUserId?: Id | null;
    readonly action: string;
    readonly targetKind?: string | null;
    readonly targetId?: string | null;
    readonly outcome: 'OK' | 'DENIED';
    readonly occurredAt: Instant;
    readonly ipHash?: string | null;
  }): Promise<void>;
} {
  return {
    async append(entry) {
      await db.insert(auditLog).values({
        householdId: entry.householdId ?? null,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        targetKind: entry.targetKind ?? null,
        targetId: entry.targetId ?? null,
        outcome: entry.outcome,
        ipHash: entry.ipHash ?? null,
        occurredAt: new Date(entry.occurredAt),
        retainUntil: new Date(Date.parse(entry.occurredAt) + 365 * 24 * 3_600_000),
      });
    },
  };
}

function toActivityEvent(row: typeof activityEvent.$inferSelect): ActivityEvent {
  const metadata = row.metadata as Readonly<Record<string, string | number>> | null;
  return {
    id: row.id as Id,
    householdId: row.householdId as Id,
    ...(row.actorMemberId ? { actorMemberId: row.actorMemberId as Id } : {}),
    type: row.type as ActivityType,
    entity: { kind: row.entityKind, id: row.entityId as Id },
    summary: row.summary,
    ...(metadata ? { metadata } : {}),
    occurredAt: row.occurredAt.toISOString(),
    retainUntil: row.retainUntil.toISOString(),
  };
}

function encodeCursor(value: { readonly occurredAt: string; readonly id: string }): string {
  return Buffer.from(`${value.occurredAt}|${value.id}`, 'utf8').toString('base64url');
}

function decodeCursor(
  cursor: string | undefined,
): { readonly occurredAt: string; readonly id: string } | null {
  if (!cursor) return null;
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const [occurredAt, id] = decoded.split('|');
  if (!occurredAt || !id) return null;
  return { occurredAt, id };
}
