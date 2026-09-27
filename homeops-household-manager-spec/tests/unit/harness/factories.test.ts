import { beforeEach, describe, expect, it } from 'vitest';
import {
  FACTORY_NOW,
  activityEvent,
  alert,
  attachment,
  choreDefinition,
  choreOccurrence,
  household,
  householdSettings,
  invitation,
  issue,
  maintenancePlan,
  member,
  resetFactorySequence,
  resource,
  room,
  trashContainer,
} from '../../factories';
import {
  inMemoryActivity,
  inMemoryHousehold,
  inMemoryMembers,
  inMemoryPlatform,
} from '../../helpers/in-memory';
import {
  BERLIN_DST_FORWARD_01_30,
  BERLIN_DST_FORWARD_02_30,
  JAKARTA_NO_DST,
  testClock,
} from '../../helpers/clock';
import { createHouseholdDay } from '../../../src/shared/time/clock';
import type { ActivityEvent } from '../../../src/domain/activity/types';

// The harness itself is the subject (T-PLAT-016, docs/testing/TEST-DATA.md §4/§6): factory defaults
// are asserted once here so they cannot drift silently, and the in-memory doubles are proved to
// enforce household scoping — the property that makes them trustworthy rather than convenient.

const HH_MAIN = 'hh-main';
const HH_CONTROL = 'hh-control';

describe('factories: defaults are valid and explicit', () => {
  beforeEach(() => {
    resetFactorySequence();
  });

  it('T-PLAT-016: household() defaults to the HH_MAIN composition', () => {
    expect(household()).toEqual({
      id: 'hh-1',
      name: 'HH_MAIN',
      timezone: 'Asia/Jakarta',
      weekStartsOn: 'MONDAY',
      createdAt: FACTORY_NOW,
      createdByMemberId: 'mem-owner',
    });
  });

  it('T-PLAT-016: member() defaults to a present MEMBER of the first household', () => {
    expect(member()).toMatchObject({
      id: 'mem-1',
      householdId: 'hh-1',
      role: 'MEMBER',
      displayName: 'Sari',
      joinedAt: FACTORY_NOW,
    });
    expect(member().awayUntil).toBeUndefined();
  });

  it('T-PLAT-016: householdSettings() defaults match the documented policy knobs', () => {
    // DATA_MODEL.md §2.1 and the `household_settings` DDL defaults: 7 / 24 / 14 / 10 / 168.
    expect(householdSettings()).toEqual({
      householdId: 'hh-1',
      maintenanceLeadDays: 7,
      snoozeMaxHours: 24,
      infoExpiryDays: 14,
      dailyCapCeiling: 10,
      roomOverrideMaxHours: 168,
    });
  });

  it('T-PLAT-016: invitation() is single-use, pending, and expires in seven days', () => {
    const invite = invitation({ householdId: HH_MAIN });
    expect(invite).toMatchObject({
      householdId: HH_MAIN,
      role: 'MEMBER',
      expiresAt: '2026-10-12T00:00:00.000Z',
    });
    expect(invite.acceptedAt).toBeUndefined();
    expect(invite.revokedAt).toBeUndefined();
  });

  it('T-PLAT-016: overrides win, and ids stay unique until the sequence is reset', () => {
    expect(household({ name: 'HH_CONTROL', timezone: 'America/New_York' })).toMatchObject({
      name: 'HH_CONTROL',
      timezone: 'America/New_York',
    });
    expect(member().id).not.toBe(member().id);
    resetFactorySequence();
    expect(member().id).toBe('mem-1');
  });

  it('T-PLAT-016: a factory for an unimplemented module names its task instead of guessing', () => {
    // The harness must not invent defaults no document has fixed (AGENTS.md §3).
    const pending = {
      choreOccurrence,
      resource,
      room,
      alert,
      activityEvent,
      attachment,
      issue,
      maintenancePlan,
      trashContainer,
      choreDefinition,
    };
    for (const [name, factory] of Object.entries(pending)) {
      expect(() => factory(), `${name} did not throw`).toThrowError(/^Not implemented: T-[A-Z]{2,6}-\d{3}$/);
    }
  });
});

describe('in-memory doubles enforce household scoping', () => {
  beforeEach(() => {
    resetFactorySequence();
  });

  it('T-PLAT-016 / T-SEC-002: a foreign household id reads as not-found, never as another row', () => {
    const scope = inMemoryHousehold(HH_MAIN);
    scope.givenHousehold(household({ id: HH_MAIN, name: 'HH_MAIN' }));
    scope.givenHousehold(household({ id: HH_CONTROL, name: 'HH_CONTROL' }));

    return Promise.resolve().then(async () => {
      expect(await scope.repository.findById(HH_MAIN)).toMatchObject({ name: 'HH_MAIN' });
      expect(await scope.repository.findById(HH_CONTROL)).toBeNull();
      expect(await scope.repository.findSettings(HH_CONTROL)).toBeNull();
      // Writing a foreign aggregate is a programming error, not a silent no-op.
      await expect(scope.repository.insert(household({ id: HH_CONTROL }))).rejects.toThrow(
        /foreign household/,
      );
    });
  });

  it('T-PLAT-016 / T-SEC-002: memberships are scoped and unique per (household, user)', async () => {
    const scope = inMemoryMembers(HH_MAIN);
    const owner = member({ id: 'mem-owner', householdId: HH_MAIN, role: 'OWNER', userId: 'user-1' });
    scope.givenMember(owner);

    expect(await scope.repository.listByHousehold(HH_MAIN)).toEqual([owner]);
    expect(await scope.repository.listByHousehold(HH_CONTROL)).toEqual([]);
    expect(await scope.repository.findById(HH_CONTROL, 'mem-owner')).toBeNull();
    expect(await scope.repository.countActiveOwners(HH_MAIN)).toBe(1);
    expect(await scope.repository.countActiveOwners(HH_CONTROL)).toBe(0);

    // The same user cannot join twice: the double enforces the database's unique index.
    await expect(scope.repository.insert(member({ householdId: HH_MAIN, userId: 'user-1' }))).rejects.toThrow(
      /MEMBER_ALREADY_IN_HOUSEHOLD/,
    );

    await scope.repository.setAway(HH_MAIN, 'mem-owner', '2026-10-10');
    expect(await scope.repository.listRecipients(HH_MAIN)).toEqual([
      { id: 'mem-owner', role: 'OWNER', awayUntil: '2026-10-10' },
    ]);
    await scope.repository.setAway(HH_MAIN, 'mem-owner', null);
    expect(await scope.repository.listRecipients(HH_MAIN)).toEqual([{ id: 'mem-owner', role: 'OWNER' }]);
  });

  it('T-PLAT-016: invitations are single-use and a foreign token hash is simply absent', async () => {
    const scope = inMemoryHousehold(HH_MAIN);
    scope.givenInvitation(invitation({ id: 'inv-1', householdId: HH_MAIN, tokenHash: 'hash-main' }));
    scope.givenInvitation(invitation({ id: 'inv-2', householdId: HH_CONTROL, tokenHash: 'hash-control' }));

    const accepted = await scope.invitations.consumeByTokenHash(
      'hash-main',
      new Date('2026-10-06T00:00:00.000Z'),
    );
    expect(accepted?.id).toBe('inv-1');
    // Replay after acceptance: null, not a second membership (FR-MEM-003, I-XA-002).
    expect(
      await scope.invitations.consumeByTokenHash('hash-main', new Date('2026-10-06T00:00:01.000Z')),
    ).toBeNull();
    expect(
      await scope.invitations.consumeByTokenHash('hash-control', new Date('2026-10-06T00:00:00.000Z')),
    ).toBeNull();
    expect(await scope.invitations.listPending(HH_MAIN)).toEqual([]);
    // A duplicate token hash violates the unique index, in the double as in the database.
    await expect(
      scope.invitations.insert(invitation({ householdId: HH_MAIN, tokenHash: 'hash-main' })),
    ).rejects.toThrow(/duplicate token_hash/);
  });

  it('T-PLAT-016: activity is append-only, scoped per call, and records what was written', async () => {
    const scope = inMemoryActivity();
    const event = (householdId: string, id: string, occurredAt: string): ActivityEvent => ({
      id,
      householdId,
      type: 'CHORE_COMPLETED',
      entity: { kind: 'chore_occurrence', id: `occ-${id}` },
      summary: 'Chore completed',
      occurredAt,
      retainUntil: '2027-10-05T00:00:00.000Z',
    });

    await scope.activity.append(HH_MAIN, event(HH_MAIN, 'ev-1', '2026-10-05T01:00:00.000Z'));
    await scope.activity.append(HH_MAIN, event(HH_MAIN, 'ev-2', '2026-10-05T02:00:00.000Z'));
    await scope.activity.append(HH_CONTROL, event(HH_CONTROL, 'ev-3', '2026-10-05T03:00:00.000Z'));

    // An event scoped to another household is refused: the invariant is per call (I-ACT-001).
    await expect(
      scope.activity.append(HH_MAIN, event(HH_CONTROL, 'ev-4', '2026-10-05T04:00:00.000Z')),
    ).rejects.toThrow(/another household/);

    const page = await scope.activity.list(HH_MAIN, { limit: 10 });
    expect(page.events.map((entry) => entry.id)).toEqual(['ev-2', 'ev-1']); // newest first
    expect(page.nextCursor).toBeUndefined();
    const single = await scope.activity.list(HH_MAIN, { limit: 1 });
    expect(single.events.map((entry) => entry.id)).toEqual(['ev-2']);
    expect(single.nextCursor).toBe('ev-2');
    expect(await scope.activity.list(HH_CONTROL, { limit: 10 })).toMatchObject({ events: [{ id: 'ev-3' }] });
    expect(await scope.activity.listForEntity(HH_MAIN, 'chore_occurrence', 'occ-ev-1', 10)).toHaveLength(1);
    expect(scope.calls.callsTo('activity.append')).toHaveLength(4); // including the refused one
    expect(await scope.activity.pruneBefore(HH_MAIN, '2026-10-05T01:30:00.000Z', 10)).toBe(1);
    expect(scope.events.map((entry) => entry.id)).toEqual(['ev-2', 'ev-3']);
  });

  it('T-PLAT-016: idempotency replays the original outcome and reports an in-flight double submit', async () => {
    const platform = inMemoryPlatform();
    const now = new Date('2026-10-05T00:00:00.000Z');
    const begin = { householdId: HH_MAIN, clientRequestId: 'req-1', operation: 'chore.complete', now };

    expect(await platform.idempotency.begin(begin)).toEqual({ status: 'NEW' });
    // A second submit before commit is a double-tap across tabs: CONFLICT, not a second write.
    expect(await platform.idempotency.begin(begin)).toEqual({ status: 'IN_FLIGHT' });
    await platform.idempotency.commit({
      householdId: HH_MAIN,
      clientRequestId: 'req-1',
      operation: 'chore.complete',
      entityKind: 'chore_occurrence',
      entityId: 'occ-1',
      expiresAt: new Date('2026-10-06T00:00:00.000Z'),
    });
    expect(await platform.idempotency.begin(begin)).toEqual({
      status: 'REPLAY',
      entityKind: 'chore_occurrence',
      entityId: 'occ-1',
    });
    // After the TTL the key is gone: pruning removes it and a fresh begin is NEW again.
    expect(await platform.idempotency.pruneExpired(new Date('2026-10-07T00:00:00.000Z'))).toBe(1);
    expect(await platform.idempotency.begin(begin)).toEqual({ status: 'NEW' });
  });

  it('T-PLAT-016 / T-PLAT-025: rate-limit windows roll over on the injected clock', async () => {
    const platform = inMemoryPlatform();
    const windowStart = new Date('2026-10-05T00:00:00.000Z');
    // CRON_TRIGGER_PER_JOB is 6 per hour (SECURITY.md §8).
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const decision = await platform.rateLimits.consume({
        cls: 'CRON_TRIGGER_PER_JOB',
        scope: 'job:prune-activity',
        now: windowStart,
      });
      expect(decision.allowed, `attempt ${attempt}`).toBe(true);
      expect(decision.remaining).toBe(6 - attempt);
    }
    const refused = await platform.rateLimits.consume({
      cls: 'CRON_TRIGGER_PER_JOB',
      scope: 'job:prune-activity',
      now: windowStart,
    });
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBe(3600);
    // A different scope has its own window; the next window resets the counter.
    expect(
      (await platform.rateLimits.peek({ cls: 'CRON_TRIGGER_PER_JOB', scope: 'job:other', now: windowStart }))
        .allowed,
    ).toBe(true);
    const nextWindow = new Date(windowStart.getTime() + 3_600_000);
    expect(
      (
        await platform.rateLimits.consume({
          cls: 'CRON_TRIGGER_PER_JOB',
          scope: 'job:prune-activity',
          now: nextWindow,
        })
      ).allowed,
    ).toBe(true);
    expect(scopeCalls(platform).filter((call) => call.method === 'rateLimits.consume').length).toBe(8);
  });

  it('T-PLAT-016 / T-PLAT-012: the outbox double dedupes, retries with backoff, and dead-letters', async () => {
    const platform = inMemoryPlatform();
    const now = new Date('2026-10-05T00:00:00.000Z');
    const message = {
      id: 'msg-1',
      householdId: HH_MAIN,
      dedupeKey: 'alert:1:push',
      topic: 'alert.created' as const,
      payload: { alertId: 'al-1' },
    };

    await platform.outbox.enqueue({ ...message, nextAttemptAt: now });
    // A retried transaction re-enqueues the same dedupe key: a no-op, not a second delivery.
    await platform.outbox.enqueue({ ...message, nextAttemptAt: now });
    expect(platform.outboxRows()).toHaveLength(1);
    expect(await platform.outbox.counts()).toEqual({ pending: 1, dead: 0 });

    const claimed = await platform.outbox.claimDue({ now, limit: 10 });
    expect(claimed).toHaveLength(1);
    expect(await platform.outbox.claimDue({ now, limit: 10 })).toHaveLength(0); // claimed rows are PROCESSING

    await platform.outbox.markFailed({
      id: 'msg-1',
      now,
      errorClass: 'PUSH_PROVIDER_UNAVAILABLE',
      retryInMs: 60_000,
    });
    expect(await platform.outbox.claimDue({ now, limit: 10 })).toHaveLength(0); // not due yet
    expect(await platform.outbox.claimDue({ now: new Date(now.getTime() + 60_000), limit: 10 })).toHaveLength(
      1,
    );

    await platform.outbox.markDead({ id: 'msg-1', now, errorClass: 'PUSH_PROVIDER_UNAVAILABLE' });
    expect(await platform.outbox.counts()).toEqual({ pending: 0, dead: 1 });

    await platform.outbox.enqueue({
      id: 'msg-2',
      householdId: HH_MAIN,
      dedupeKey: 'alert:2:push',
      topic: 'alert.updated',
      payload: {},
      nextAttemptAt: now,
    });
    await platform.outbox.claimDue({ now, limit: 10 });
    await platform.outbox.markProcessed('msg-2', now);
    expect(await platform.outbox.pruneProcessed(new Date(now.getTime() + 1000))).toBe(1);
    expect(platform.outboxRows().map((row) => row.id)).toEqual(['msg-1']);
  });
});

function scopeCalls(platform: ReturnType<typeof inMemoryPlatform>) {
  return platform.calls.calls;
}

describe('the test clock never reads the wall clock', () => {
  it('T-PLAT-016 / I-XA-005: a frozen clock stays frozen until a test moves it', () => {
    const clock = testClock(JAKARTA_NO_DST);
    const day = createHouseholdDay(clock, 'Asia/Jakarta');
    expect(clock.now()).toBe(JAKARTA_NO_DST);
    expect(day.today()).toBe('2026-10-05');

    clock.advance(60_000);
    expect(clock.now()).toBe('2026-10-04T18:01:00.000Z');
    expect(day.today()).toBe('2026-10-05');

    // Advancing by a civil day keeps the wall-clock reading stable across a DST transition.
    const berlin = createHouseholdDay(testClock(BERLIN_DST_FORWARD_02_30), 'Europe/Berlin');
    expect(berlin.today()).toBe('2026-03-29');

    // An anchor *before* the transition (01:30 CET) crosses the 23-hour day: the civil date moves by
    // one, the wall clock stays 01:30, and only 23 h of real time pass.
    const beforeGap = testClock(BERLIN_DST_FORWARD_01_30);
    beforeGap.advanceDays(1, 'Europe/Berlin');
    expect(beforeGap.now()).toBe('2026-03-29T23:30:00.000Z'); // 01:30 CEST on the 30th
    expect(Date.parse(beforeGap.now()) - Date.parse(BERLIN_DST_FORWARD_01_30)).toBe(23 * 3_600_000);

    // An anchor *after* the transition (03:00 CEST) is already in summer time, so a civil day is a
    // full 24 h: the difference depends on where the anchor sits, not on the calendar.
    const afterGap = testClock(BERLIN_DST_FORWARD_02_30);
    afterGap.advanceDays(1, 'Europe/Berlin');
    expect(createHouseholdDay(afterGap, 'Europe/Berlin').today()).toBe('2026-03-30');
    expect(Date.parse(afterGap.now()) - Date.parse(BERLIN_DST_FORWARD_02_30)).toBe(24 * 3_600_000);
  });

  it('T-PLAT-016: named DST instants mean what their names say', () => {
    // The gap instant resolves to 03:00 CEST — the first valid reading at or after 02:30.
    const berlin = createHouseholdDay(testClock(BERLIN_DST_FORWARD_02_30), 'Europe/Berlin');
    expect(berlin.startOfDay(BERLIN_DST_FORWARD_02_30)).toBe('2026-03-28T23:00:00.000Z');
    const jakarta = createHouseholdDay(testClock(JAKARTA_NO_DST), 'Asia/Jakarta');
    expect(jakarta.localDate(JAKARTA_NO_DST)).toBe('2026-10-05');
  });
});
