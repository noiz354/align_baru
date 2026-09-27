// HomeOps — household & invitation adapters (T-PLAT-005, ports in src/domain/household/ports.ts).
//
// Every read takes `householdId` first and compares it against the scope this handle was created
// with: a mismatch returns `null` (surfacing as NOT_FOUND), never another household's rows
// (ADR-005, I-XA-001, T-SEC-002).

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Id } from '../../../shared/types';
import type { Clock } from '../../../shared/time/clock';
import type { HouseholdRepository, InvitationRepository } from '../../../domain/household/ports';
import type { Household, HouseholdSettings, Invitation, QuietHours } from '../../../domain/household/types';
import { household, householdMember, householdSettings, invitation } from '../schema/tenancy';
import type { DbOrTx } from '../unit-of-work';

type Row = typeof household.$inferSelect;
type SettingsRow = typeof householdSettings.$inferSelect;
type InvitationRow = typeof invitation.$inferSelect;

export type HouseholdAdapterDeps = {
  readonly db: DbOrTx;
  /** The scope this handle may read and write. Nothing outside it is reachable. */
  readonly householdId: Id;
  readonly clock: Clock;
  /**
   * The acting identity, when the unit of work was opened for a member's request. Jobs leave it
   * absent: they never create households or invitations (ADR-013).
   */
  readonly actor?: { readonly userId: Id; readonly memberId: Id };
};

export function createHouseholdRepository(deps: HouseholdAdapterDeps): HouseholdRepository {
  const { db, householdId } = deps;

  return {
    async findById(requested: Id): Promise<Household | null> {
      if (requested !== householdId) return null; // isolation, not authorization (I-XA-002)
      const rows = await db.select().from(household).where(eq(household.id, householdId)).limit(1);
      const row = rows[0];
      return row ? toHousehold(row) : null;
    },

    /**
     * The single documented unscoped read (I-XA-001a): resolving *which* household a member belongs
     * to cannot take a householdId by definition. It is reachable only from session bootstrap and
     * has its own row in the T-SEC-002 isolation sweep.
     */
    async findMembershipHousehold(memberId: Id): Promise<Household | null> {
      const rows = await db
        .select({ household: household })
        .from(householdMember)
        .innerJoin(household, eq(household.id, householdMember.householdId))
        .where(and(eq(householdMember.id, memberId), isNull(householdMember.removedAt)))
        .limit(1);
      const row = rows[0]?.household;
      if (!row) return null;
      // A member of another household is, from this scope's point of view, not found.
      return row.id === householdId ? toHousehold(row) : null;
    },

    async insert(next: Household): Promise<void> {
      if (next.id !== householdId) {
        // Writing an aggregate that belongs to another household is a programming error, not a
        // member-facing outcome: refuse loudly so the bug cannot ship (AGENTS.md §9).
        throw new Error('HouseholdRepository.insert: aggregate id does not match the scoped household');
      }
      await db.insert(household).values({
        id: next.id,
        name: next.name,
        timezone: next.timezone,
        weekStartsOn: next.weekStartsOn,
        archivedAt: next.archivedAt ? new Date(next.archivedAt) : null,
        createdAt: new Date(next.createdAt),
        updatedAt: new Date(next.createdAt),
        createdBy: deps.actor?.userId ?? next.createdByMemberId,
        createdByMemberId: next.createdByMemberId,
        version: 1,
      });
    },

    async update(next: Household): Promise<void> {
      if (next.id !== householdId) return;
      await db
        .update(household)
        .set({
          name: next.name,
          timezone: next.timezone,
          weekStartsOn: next.weekStartsOn,
          archivedAt: next.archivedAt ? new Date(next.archivedAt) : null,
          updatedAt: new Date(deps.clock.now()),
          version: sql`${household.version} + 1`,
        })
        .where(eq(household.id, householdId));
    },

    async findSettings(requested: Id): Promise<HouseholdSettings | null> {
      if (requested !== householdId) return null;
      const rows = await db
        .select()
        .from(householdSettings)
        .where(eq(householdSettings.householdId, householdId))
        .limit(1);
      const row = rows[0];
      return row ? toSettings(row) : null;
    },

    async updateSettings(next: HouseholdSettings): Promise<void> {
      if (next.householdId !== householdId) return;
      await db
        .insert(householdSettings)
        .values(toSettingsRow(next))
        .onConflictDoUpdate({
          target: householdSettings.householdId,
          set: {
            ...toSettingsRow(next),
            updatedAt: new Date(deps.clock.now()),
            version: sql`${householdSettings.version} + 1`,
          },
        });
    },
  };
}

export function createInvitationRepository(deps: HouseholdAdapterDeps): InvitationRepository {
  const { db, householdId } = deps;

  return {
    async insert(next: Invitation): Promise<void> {
      if (next.householdId !== householdId) {
        throw new Error('InvitationRepository.insert: invitation belongs to another household');
      }
      await db.insert(invitation).values({
        id: next.id,
        householdId: next.householdId,
        tokenHash: next.tokenHash,
        invitedEmail: next.invitedEmail ?? null,
        role: next.role,
        expiresAt: new Date(next.expiresAt),
        acceptedAt: next.acceptedAt ? new Date(next.acceptedAt) : null,
        revokedAt: next.revokedAt ? new Date(next.revokedAt) : null,
        createdByMemberId: deps.actor?.memberId ?? null,
      });
    },

    /** Compare-and-set: only a pending, unexpired row is consumed (T-AUTH-006 race safety). */
    async consumeByTokenHash(tokenHash: string, now: Date): Promise<Invitation | null> {
      const rows = await db
        .update(invitation)
        .set({ acceptedAt: now })
        .where(
          and(
            eq(invitation.tokenHash, tokenHash),
            eq(invitation.householdId, householdId),
            isNull(invitation.acceptedAt),
            isNull(invitation.revokedAt),
            sql`${invitation.expiresAt} > ${now}`,
          ),
        )
        .returning();
      const row = rows[0];
      return row ? toInvitation(row) : null;
    },

    async listPending(requested: Id): Promise<readonly Invitation[]> {
      if (requested !== householdId) return [];
      const now = new Date(deps.clock.now());
      const rows = await db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.householdId, householdId),
            isNull(invitation.acceptedAt),
            isNull(invitation.revokedAt),
            sql`${invitation.expiresAt} > ${now}`,
          ),
        )
        .orderBy(invitation.createdAt);
      return rows.map(toInvitation);
    },

    async revoke(requested: Id, invitationId: Id): Promise<void> {
      if (requested !== householdId) return;
      await db
        .update(invitation)
        .set({ revokedAt: new Date(deps.clock.now()) })
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.householdId, householdId),
            isNull(invitation.acceptedAt),
          ),
        );
    },
  };
}

/* ---------- row ↔ domain mapping (explicit; no column names leak upward, ADR-003) ---------- */

export function toHousehold(row: Row): Household {
  return {
    id: row.id as Id,
    name: row.name,
    timezone: row.timezone,
    weekStartsOn: row.weekStartsOn,
    ...(row.archivedAt ? { archivedAt: row.archivedAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
    createdByMemberId: (row.createdByMemberId ?? row.createdBy) as Id,
  };
}

export function toSettings(row: SettingsRow): HouseholdSettings {
  const quietHours: QuietHours | undefined =
    row.quietHoursStart && row.quietHoursEnd
      ? { start: row.quietHoursStart, end: row.quietHoursEnd }
      : undefined;
  return {
    householdId: row.householdId as Id,
    maintenanceLeadDays: row.maintenanceLeadDays,
    snoozeMaxHours: row.snoozeMaxHours,
    infoExpiryDays: row.infoExpiryDays,
    ...(quietHours ? { quietHours } : {}),
    dailyCapCeiling: row.dailyCapCeiling,
    roomOverrideMaxHours: row.roomOverrideMaxHours,
  };
}

function toSettingsRow(settings: HouseholdSettings) {
  return {
    householdId: settings.householdId,
    maintenanceLeadDays: settings.maintenanceLeadDays,
    snoozeMaxHours: settings.snoozeMaxHours,
    infoExpiryDays: settings.infoExpiryDays,
    quietHoursStart: settings.quietHours?.start ?? null,
    quietHoursEnd: settings.quietHours?.end ?? null,
    dailyCapCeiling: settings.dailyCapCeiling,
    roomOverrideMaxHours: settings.roomOverrideMaxHours,
  };
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id as Id,
    householdId: row.householdId as Id,
    tokenHash: row.tokenHash,
    ...(row.invitedEmail ? { invitedEmail: row.invitedEmail } : {}),
    role: row.role === 'OWNER' ? 'ADMIN' : row.role, // CHECK forbids OWNER; defensive mapping
    expiresAt: row.expiresAt.toISOString(),
    ...(row.acceptedAt ? { acceptedAt: row.acceptedAt.toISOString() } : {}),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
  };
}
