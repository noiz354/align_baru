/**
 * Reports tests — real implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReportsService, createReportCredibilityService } from '../../src/features/reports/reports.service';
import { clearAllStores, sessionStore, reportStore, banStore, safetyEventStore } from '../../src/server/db/in-memory';
import { generateId } from '../../src/shared/utils/id';

describe('report submission', () => {
  beforeEach(() => clearAllStores());

  it('accepts a report against a terminal session', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ENDED', 'peer-left');

    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: 'test',
    });

    expect(ack.received).toBe(true);
    expect(ack.reportId).toBeTruthy();
  });

  it('rejects an unknown category', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    await expect(
      reportsService.submitReport(p1, {
        sessionId: session.id,
        category: 'invalid-category' as any,
        note: null,
      }),
    ).rejects.toThrow('VALIDATION_FAILED');
  });

  it('captures exactly the documented fields', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'spam',
      note: 'spam note',
    });

    const report = reportStore.get(ack.reportId);
    expect(report).toBeTruthy();
    expect(report!.sessionId).toBe(session.id);
    expect(report!.reporterIdentityId).toBe(p1);
    expect(report!.peerIdentityId).toBe(p2);
    expect(report!.category).toBe('spam');
    expect(report!.note).toBe('spam note');
    expect(report!.dedupKey).toBe(`${session.id}:spam`);
    // No name, email, phone, etc.
    expect((report as any).name).toBeUndefined();
    expect((report as any).email).toBeUndefined();
    expect((report as any).phone).toBeUndefined();
  });

  it('does not collect name, email, or phone', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: 'test',
    });

    const report = reportStore.get(ack.reportId)!;
    const forbidden = ['name', 'email', 'phone', 'account', 'location', 'fingerprint'];
    for (const key of forbidden) {
      expect((report as any)[key]).toBeUndefined();
    }
  });

  it('collapses a duplicate report', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    const ack1 = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'spam',
      note: 'first',
    });
    const ack2 = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'spam',
      note: 'second',
    });

    expect(ack1.reportId).toBe(ack2.reportId);
    expect(reportStore.all().length).toBe(1);
  });

  it('rate limits report submission', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();

    // Create 6 distinct sessions, each ended immediately after creation except last,
    // to avoid INV-1 while still testing report rate limiting (reports allowed on terminal sessions)
    const sessions: any[] = [];
    for (let i = 0; i < 6; i++) {
      const p2 = generateId();
      const s = sessionStore.create(p1, p2, 'TEXT', null);
      sessionStore.updateStatus(s.id, 'ENDED', 'peer-left');
      sessions.push(s);
    }

    // 5 reports should succeed, 6th should be rate limited
    for (let i = 0; i < 5; i++) {
      await reportsService.submitReport(p1, {
        sessionId: sessions[i].id,
        category: 'spam',
        note: null,
      });
    }

    await expect(
      reportsService.submitReport(p1, {
        sessionId: sessions[5].id,
        category: 'spam',
        note: null,
      }),
    ).rejects.toThrow('RATE_LIMITED');
  });

  it('returns acknowledgement without moderation reasoning', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: null,
    });

    expect(ack.received).toBe(true);
    expect((ack as any).reasoning).toBeUndefined();
    expect((ack as any).outcome).toBeUndefined();
    expect((ack as any).timeline).toBeUndefined();
  });

  it('accepts a report from a banned identity', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    banStore.create(p1, 'test', 'major', 'admin', 'admin-1', null);

    const ack = await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: null,
    });

    expect(ack.received).toBe(true);
  });
});

describe('report routing', () => {
  beforeEach(() => clearAllStores());

  it('routes a minor-safety report to the P0 queue', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'minor-safety',
      note: null,
    });

    const p0Events = safetyEventStore.all().filter(e => e.type === 'escalation-raised');
    expect(p0Events.length).toBeGreaterThan(0);
    const report = reportStore.all()[0];
    expect(report.severity).toBe('P0');
  });

  it('assigns P1 to harassment', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: null,
    });

    const report = reportStore.all()[0];
    expect(report.severity).toBe('P1');
  });

  it('assigns P2 to spam', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'spam',
      note: null,
    });

    const report = reportStore.all()[0];
    expect(report.severity).toBe('P2');
  });
});

describe('report credibility', () => {
  beforeEach(() => clearAllStores());

  it('down-weights reports from an identity reporting many peers', async () => {
    const reportsService = createReportsService();
    const credibilityService = createReportCredibilityService();
    const p1 = generateId();

    // Report 11 distinct peers — need to handle INV-1
    for (let i = 0; i < 11; i++) {
      const p2 = generateId();
      const s = sessionStore.create(p1, p2, 'TEXT', null);
      sessionStore.updateStatus(s.id, 'ACTIVE', null);
      // Clear rate limit for test
      const { rateLimitStore, sessionStore: ss } = await import('../../src/server/db/in-memory');
      rateLimitStore.clear();
      await reportsService.submitReport(p1, {
        sessionId: s.id,
        category: 'spam',
        note: null,
      });
      // End session to allow next creation (INV-1)
      try { ss.updateStatus(s.id, 'ENDED', 'peer-left'); } catch {}
    }

    const weight = await credibilityService.weightFor(p1);
    expect(weight).toBeLessThan(1.0);
    expect(weight).toBe(0.2);
  });

  it('never auto-actions a report into a ban', async () => {
    const reportsService = createReportsService();
    const p1 = generateId();
    const p2 = generateId();
    const session = sessionStore.create(p1, p2, 'TEXT', null);
    sessionStore.updateStatus(session.id, 'ACTIVE', null);

    await reportsService.submitReport(p1, {
      sessionId: session.id,
      category: 'harassment',
      note: null,
    });

    // No ban should be created automatically
    expect(banStore.isBanned(p2)).toBe(false);
  });
});
