// HomeOps — development seed runner (T-PLAT-018, docs/testing/TEST-DATA.md §2/§11).
//
// Lives in the server layer because it writes rows: `scripts/seed.ts` is only a CLI, and only
// `src/server/db` may touch the driver (ARCHITECTURE.md §4.1). Re-runs are idempotent — every
// fixture id is a literal, and an existing row is skipped rather than duplicated or reset.

import { and, eq } from 'drizzle-orm';
import { user } from '../schema/auth';
import { householdMember } from '../schema/tenancy';
import { createRepositories } from '../repositories';
import { withTransaction, type DbOrTx } from '../unit-of-work';
import { createFixedClock } from '../../../shared/time/clock';
import { createDeterministicIdGenerator } from '../id';
import type { HouseholdSettings } from '../../../domain/household/types';
import {
  PENDING_SEED_SECTIONS,
  SEED_HOUSEHOLDS,
  SEED_USERS,
  SEED_INSTANT,
  isPendingSeedSection,
  type SeedHousehold,
} from './fixtures';

export type SeedResult = {
  readonly usersInserted: number;
  readonly householdsInserted: number;
  readonly householdsSkipped: number;
  readonly membersInserted: number;
  readonly settingsUpserted: number;
};

export type SeedOptions = {
  /** Fixture sections to include beyond identity/tenancy; a pending section throws (see below). */
  readonly sections?: readonly string[];
};

/**
 * The database defaults from `household_settings` (DATA_MODEL.md §2.1: "defaults applied at
 * creation"). The seed states them explicitly so a fixture is reproducible even if a default is
 * later changed by a migration.
 */
function defaultSettings(householdId: string): HouseholdSettings {
  return {
    householdId,
    maintenanceLeadDays: 7,
    snoozeMaxHours: 24,
    infoExpiryDays: 14,
    dailyCapCeiling: 10,
    roomOverrideMaxHours: 168,
  };
}

export async function seedDevelopmentData(options: SeedOptions = {}): Promise<SeedResult> {
  for (const section of options.sections ?? []) {
    if (isPendingSeedSection(section)) {
      const pending = PENDING_SEED_SECTIONS.find((entry) => entry.section === section);
      // Honest failure rather than a smaller dataset reported as success (AGENTS.md §3).
      throw new Error(
        `Not implemented: ${pending?.owningTask} — the "${section}" fixture section needs ${pending?.unlocks}, ` +
          "which arrives with that slice's migration. Identity/tenancy fixtures seed without it.",
      );
    }
    throw new Error(`seedDevelopmentData: unknown fixture section "${section}"`);
  }

  return withTransaction(async (tx) => {
    const clock = createFixedClock(SEED_INSTANT);
    const ids = createDeterministicIdGenerator('seed');
    const usersInserted = await insertUsers(tx);

    let householdsInserted = 0;
    let householdsSkipped = 0;
    let membersInserted = 0;
    let settingsUpserted = 0;

    for (const fixture of SEED_HOUSEHOLDS) {
      const repos = createRepositories({
        db: tx,
        householdId: fixture.id,
        clock,
        ids,
        actor: { userId: fixture.createdByUserId, memberId: fixture.createdByMemberId },
      });

      if (await repos.household.findById(fixture.id)) {
        householdsSkipped += 1;
        // Still converge members and settings: a partially seeded database becomes complete.
      } else {
        await repos.household.insert({
          id: fixture.id,
          name: fixture.name,
          timezone: fixture.timezone,
          weekStartsOn: fixture.weekStartsOn,
          createdAt: SEED_INSTANT,
          createdByMemberId: fixture.createdByMemberId,
        });
        householdsInserted += 1;
      }

      await repos.household.updateSettings(defaultSettings(fixture.id));
      settingsUpserted += 1;

      membersInserted += await insertMembers(tx, repos.members, fixture);
    }

    return { usersInserted, householdsInserted, householdsSkipped, membersInserted, settingsUpserted };
  });
}

async function insertUsers(tx: DbOrTx): Promise<number> {
  let inserted = 0;
  for (const fixture of SEED_USERS) {
    const result = await tx
      .insert(user)
      .values({
        id: fixture.id,
        name: fixture.name,
        email: fixture.email,
        emailVerified: true, // a fixture that must verify an email teaches nothing (TEST-DATA §9)
        image: null,
        createdAt: new Date(SEED_INSTANT),
        updatedAt: new Date(SEED_INSTANT),
      })
      .onConflictDoNothing({ target: user.id })
      .returning({ id: user.id });
    inserted += result.length;
  }
  return inserted;
}

async function insertMembers(
  tx: DbOrTx,
  members: ReturnType<typeof createRepositories>['members'],
  fixture: SeedHousehold,
): Promise<number> {
  let inserted = 0;
  for (const member of fixture.members) {
    const existing = await tx
      .select({ id: householdMember.id })
      .from(householdMember)
      .where(and(eq(householdMember.id, member.id), eq(householdMember.householdId, fixture.id)))
      .limit(1);
    if (existing.length > 0) continue;

    await members.insert({
      id: member.id,
      householdId: fixture.id,
      userId: member.userId,
      role: member.role,
      displayName: member.displayName,
      ...(member.avatarColor ? { avatarColor: member.avatarColor } : {}),
      joinedAt: SEED_INSTANT,
      ...(member.awayFrom ? { awayFrom: member.awayFrom } : {}),
      ...(member.awayUntil ? { awayUntil: member.awayUntil } : {}),
    });
    inserted += 1;
  }
  return inserted;
}

/** Row counts per fixture household, printed by the CLI so a re-run is visibly a no-op. */
export async function describeSeededHouseholds(): Promise<readonly { name: string; members: number }[]> {
  return withTransaction(async (tx) => {
    const out: { name: string; members: number }[] = [];
    for (const fixture of SEED_HOUSEHOLDS) {
      const rows = await tx
        .select({ id: householdMember.id })
        .from(householdMember)
        .where(eq(householdMember.householdId, fixture.id));
      out.push({ name: fixture.name, members: rows.length });
    }
    return out;
  });
}
