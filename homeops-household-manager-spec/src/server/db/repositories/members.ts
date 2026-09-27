// HomeOps — membership adapter (T-PLAT-005, ports in src/domain/members/ports.ts).
//
// Removal is the security-critical path: the membership is soft-deleted **and** the user's sessions
// are deleted in the same transaction, so a removed member is logged out everywhere immediately
// (I-MEM-003, FR-MEM-006, ADR-004).

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Id, LocalDate, Role } from '../../../shared/types';
import type { Clock } from '../../../shared/time/clock';
import type { MembershipRepository } from '../../../domain/members/ports';
import type { Membership } from '../../../domain/members/types';
import { session } from '../schema/auth';
import { householdMember } from '../schema/tenancy';
import type { DbOrTx } from '../unit-of-work';

type Row = typeof householdMember.$inferSelect;

export type MembershipAdapterDeps = {
  readonly db: DbOrTx;
  readonly householdId: Id;
  readonly clock: Clock;
};

export function createMembershipRepository(deps: MembershipAdapterDeps): MembershipRepository {
  const { db, householdId } = deps;
  const inScope = (requested: Id): boolean => requested === householdId;

  return {
    async findById(requested: Id, memberId: Id): Promise<Membership | null> {
      if (!inScope(requested)) return null;
      const rows = await db
        .select()
        .from(householdMember)
        .where(
          and(
            eq(householdMember.id, memberId),
            eq(householdMember.householdId, householdId),
            isNull(householdMember.removedAt),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? toMembership(row) : null;
    },

    async listByHousehold(requested: Id): Promise<readonly Membership[]> {
      if (!inScope(requested)) return [];
      const rows = await db
        .select()
        .from(householdMember)
        .where(and(eq(householdMember.householdId, householdId), isNull(householdMember.removedAt)))
        .orderBy(householdMember.createdAt);
      return rows.map(toMembership);
    },

    async listRecipients(requested: Id): Promise<readonly Pick<Membership, 'id' | 'role' | 'awayUntil'>[]> {
      if (!inScope(requested)) return [];
      const rows = await db
        .select({ id: householdMember.id, role: householdMember.role, awayUntil: householdMember.awayUntil })
        .from(householdMember)
        .where(and(eq(householdMember.householdId, householdId), isNull(householdMember.removedAt)));
      return rows.map((row) => ({
        id: row.id as Id,
        role: row.role as Role,
        ...(row.awayUntil ? { awayUntil: toLocalDate(row.awayUntil) } : {}),
      }));
    },

    async insert(next: Membership): Promise<void> {
      if (next.householdId !== householdId) {
        throw new Error('MembershipRepository.insert: membership belongs to another household');
      }
      await db.insert(householdMember).values({
        id: next.id,
        householdId: next.householdId,
        userId: next.userId,
        displayName: next.displayName,
        avatarColor: next.avatarColor ?? null,
        role: next.role,
        awayUntil: next.awayUntil ?? null,
        createdAt: new Date(next.joinedAt),
        updatedAt: new Date(next.joinedAt),
      });
    },

    async updateRole(requested: Id, memberId: Id, role: Role): Promise<void> {
      if (!inScope(requested)) return;
      await db
        .update(householdMember)
        .set({ role, updatedAt: new Date(deps.clock.now()), version: sql`${householdMember.version} + 1` })
        .where(
          and(
            eq(householdMember.id, memberId),
            eq(householdMember.householdId, householdId),
            isNull(householdMember.removedAt),
          ),
        );
    },

    async setAway(requested: Id, memberId: Id, awayUntil: LocalDate | null): Promise<void> {
      if (!inScope(requested)) return;
      await db
        .update(householdMember)
        .set({ awayUntil, updatedAt: new Date(deps.clock.now()) })
        .where(and(eq(householdMember.id, memberId), eq(householdMember.householdId, householdId)));
    },

    /** Soft delete + session revocation, atomically (I-MEM-003). */
    async remove(requested: Id, memberId: Id): Promise<void> {
      if (!inScope(requested)) return;
      const rows = await db
        .select({ userId: householdMember.userId })
        .from(householdMember)
        .where(
          and(
            eq(householdMember.id, memberId),
            eq(householdMember.householdId, householdId),
            isNull(householdMember.removedAt),
          ),
        )
        .limit(1);
      const userId = rows[0]?.userId;
      await db
        .update(householdMember)
        .set({ removedAt: new Date(deps.clock.now()), updatedAt: new Date(deps.clock.now()) })
        .where(and(eq(householdMember.id, memberId), eq(householdMember.householdId, householdId)));
      if (userId) {
        // Deleting the session row *is* the revocation primitive (ADR-004). Push subscriptions are
        // deleted by the members feature in the same unit of work (T-MEM-004, VS-10).
        await db.delete(session).where(eq(session.userId, userId));
      }
    },

    async countActiveOwners(requested: Id): Promise<number> {
      if (!inScope(requested)) return 0;
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(householdMember)
        .where(
          and(
            eq(householdMember.householdId, householdId),
            eq(householdMember.role, 'OWNER'),
            isNull(householdMember.removedAt),
          ),
        );
      return rows[0]?.count ?? 0;
    },
  };
}

function toMembership(row: Row): Membership {
  return {
    id: row.id as Id,
    householdId: row.householdId as Id,
    userId: row.userId as Id,
    role: row.role as Role,
    displayName: row.displayName,
    ...(row.avatarColor ? { avatarColor: row.avatarColor } : {}),
    joinedAt: row.createdAt.toISOString(),
    ...(row.awayUntil ? { awayUntil: toLocalDate(row.awayUntil) } : {}),
  };
}

/** Drizzle returns `date` columns as JS Dates (midnight UTC); we store and read civil strings. */
function toLocalDate(value: Date | string): LocalDate {
  if (typeof value === 'string') return value as LocalDate;
  return value.toISOString().slice(0, 10) as LocalDate;
}
