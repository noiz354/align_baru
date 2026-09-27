import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURES, isDatabaseAvailable, resetFixtures, withScratchDatabase } from '../../helpers/db';
import { getDb, getSql } from '../../../src/server/db/client';
import { withTransaction } from '../../../src/server/db/unit-of-work';
import {
  createIdempotencyStore,
  createOutboxStore,
  createRateLimitStore,
} from '../../../src/server/db/repositories/platform';
import { RATE_LIMIT_CLASSES } from '../../../src/shared/contracts/rate-limit';
import { IDEMPOTENCY_TTL_HOURS } from '../../../src/shared/contracts/idempotency';
import { newId } from '../../../src/server/db/id';

// T-PLAT-025 (rate-limit store) and T-PLAT-012 (outbox) against a real Postgres: window roll-over,
// multi-instance safety, transactional enqueue visibility, dedupe, backoff and dead-lettering are
// properties of the database, not of the code that calls it (SECURITY.md §8, ADR-009, ADR-013).

const WINDOW_START = new Date('2026-10-05T00:00:00.000Z');

describe.skipIf(!isDatabaseAvailable())('platform primitives (T-PLAT-025, T-PLAT-012)', () => {
  beforeEach(async () => {
    await withScratchDatabase(async () => resetFixtures());
  });

  describe('rate limiting', () => {
    it('T-PLAT-025 NFR-SEC-005: a window admits exactly `limit` attempts, then refuses with retry-after', async () => {
      await withScratchDatabase(async () => {
        const store = createRateLimitStore(getDb());
        const limit = RATE_LIMIT_CLASSES.AUTH_SIGN_IN_ACCOUNT.limit; // 5 per 15 minutes
        for (let attempt = 1; attempt <= limit; attempt += 1) {
          const decision = await store.consume({
            cls: 'AUTH_SIGN_IN_ACCOUNT',
            scope: 'user-1',
            now: WINDOW_START,
          });
          expect(decision.allowed, `attempt ${attempt}`).toBe(true);
          expect(decision.remaining).toBe(limit - attempt);
        }
        const refused = await store.consume({
          cls: 'AUTH_SIGN_IN_ACCOUNT',
          scope: 'user-1',
          now: WINDOW_START,
        });
        expect(refused.allowed).toBe(false);
        expect(refused.remaining).toBe(0);
        // The copy never discloses the threshold, but the header needs a real number (SECURITY.md §8).
        expect(refused.retryAfterSeconds).toBe(15 * 60);
        // `peek` reads without consuming: the honest "try again in N minutes" surface.
        expect(
          await store.peek({ cls: 'AUTH_SIGN_IN_ACCOUNT', scope: 'user-1', now: WINDOW_START }),
        ).toMatchObject({
          allowed: false,
          remaining: 0,
        });
      });
    });

    it('T-PLAT-025: windows roll over on the clock, and each class/scope has its own counter', async () => {
      await withScratchDatabase(async () => {
        const store = createRateLimitStore(getDb());
        const limit = RATE_LIMIT_CLASSES.AUTH_SIGN_IN_ACCOUNT.limit;
        for (let attempt = 0; attempt < limit; attempt += 1) {
          await store.consume({ cls: 'AUTH_SIGN_IN_ACCOUNT', scope: 'user-1', now: WINDOW_START });
        }
        // A different scope is unaffected; a different class on the same scope is unaffected.
        expect(
          (await store.consume({ cls: 'AUTH_SIGN_IN_ACCOUNT', scope: 'user-2', now: WINDOW_START })).allowed,
        ).toBe(true);
        expect(
          (await store.consume({ cls: 'AUTH_SIGN_IN_IP', scope: 'user-1', now: WINDOW_START })).allowed,
        ).toBe(true);
        // The next window (15 minutes later) starts from zero.
        const nextWindow = new Date(WINDOW_START.getTime() + 15 * 60_000);
        const decision = await store.consume({
          cls: 'AUTH_SIGN_IN_ACCOUNT',
          scope: 'user-1',
          now: nextWindow,
        });
        expect(decision).toMatchObject({ allowed: true, remaining: limit - 1 });
        // The expired bucket is prunable (T-PLAT-013 keeps the table bounded).
        expect(await store.pruneExpired(new Date(nextWindow.getTime() + 15 * 60_000))).toBeGreaterThan(0);
      });
    });

    it('T-PLAT-025: concurrent consumes never admit more than the limit (multi-instance safety)', async () => {
      await withScratchDatabase(async () => {
        const limit = RATE_LIMIT_CLASSES.MUTATION_MEMBER.limit; // 120 per minute
        const bursts = Array.from({ length: limit + 25 }, (_, index) =>
          withTransaction(async (tx) =>
            createRateLimitStore(tx).consume({
              cls: 'MUTATION_MEMBER',
              scope: 'member-1',
              now: new Date(WINDOW_START.getTime() + index),
            }),
          ),
        );
        const decisions = await Promise.all(bursts);
        expect(decisions.filter((decision) => decision.allowed)).toHaveLength(limit);
        expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(25);
      });
    });

    it('T-PLAT-025 PRIVACY: bucket keys are hashed — no email, ip or member id is stored', async () => {
      await withScratchDatabase(async () => {
        const sql = getSql();
        const store = createRateLimitStore(getDb());
        const scope = 'member@sarli.example|203.0.113.7';
        await store.consume({ cls: 'AUTH_SIGN_IN_IP', scope, now: WINDOW_START });
        const rows = await sql`select bucket_key from rate_limit_bucket`;
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          const key = String(row.bucket_key);
          expect(key).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
          expect(key).not.toContain('member');
          expect(key).not.toContain('203.0.113');
        }
      });
    });
  });

  describe('idempotency', () => {
    it('T-PLAT-012 AP-8: begin is NEW, an uncommitted retry is IN_FLIGHT, a committed retry replays', async () => {
      await withScratchDatabase(async () => {
        const householdId = FIXTURES.HH_MAIN.id;
        const clientRequestId = newId();
        const store = createIdempotencyStore(getDb());

        expect(
          await store.begin({ householdId, clientRequestId, operation: 'chore.complete', now: WINDOW_START }),
        ).toEqual({
          status: 'NEW',
        });
        // A double submit before commit: CONFLICT rather than a second write.
        expect(
          await store.begin({ householdId, clientRequestId, operation: 'chore.complete', now: WINDOW_START }),
        ).toEqual({
          status: 'IN_FLIGHT',
        });

        const expiresAt = new Date(WINDOW_START.getTime() + IDEMPOTENCY_TTL_HOURS * 3_600_000);
        await store.commit({
          householdId,
          clientRequestId,
          operation: 'chore.complete',
          entityKind: 'chore_occurrence',
          entityId: 'occ-1',
          expiresAt,
        });
        expect(
          await store.begin({ householdId, clientRequestId, operation: 'chore.complete', now: WINDOW_START }),
        ).toEqual({
          status: 'REPLAY',
          entityKind: 'chore_occurrence',
          entityId: 'occ-1',
        });
        // Another household's key is a different key: replay never crosses the tenancy boundary.
        expect(
          await store.begin({
            householdId: FIXTURES.HH_CONTROL.id,
            clientRequestId,
            operation: 'chore.complete',
            now: WINDOW_START,
          }),
        ).toEqual({ status: 'NEW' });
        // After the TTL the key is pruned and the operation may run again.
        expect(await store.pruneExpired(new Date(expiresAt.getTime() + 1000))).toBe(1);
        expect(
          await store.begin({ householdId, clientRequestId, operation: 'chore.complete', now: WINDOW_START }),
        ).toEqual({
          status: 'NEW',
        });
      });
    });
  });

  describe('transactional outbox', () => {
    it('T-PLAT-012 I-XA-007: an enqueue is visible only after its transaction commits', async () => {
      await withScratchDatabase(async () => {
        const sql = getSql();
        const householdId = FIXTURES.HH_MAIN.id;
        const dedupeKey = `alert:${newId()}:push`;

        // A rolled-back write must leave no outbox row: delivery follows state, never intention.
        await expect(
          getDb().transaction(async (tx) => {
            await createOutboxStore(tx).enqueue({
              id: newId(),
              householdId,
              dedupeKey,
              topic: 'alert.created',
              payload: { alertId: 'al-1' },
              nextAttemptAt: WINDOW_START,
            });
            throw new Error('rollback on purpose');
          }),
        ).rejects.toThrow(/rollback on purpose/);

        const afterRollback =
          await sql`select count(*)::int as n from outbox_message where dedupe_key = ${dedupeKey}`;
        expect(afterRollback[0]?.n).toBe(0);

        await withTransaction(async (tx) => {
          await createOutboxStore(tx).enqueue({
            id: newId(),
            householdId,
            dedupeKey,
            topic: 'alert.created',
            payload: { alertId: 'al-1' },
            nextAttemptAt: WINDOW_START,
          });
        });
        const afterCommit =
          await sql`select count(*)::int as n from outbox_message where dedupe_key = ${dedupeKey}`;
        expect(afterCommit[0]?.n).toBe(1);
      });
    });

    it('T-PLAT-012: a duplicate dedupe key is a no-op, and claims are disjoint under concurrency', async () => {
      await withScratchDatabase(async () => {
        const householdId = FIXTURES.HH_MAIN.id;
        await withTransaction(async (tx) => {
          const store = createOutboxStore(tx);
          for (let index = 0; index < 5; index += 1) {
            await store.enqueue({
              id: newId(),
              householdId,
              dedupeKey: `dedupe-shared`,
              topic: 'alert.created',
              payload: { alertId: `al-${index}` },
              nextAttemptAt: WINDOW_START,
            });
          }
        });
        const store = createOutboxStore(getDb());
        const counts = await store.counts();
        expect(counts).toEqual({ pending: 1, dead: 0 }); // five enqueues, one row

        // Two instances draining at once must not deliver the same message twice (FINAL-REVIEW §4).
        for (let index = 0; index < 10; index += 1) {
          await withTransaction(async (tx) => {
            await createOutboxStore(tx).enqueue({
              id: newId(),
              householdId,
              dedupeKey: `bulk-${index}`,
              topic: 'alert.updated',
              payload: { alertId: `al-${index}` },
              nextAttemptAt: WINDOW_START,
            });
          });
        }
        const claims = await Promise.all([
          withTransaction((tx) => createOutboxStore(tx).claimDue({ now: WINDOW_START, limit: 6 })),
          withTransaction((tx) => createOutboxStore(tx).claimDue({ now: WINDOW_START, limit: 6 })),
        ]);
        const claimedIds = claims.flat().map((message) => message.id);
        expect(new Set(claimedIds).size).toBe(claimedIds.length); // no overlap
        expect(claimedIds.length).toBeLessThanOrEqual(11);
      });
    });

    it('T-PLAT-012 ADR-009: retry with backoff, dead-letter, and pruning of processed rows', async () => {
      await withScratchDatabase(async () => {
        const householdId = FIXTURES.HH_MAIN.id;
        const id = newId();
        await withTransaction(async (tx) => {
          await createOutboxStore(tx).enqueue({
            id,
            householdId,
            dedupeKey: `backoff-${id}`,
            topic: 'invitation.created',
            payload: { invitationId: 'inv-1' },
            nextAttemptAt: WINDOW_START,
          });
        });
        const store = createOutboxStore(getDb());

        const [claimed] = await withTransaction((tx) =>
          createOutboxStore(tx).claimDue({ now: WINDOW_START, limit: 1 }),
        );
        expect(claimed?.id).toBe(id);
        expect(claimed?.attempts).toBe(1);

        // Failure schedules a retry; the row is not claimable before it is due.
        await store.markFailed({
          id,
          now: WINDOW_START,
          errorClass: 'PUSH_PROVIDER_UNAVAILABLE',
          retryInMs: 60_000,
        });
        expect(
          await withTransaction((tx) => createOutboxStore(tx).claimDue({ now: WINDOW_START, limit: 5 })),
        ).toEqual([]);
        const retried = await withTransaction((tx) =>
          createOutboxStore(tx).claimDue({ now: new Date(WINDOW_START.getTime() + 60_000), limit: 5 }),
        );
        expect(retried.map((message) => message.id)).toContain(id);

        await store.markDead({ id, now: WINDOW_START, errorClass: 'PUSH_PROVIDER_UNAVAILABLE' });
        expect(await store.counts()).toMatchObject({ dead: 1 });

        // Processed rows are prunable; dead letters are not (they need an operator, RUNBOOK §4).
        const processedId = newId();
        await withTransaction(async (tx) => {
          await createOutboxStore(tx).enqueue({
            id: processedId,
            householdId,
            dedupeKey: `processed-${processedId}`,
            topic: 'member.removed',
            payload: { memberId: 'mem-1' },
            nextAttemptAt: WINDOW_START,
          });
        });
        await withTransaction((tx) => createOutboxStore(tx).claimDue({ now: WINDOW_START, limit: 5 }));
        await store.markProcessed(processedId, WINDOW_START);
        expect(await store.pruneProcessed(new Date(WINDOW_START.getTime() + 1000))).toBe(1);
        expect(await store.pruneProcessed(new Date(WINDOW_START.getTime() + 2000))).toBe(0);
        expect((await store.counts()).dead).toBe(1);
      });
    });
  });
});
