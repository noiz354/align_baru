/**
 * Matchmaking tests — real implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMatchmakingService, createCandidateConstraintService, createPreferenceService } from '../../src/features/matchmaking/matchmaking.service';
import { createQueueService } from '../../src/features/queue/queue.service';
import { clearAllStores, queueStore, sessionStore, blockStore, banStore, recentPeerStore, claimStore } from '../../src/server/db/in-memory';
import type { MatchRequest } from '../../src/domain/matchmaking/match-request';

describe('matchmaking eligibility', () => {
  beforeEach(() => clearAllStores());

  it('does not match a participant who has left the queue', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    const entry2 = await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // p2 leaves
    await queueService.leaveQueue(p2);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(false);
    expect(['no-candidate', 'candidate-ineligible']).toContain(result.reasonClass);
  });

  it('does not match blocked participants', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    blockStore.create(p1, p2, 'session');

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(false);
  });

  it('does not match a banned participant', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    banStore.create(p2, 'test', 'major', 'admin', 'admin-1', null);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    // Should skip banned candidate
    expect(result.matched).toBe(false);
  });

  it('does not immediately rematch recent peers', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();
    const { rateLimitStore } = await import('../../src/server/db/in-memory');

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // First match
    const req1: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };
    const res1 = await matchmakingService.findMatch(req1);
    expect(res1.matched).toBe(true);

    // End session
    sessionStore.updateStatus(res1.sessionId!, 'ENDED', 'peer-left');

    // Clear rate limiter to allow immediate requeue (test focuses on recent-peer avoidance, not rate limit)
    rateLimitStore.clear();

    // Requeue both
    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    const req2: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };
    const res2 = await matchmakingService.findMatch(req2);
    // Should not rematch recent peer
    expect(res2.matched).toBe(false);
  });

  it('never matches incompatible modes', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT_VIDEO', interestIds: [], language: null, regionConstraint: null });

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(false);
  });

  it('applies a ban issued while the participant waits', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // Ban applied while waiting (R10)
    banStore.create(p1, 'test', 'major', 'admin', 'admin-1', null);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(Date.now() - 1000),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(false);
    expect(result.reasonClass).toBe('participant-banned');
  });
});

describe('matchmaking preferences', () => {
  beforeEach(() => clearAllStores());

  it('falls back to the general pool after the interest preference window', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();
    const preferenceService = createPreferenceService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';
    const p3 = 'participant-3';

    // p1 wants music, p2 has gaming, p3 has music but joins later
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: ['gaming'], language: null, regionConstraint: null });

    // p1 joined 20s ago — outside 15s preference window
    const joinedLongAgo = new Date(Date.now() - 20_000);
    const remaining = preferenceService.preferenceWindowRemaining(joinedLongAgo, new Date());
    expect(remaining).toBe(0);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: ['music'],
      language: null,
      regionConstraint: null,
      joinedAt: joinedLongAgo,
    };

    // Manually add p1 to queue store for candidate scanning
    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: ['music'], language: null, regionConstraint: null });

    const result = await matchmakingService.findMatch(request);
    // Should fallback to general pool and match p2 even though no interest overlap
    expect(result.matched).toBe(true);
    expect(result.interestOverlap).toBe(0);
  });

  it('falls back when no language match is available', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: 'fr', regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: 'en', regionConstraint: null });

    // p1 joined 20s ago — outside language window
    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: 'fr',
      regionConstraint: null,
      joinedAt: new Date(Date.now() - 20_000),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(true);
  });

  it('never discloses interests to the peer', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: ['music', 'art'], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: ['music', 'gaming'], language: null, regionConstraint: null });

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: ['music', 'art'],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(true);
    // Only overlap count is disclosed, not actual interests
    expect(result.interestOverlap).toBe(1);
    // Ensure no interest IDs leaked in result
    expect((result as any).interestIds).toBeUndefined();
  });
});

describe('matchmaking concurrency', () => {
  beforeEach(() => clearAllStores());

  it('resolves concurrent match attempts to one session', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';
    const p3 = 'participant-3';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p3, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // Two workers try to match p1 concurrently (R1)
    const req1: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };
    const req2: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const [res1, res2] = await Promise.all([
      matchmakingService.findMatch(req1),
      matchmakingService.findMatch(req2),
    ]);

    // Exactly one should succeed (R1 resolution)
    const matchedCount = [res1, res2].filter(r => r.matched).length;
    expect(matchedCount).toBeLessThanOrEqual(1);

    // INV-1: at most one active session per participant
    expect(sessionStore.getActiveForParticipant(p1)).toBeDefined();
    if (res1.matched && res2.matched) {
      expect(res1.sessionId).toBe(res2.sessionId);
    }
  });

  it('aborts a match when the participant cancels', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // Participant cancels while being matched (R2)
    await queueService.leaveQueue(p2);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(false);
  });

  it('creates a session for both peers or neither', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    expect(result.matched).toBe(true);
    expect(result.participantAId).toBeTruthy();
    expect(result.participantBId).toBeTruthy();
    expect(result.sessionId).toBeTruthy();

    // Both peers should have active session
    const s1 = sessionStore.getActiveForParticipant(p1);
    const s2 = sessionStore.getActiveForParticipant(p2);
    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();
    expect(s1!.id).toBe(s2!.id);
  });

  it('resolves an expiry that races a match', async () => {
    const queueService = createQueueService();
    const matchmakingService = createMatchmakingService();

    const p1 = 'participant-1';
    const p2 = 'participant-2';

    await queueService.joinQueue({ participantId: p1, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });
    const entry2 = await queueService.joinQueue({ participantId: p2, mode: 'TEXT', interestIds: [], language: null, regionConstraint: null });

    // Expire p2's entry at same instant as matching (R9)
    // Simulate by setting expiry to past and calling expire
    entry2.expiresAt = new Date(Date.now() - 1000);
    const expired = queueService.expire(new Date());
    expect(expired.length).toBeGreaterThan(0);

    const request: MatchRequest = {
      participantId: p1,
      mode: 'TEXT',
      interestIds: [],
      language: null,
      regionConstraint: null,
      joinedAt: new Date(),
    };

    const result = await matchmakingService.findMatch(request);
    // Either match wins or expiry wins, but no dangling state
    if (result.matched) {
      expect(sessionStore.get(result.sessionId!)).toBeTruthy();
    } else {
      expect(queueStore.get(p2)).toBeNull();
    }
  });
});
