/**
 * Ban enforcement tests — real implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores, banStore, sessionStore, queueStore } from '../../src/server/db/in-memory';
import { createBanEnforcementPort } from '../../src/server/moderation/moderation.service';
import { createQueueService } from '../../src/features/queue/queue.service';
import { createReportsService } from '../../src/features/reports/reports.service';
import { generateId } from '../../src/shared/utils/id';

describe('ban enforcement', () => {
  beforeEach(() => clearAllStores());

  it('refuses a banned identity at every entry point', async () => {
    const banEnforcement = createBanEnforcementPort();
    const queueService = createQueueService();
    const p1 = generateId();

    banStore.create(p1, 'test-ban', 'major', 'admin', 'admin-1', null);

    // Queue join
    await expect(
      queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null }),
    ).rejects.toThrow('RESTRICTED');

    // Candidate selection
    await expect(banEnforcement.assertNotBanned(p1, 'candidate-selection')).rejects.toThrow('RESTRICTED');

    // Session creation — already prevented by ban, but test enforcement point
    await expect(banEnforcement.assertNotBanned(p1, 'session-creation')).rejects.toThrow('RESTRICTED');

    // WebSocket connect
    await expect(banEnforcement.assertNotBanned(p1, 'websocket-connect')).rejects.toThrow('RESTRICTED');

    // TURN credential mint
    await expect(banEnforcement.assertNotBanned(p1, 'turn-credential-mint')).rejects.toThrow('RESTRICTED');

    // isBanned should be true
    expect(await banEnforcement.isBanned(p1)).toBe(true);
  });

  it('fails closed when the ban store is unreachable', async () => {
    const banEnforcement = createBanEnforcementPort();
    const p1 = generateId();

    // Simulate store failure by throwing in isBanned
    const originalIsBanned = banStore.isBanned;
    banStore.isBanned = () => { throw new Error('DB unreachable'); };

    // Should fail closed — treat as banned
    expect(await banEnforcement.isBanned(p1)).toBe(true);

    await expect(banEnforcement.assertNotBanned(p1, 'queue-join')).rejects.toThrow('fail closed');

    // Restore
    banStore.isBanned = originalIsBanned;
  });

  it('still allows a banned identity to submit a report', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    banStore.create(p1, 'test', 'major', 'admin', 'admin-1', null);

    // Banned user can still report (SAFETY.md, MATCHMAKING.md §7)
    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: null,
    });
    expect(ack.received).toBe(true);
  });

  it('expires a bounded ban at its expiry time', async () => {
    const banEnforcement = createBanEnforcementPort();
    const p1 = generateId();

    const expiresAt = new Date(Date.now() + 100); // 100ms
    banStore.create(p1, 'temp-ban', 'minor', 'admin', 'admin-1', expiresAt);

    expect(await banEnforcement.isBanned(p1)).toBe(true);

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(await banEnforcement.isBanned(p1)).toBe(false);
  });
});
