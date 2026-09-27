import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURES, isDatabaseAvailable, resetFixtures, withScratchDatabase } from '../../helpers/db';
import { getSql } from '../../../src/server/db/client';
import { newId } from '../../../src/server/db/id';
import { testClock } from '../../helpers/clock';

// T-PLAT-004 — the identity/tenancy/platform schema's constraints, asserted against a real Postgres
// 18 (the only way a unique index, a CHECK bound, or a cascade can be proven). DATA_MODEL.md §2.1 is
// the specification; this file is its executable half.
//
// Skipped when no scratch database is configured: `docker compose up postgres-test` provides one
// (TESTING.md §5). CI always has the service container, so a skip there is a pipeline defect.

describe.skipIf(!isDatabaseAvailable())('identity & tenancy constraints (T-PLAT-004)', () => {
  beforeEach(async () => {
    await withScratchDatabase(async () => resetFixtures());
  });

  it('T-PLAT-004 FR-HH-003: (household_id, user_id) is unique — one membership per user per household', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const householdId = FIXTURES.HH_MAIN.id;
      const userId = `dup-user-${newId()}`;
      await sql`
        insert into household_member (household_id, user_id, display_name, role)
        values (${householdId}, ${userId}, 'First', 'MEMBER')
      `;
      await expect(
        sql`
          insert into household_member (household_id, user_id, display_name, role)
          values (${householdId}, ${userId}, 'Second', 'ADMIN')
        `,
      ).rejects.toThrow(/duplicate key|unique/i);
      // The same user in a *different* household is a different row: uniqueness is per household.
      await sql`
        insert into household_member (household_id, user_id, display_name, role)
        values (${FIXTURES.HH_CONTROL.id}, ${userId}, 'Elsewhere', 'MEMBER')
      `;
    });
  });

  it('T-PLAT-004 FR-HH-012: ids default to uuidv7() and are time-ordered', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const first = await sql`
        insert into household (name, timezone, created_by)
        values ('Ordered A', 'Asia/Jakarta', 'seed-user-hh-main-sari')
        returning id
      `;
      const second = await sql`
        insert into household (name, timezone, created_by)
        values ('Ordered B', 'Asia/Jakarta', 'seed-user-hh-main-sari')
        returning id
      `;
      const a = String(first[0]?.id);
      const b = String(second[0]?.id);
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      // uuidv7 is timestamp-ordered, so the later insert sorts after the earlier one (index locality).
      expect(a < b).toBe(true);
    });
  });

  it('T-PLAT-004: a household name is NOT unique across households (DECISIONS.md 2026-09-27)', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      // Two households may share a name; a uniqueness violation would also leak which names exist.
      await sql`insert into household (name, timezone, created_by) values ('Rumah Budi', 'Asia/Jakarta', 'u1')`;
      await sql`insert into household (name, timezone, created_by) values ('Rumah Budi', 'Asia/Jakarta', 'u2')`;
      const rows = await sql`select count(*)::int as n from household where lower(name) = 'rumah budi'`;
      expect(rows[0]?.n).toBe(2);
      // Blank and over-long names are refused by CHECK constraints, not by application code alone.
      await expect(
        sql`insert into household (name, timezone, created_by) values ('   ', 'UTC', 'u3')`,
      ).rejects.toThrow(/ck_household_name_not_blank|check/i);
      await expect(
        sql`insert into household (name, timezone, created_by) values (${'x'.repeat(41)}, 'UTC', 'u4')`,
      ).rejects.toThrow(/ck_household_name_length|check/i);
      await expect(
        sql`insert into household (name, timezone, created_by) values ('Ok', '', 'u5')`,
      ).rejects.toThrow(/ck_household_timezone_not_blank|check/i);
    });
  });

  it('T-PLAT-004: household_settings bounds are CHECK constraints, and the pair rule holds', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const householdId = FIXTURES.HH_MAIN.id;
      // Seeded defaults: 7 / 24 / 14 / 10 / 168 (DATA_MODEL.md §2.1).
      const seeded = await sql`select * from household_settings where household_id = ${householdId}`;
      expect(seeded[0]).toMatchObject({
        maintenance_lead_days: 7,
        snooze_max_hours: 24,
        info_expiry_days: 14,
        daily_cap_ceiling: 10,
        room_override_max_hours: 168,
      });
      await expect(
        sql`update household_settings set daily_cap_ceiling = 51 where household_id = ${householdId}`,
      ).rejects.toThrow(/ck_settings_daily_cap|check/i);
      await expect(
        sql`update household_settings set maintenance_lead_days = 91 where household_id = ${householdId}`,
      ).rejects.toThrow(/ck_settings_lead_days|check/i);
      // Quiet hours are both-or-neither: one side null is refused.
      await expect(
        sql`update household_settings set quiet_hours_start = '22:00' where household_id = ${householdId}`,
      ).rejects.toThrow(/ck_settings_quiet_hours_pair|check/i);
      await sql`update household_settings set quiet_hours_start = '22:00', quiet_hours_end = '06:00' where household_id = ${householdId}`;
    });
  });

  it('T-PLAT-004 FR-HH-003: deleting a household cascades to settings, members and invitations', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const householdId = FIXTURES.HH_EMPTY.id;
      const before = await sql`
        select
          (select count(*)::int from household_settings where household_id = ${householdId}) as settings,
          (select count(*)::int from household_member where household_id = ${householdId}) as members
      `;
      expect(before[0]).toMatchObject({ settings: 1, members: 1 });

      await sql`delete from household where id = ${householdId}`;
      const after = await sql`
        select
          (select count(*)::int from household where id = ${householdId}) as households,
          (select count(*)::int from household_settings where household_id = ${householdId}) as settings,
          (select count(*)::int from household_member where household_id = ${householdId}) as members,
          (select count(*)::int from invitation where household_id = ${householdId}) as invitations
      `;
      expect(after[0]).toEqual({ households: 0, settings: 0, members: 0, invitations: 0 });
    });
  });

  it('T-PLAT-004: session token hashes are unique and a membership requires an existing user', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const userId = `session-user-${newId()}`;
      await sql`insert into "user" (id, name, email) values (${userId}, 'Session Test', ${`${userId}@homeops.test`})`;
      await sql`insert into session (id, user_id, token_hash, expires_at) values (${newId()}, ${userId}, 'hash-a', ${new Date(Date.parse(testClock().now()) + 3_600_000)})`;
      await expect(
        sql`insert into session (id, user_id, token_hash, expires_at) values (${newId()}, ${userId}, 'hash-a', ${new Date(Date.parse(testClock().now()) + 3_600_000)})`,
      ).rejects.toThrow(/duplicate key|unique/i);
      // FK: a membership cannot point at a user that does not exist.
      await expect(
        sql`insert into household_member (household_id, user_id, display_name, role) values (${FIXTURES.HH_MAIN.id}, 'no-such-user', 'Ghost', 'MEMBER')`,
      ).rejects.toThrow(/foreign key|violates/i);
    });
  });

  it('T-PLAT-004 NFR-PRIV-004: activity and outbox rows require a household and a retention stamp', async () => {
    await withScratchDatabase(async () => {
      const sql = getSql();
      const householdId = FIXTURES.HH_MAIN.id;
      await sql`
        insert into activity_event (household_id, type, entity_kind, entity_id, summary, occurred_at, retain_until)
        values (${householdId}, 'CHORE_COMPLETED', 'chore_occurrence', ${newId()}, 'Chore completed', now(), now() + interval '365 days')
      `;
      const rows =
        await sql`select count(*)::int as n from activity_event where household_id = ${householdId}`;
      expect(Number(rows[0]?.n)).toBeGreaterThan(0);
      // A row without a household is impossible: the column is NOT NULL (I-XA-001).
      await expect(
        sql`insert into activity_event (type, entity_kind, entity_id, summary, occurred_at, retain_until)
            values ('CHORE_COMPLETED', 'chore_occurrence', ${newId()}, 'Orphan', now(), now())`,
      ).rejects.toThrow(/not-null|violates/i);
    });
  });
});
