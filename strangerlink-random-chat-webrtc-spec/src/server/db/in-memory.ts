/**
 * In-memory stores for StrangerLink.
 *
 * Requirements:
 * - FR-ENTRY-004, NFR-PRIV-002 (pseudonymous identities)
 * - INV-1 (one active session)
 * - ADR-002 (PostgreSQL for durable, but in-memory for ephemeral)
 * - DATA_MODEL.md
 *
 * This module provides the single source of truth for all in-memory state
 * that must not be persisted durably (queue, connections, active sessions,
 * message buffers) plus a durable-like store for safety records that in
 * production would be PostgreSQL but here is in-memory for testability.
 *
 * All stores are singletons per process, suitable for single-instance
 * realtime service. Multi-instance would require Redis (ADR-003 gate).
 */

import { generateId } from '../../shared/utils/id';
import type { Participant, ParticipantStatus } from '../../domain/participant/participant';
import type { QueueEntry, JoinQueueInput, QueueEntryStatus } from '../../domain/matchmaking/queue-ticket';
import type { ChatSession, SessionStatus } from '../../domain/session/session';
import type { ChatMessage } from '../../domain/session/chat-message';
import type { Report } from '../../domain/reports/report';
import type { ReportCategory } from '../../shared/contracts/signaling';
import type { Ban, ModerationCase, ModerationAction } from '../../domain/moderation/case';
import type { SafetyEvent, SafetyEventType } from '../../domain/safety/safety-event';
import type { ChatMode, SessionEndReason } from '../../shared/contracts/signaling';

// ---------------------------------------------------------------------------
// Participant store
// ---------------------------------------------------------------------------
class ParticipantStore {
  private map = new Map<string, Participant>();

  create(): Participant {
    const now = new Date();
    const p: Participant = {
      id: generateId(),
      status: 'ACTIVE',
      createdAt: now,
      lastSeenAt: now,
    };
    this.map.set(p.id, p);
    return p;
  }

  get(id: string): Participant | null {
    return this.map.get(id) ?? null;
  }

  touch(id: string): void {
    const p = this.map.get(id);
    if (p) p.lastSeenAt = new Date();
  }

  setStatus(id: string, status: ParticipantStatus): void {
    const p = this.map.get(id);
    if (p) p.status = status;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

// ---------------------------------------------------------------------------
// Queue store — ephemeral, never PostgreSQL (RETENTION Tier 1)
// ---------------------------------------------------------------------------
export const QUEUE_WAIT_TIMEOUT_MS = 120_000;
export const INTEREST_PREFERENCE_WINDOW_MS = 15_000;

class QueueStore {
  private entries = new Map<string, QueueEntry>(); // participantId -> entry
  private fifo: QueueEntry[] = []; // ordered by joinedAt

  join(input: JoinQueueInput): QueueEntry {
    // Idempotent per participant + queue key (FR-QUEUE-003)
    const existing = this.entries.get(input.participantId);
    if (existing && existing.status === 'WAITING' && existing.mode === input.mode) {
      return existing;
    }
    // If existing with different mode, cancel first
    if (existing) {
      this.leave(input.participantId);
    }
    const now = new Date();
    const entry: QueueEntry = {
      ticketId: generateId(),
      participantId: input.participantId,
      mode: input.mode,
      interestIds: input.interestIds.slice(0, 5),
      language: input.language,
      regionConstraint: input.regionConstraint,
      joinedAt: now,
      expiresAt: new Date(now.getTime() + QUEUE_WAIT_TIMEOUT_MS),
      status: 'WAITING',
    };
    this.entries.set(entry.participantId, entry);
    this.fifo.push(entry);
    return entry;
  }

  leave(participantId: string): QueueEntry | null {
    const entry = this.entries.get(participantId);
    if (!entry) return null;
    entry.status = 'CANCELLED';
    this.entries.delete(participantId);
    this.fifo = this.fifo.filter(e => e.participantId !== participantId);
    return entry;
  }

  get(participantId: string): QueueEntry | null {
    return this.entries.get(participantId) ?? null;
  }

  // For matchmaking: get all waiting entries for a mode, excluding requester
  candidatesFor(mode: ChatMode, excludeParticipantId: string): QueueEntry[] {
    return this.fifo.filter(e => e.mode === mode && e.participantId !== excludeParticipantId && e.status === 'WAITING');
  }

  expire(now: Date): QueueEntry[] {
    const expired: QueueEntry[] = [];
    for (const e of this.fifo.slice()) {
      if (e.expiresAt.getTime() <= now.getTime()) {
        e.status = 'EXPIRED';
        this.entries.delete(e.participantId);
        expired.push(e);
      }
    }
    this.fifo = this.fifo.filter(e => e.status === 'WAITING');
    return expired;
  }

  markMatched(participantId: string): void {
    const e = this.entries.get(participantId);
    if (e) {
      e.status = 'MATCHED';
      this.entries.delete(participantId);
      this.fifo = this.fifo.filter(x => x.participantId !== participantId);
    }
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.fifo = [];
  }
}

// ---------------------------------------------------------------------------
// Claim primitive — single-flight for INV-1 (T-MATCH-021)
// ---------------------------------------------------------------------------
class ClaimStore {
  private claims = new Map<string, string>(); // key -> ownerId

  tryClaim(key: string, ownerId: string): boolean {
    if (this.claims.has(key)) return false;
    this.claims.set(key, ownerId);
    return true;
  }

  release(key: string, ownerId: string): void {
    if (this.claims.get(key) === ownerId) {
      this.claims.delete(key);
    }
  }

  isHeld(key: string): boolean {
    return this.claims.has(key);
  }

  owner(key: string): string | null {
    return this.claims.get(key) ?? null;
  }

  clear(): void {
    this.claims.clear();
  }
}

// ---------------------------------------------------------------------------
// Session store — active in memory, metadata durable (here in-memory)
// ---------------------------------------------------------------------------
class SessionStore {
  private sessions = new Map<string, ChatSession>();
  private activeByParticipant = new Map<string, string>(); // participantId -> sessionId (non-terminal)

  create(participantAId: string, participantBId: string, mode: ChatMode, queueTicketId: string | null): ChatSession {
    if (participantAId === participantBId) {
      throw new Error('INV-2: distinct participants required');
    }
    // INV-1 check
    if (this.activeByParticipant.has(participantAId) || this.activeByParticipant.has(participantBId)) {
      throw new Error('INV-1: participant already in active session');
    }
    const now = new Date();
    const s: ChatSession = {
      id: generateId(),
      participantAId,
      participantBId,
      mode,
      status: 'MATCHED',
      createdAt: now,
      endedAt: null,
      endReason: null,
      durationMs: null,
      queueTicketId,
    };
    this.sessions.set(s.id, s);
    this.activeByParticipant.set(participantAId, s.id);
    this.activeByParticipant.set(participantBId, s.id);
    return s;
  }

  get(id: string): ChatSession | null {
    return this.sessions.get(id) ?? null;
  }

  getActiveForParticipant(participantId: string): ChatSession | null {
    const sid = this.activeByParticipant.get(participantId);
    if (!sid) return null;
    return this.sessions.get(sid) ?? null;
  }

  hasActive(participantId: string): boolean {
    return this.activeByParticipant.has(participantId);
  }

  updateStatus(id: string, status: SessionStatus, endReason: SessionEndReason | null): ChatSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Session not found');
    // INV-4 terminal absorbing
    const terminal: SessionStatus[] = ['ENDED', 'REPORTED', 'BLOCKED', 'FAILED'];
    if (terminal.includes(s.status)) {
      throw new Error(`INV-4: terminal ${s.status} cannot transition to ${status}`);
    }
    s.status = status;
    if (endReason) s.endReason = endReason;
    if (terminal.includes(status)) {
      s.endedAt = new Date();
      s.durationMs = s.endedAt.getTime() - s.createdAt.getTime();
      // release active index
      this.activeByParticipant.delete(s.participantAId);
      this.activeByParticipant.delete(s.participantBId);
    }
    return s;
  }

  // For testing INV-1
  countActive(): number {
    return this.activeByParticipant.size / 2;
  }

  all(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
    this.activeByParticipant.clear();
  }
}

// ---------------------------------------------------------------------------
// Message buffer — ephemeral, never durable (Tier 0)
// ---------------------------------------------------------------------------
class MessageBuffer {
  private buffers = new Map<string, ChatMessage[]>(); // sessionId -> messages
  private seqBySession = new Map<string, number>();

  add(sessionId: string, msg: ChatMessage): void {
    if (!this.buffers.has(sessionId)) this.buffers.set(sessionId, []);
    this.buffers.get(sessionId)!.push(msg);
  }

  get(sessionId: string): ChatMessage[] {
    return this.buffers.get(sessionId) ?? [];
  }

  nextSeq(sessionId: string): number {
    const cur = this.seqBySession.get(sessionId) ?? 0;
    const next = cur + 1;
    this.seqBySession.set(sessionId, next);
    return next;
  }

  clearSession(sessionId: string): void {
    this.buffers.delete(sessionId);
    this.seqBySession.delete(sessionId);
  }

  clear(): void {
    this.buffers.clear();
    this.seqBySession.clear();
  }
}

// ---------------------------------------------------------------------------
// Block store
// ---------------------------------------------------------------------------
interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  scope: 'session' | 'platform';
  createdAt: Date;
  expiresAt: Date | null;
}

class BlockStore {
  private blocks: BlockRecord[] = [];

  create(blockerId: string, blockedId: string, scope: 'session' | 'platform'): BlockRecord {
    const rec: BlockRecord = {
      id: generateId(),
      blockerId,
      blockedId,
      scope,
      createdAt: new Date(),
      expiresAt: scope === 'session' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
    };
    this.blocks.push(rec);
    return rec;
  }

  isBlocked(a: string, b: string): boolean {
    const now = Date.now();
    return this.blocks.some(bl => {
      if (bl.expiresAt && bl.expiresAt.getTime() <= now) return false;
      return (bl.blockerId === a && bl.blockedId === b) || (bl.blockerId === b && bl.blockedId === a);
    });
  }

  isBlockedDirectional(blocker: string, blocked: string): boolean {
    const now = Date.now();
    return this.blocks.some(bl => {
      if (bl.expiresAt && bl.expiresAt.getTime() <= now) return false;
      return bl.blockerId === blocker && bl.blockedId === blocked;
    });
  }

  all(): BlockRecord[] {
    return this.blocks.slice();
  }

  clear(): void {
    this.blocks = [];
  }
}

// ---------------------------------------------------------------------------
// Ban store
// ---------------------------------------------------------------------------
class BanStore {
  private bans = new Map<string, Ban>(); // subjectId -> ban (active)

  create(subjectId: string, reasonCode: string, severity: Ban['severity'], source: Ban['source'], createdBy: string, expiresAt: Date | null): Ban {
    const ban: Ban = {
      id: generateId(),
      subjectType: 'session-identity',
      subjectId,
      severity,
      source,
      reasonCode,
      createdBy,
      createdAt: new Date(),
      expiresAt,
      appealStatus: 'none',
      policyVersion: 1,
    };
    this.bans.set(subjectId, ban);
    return ban;
  }

  isBanned(subjectId: string): boolean {
    const ban = this.bans.get(subjectId);
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt.getTime() <= Date.now()) {
      this.bans.delete(subjectId);
      return false;
    }
    return true;
  }

  get(subjectId: string): Ban | null {
    return this.bans.get(subjectId) ?? null;
  }

  revoke(subjectId: string): void {
    this.bans.delete(subjectId);
  }

  clear(): void {
    this.bans.clear();
  }
}

// ---------------------------------------------------------------------------
// Report store
// ---------------------------------------------------------------------------
class ReportStore {
  private reports = new Map<string, Report>();
  private dedup = new Map<string, string>(); // dedupKey -> reportId

  create(sessionId: string, reporterId: string, peerId: string, category: ReportCategory, note: string | null): { report: Report; isNew: boolean } {
    const dedupKey = `${sessionId}:${category}`;
    const existingId = this.dedup.get(dedupKey);
    if (existingId) {
      const existing = this.reports.get(existingId);
      if (existing) return { report: existing, isNew: false };
    }
    const severity = (['minor-safety', 'illegal-content', 'threats'] as ReportCategory[]).includes(category) ? 'P0' as const : (['harassment', 'sexual-content', 'scam', 'hate'] as ReportCategory[]).includes(category) ? 'P1' as const : 'P2' as const;
    const report: Report = {
      id: generateId(),
      sessionId,
      reporterIdentityId: reporterId,
      peerIdentityId: peerId,
      category,
      severity,
      note: note ? note.slice(0, 1000) : null,
      dedupKey,
      status: 'open',
      createdAt: new Date(),
    };
    this.reports.set(report.id, report);
    this.dedup.set(dedupKey, report.id);
    return { report, isNew: true };
  }

  get(id: string): Report | null {
    return this.reports.get(id) ?? null;
  }

  findByDedup(dedupKey: string): Report | null {
    const id = this.dedup.get(dedupKey);
    if (!id) return null;
    return this.reports.get(id) ?? null;
  }

  findByPeer(peerId: string): Report[] {
    return Array.from(this.reports.values()).filter(r => r.peerIdentityId === peerId);
  }

  findByReporter(reporterId: string): Report[] {
    return Array.from(this.reports.values()).filter(r => r.reporterIdentityId === reporterId);
  }

  all(): Report[] {
    return Array.from(this.reports.values());
  }

  clear(): void {
    this.reports.clear();
    this.dedup.clear();
  }
}

// ---------------------------------------------------------------------------
// Safety event store
// ---------------------------------------------------------------------------
class SafetyEventStore {
  private events: SafetyEvent[] = [];

  record(type: SafetyEventType, participantId: string | null, sessionId: string | null, payload: Record<string, string | number | boolean>): SafetyEvent {
    const ev: SafetyEvent = {
      id: generateId(),
      type,
      participantId,
      sessionId,
      payload,
      createdAt: new Date(),
    };
    this.events.push(ev);
    return ev;
  }

  findOpenP0(): SafetyEvent[] {
    return this.events.filter(e => (e.type === 'minor-detected' || e.type === 'escalation-raised'));
  }

  all(): SafetyEvent[] {
    return this.events.slice();
  }

  clear(): void {
    this.events = [];
  }
}

// ---------------------------------------------------------------------------
// Moderation case store
// ---------------------------------------------------------------------------
class ModerationStore {
  private cases = new Map<string, ModerationCase>();
  private actions: ModerationAction[] = [];

  createCase(reportId: string, sessionId: string, severity: ModerationCase['severity']): ModerationCase {
    const c: ModerationCase = {
      id: generateId(),
      reportId,
      sessionId,
      severity,
      status: severity === 'P0' ? 'escalated' : 'open',
      assignedTo: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.cases.set(c.id, c);
    return c;
  }

  getCase(id: string): ModerationCase | null {
    return this.cases.get(id) ?? null;
  }

  list(filter?: { severity?: string; status?: string }): ModerationCase[] {
    let arr = Array.from(this.cases.values());
    if (filter?.severity) arr = arr.filter(c => c.severity === filter.severity);
    if (filter?.status) arr = arr.filter(c => c.status === filter.status);
    return arr;
  }

  applyAction(caseId: string, action: ModerationAction['action'], actorId: string, targetType: ModerationAction['targetType'], targetId: string, reasonCode: string, policyVersion: number): ModerationAction {
    if (!reasonCode) throw new Error('Reason code required (FR-MOD-004)');
    const ma: ModerationAction = {
      id: generateId(),
      caseId,
      action,
      actorId,
      targetType,
      targetId,
      reasonCode,
      policyVersion,
      createdAt: new Date(),
    };
    this.actions.push(ma);
    const c = this.cases.get(caseId);
    if (c) {
      c.status = 'actioned';
      c.resolvedAt = new Date();
    }
    return ma;
  }

  clear(): void {
    this.cases.clear();
    this.actions = [];
  }
}

// ---------------------------------------------------------------------------
// Recent peers (in-memory, bounded)
// ---------------------------------------------------------------------------
class RecentPeerStore {
  private map = new Map<string, Map<string, number>>(); // participant -> peer -> timestamp
  private maxSize = 20;

  add(a: string, b: string): void {
    this.addOne(a, b);
    this.addOne(b, a);
  }

  private addOne(owner: string, peer: string): void {
    if (!this.map.has(owner)) this.map.set(owner, new Map());
    const inner = this.map.get(owner)!;
    inner.set(peer, Date.now());
    // prune oldest if over size
    if (inner.size > this.maxSize) {
      const oldest = Array.from(inner.entries()).sort((x, y) => x[1] - y[1])[0];
      if (oldest) inner.delete(oldest[0]);
    }
  }

  isRecent(a: string, b: string): boolean {
    const inner = this.map.get(a);
    if (!inner) return false;
    const ts = inner.get(b);
    if (!ts) return false;
    // 5 minute avoidance window
    return Date.now() - ts < 5 * 60 * 1000;
  }

  clear(): void {
    this.map.clear();
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per identity)
// ---------------------------------------------------------------------------
interface RateLimitBucket {
  count: number;
  windowStart: number;
  totalInSession?: number;
}

class RateLimitStore {
  private buckets = new Map<string, RateLimitBucket>(); // key = identityId:limitName
  private cooldowns = new Map<string, number>(); // identityId -> expiry ms
  private messageCounts = new Map<string, number>(); // sessionId:participant -> count
  private identicalMessages = new Map<string, { body: string; count: number }>();

  // Config
  private limits: Record<string, { windowMs: number; max: number; burst?: number }> = {
    queueJoinsPerSecond: { windowMs: 5000, max: 1 },
    sessionCreationsPerMinute: { windowMs: 60_000, max: 10 },
    messagesPerSecond: { windowMs: 1000, max: 1, burst: 5 },
    messagesPerSession: { windowMs: 0, max: 300 },
    reportsPerHour: { windowMs: 60 * 60 * 1000, max: 5 },
    blocksPerHour: { windowMs: 60 * 60 * 1000, max: 10 },
    turnCredentialsPerHour: { windowMs: 60 * 60 * 1000, max: 5 },
    turnCredentialsPerSession: { windowMs: 60 * 60 * 1000, max: 1 },
    offersPerSession: { windowMs: 0, max: 10 },
    iceCandidatesPerSession: { windowMs: 0, max: 100 },
    websocketFramesPerSecond: { windowMs: 1000, max: 30, burst: 60 },
  };

  check(identityId: string, limitName: string): { allowed: boolean; remaining: number; retryAfterMs: number | null } {
    const cfg = this.limits[limitName];
    if (!cfg) return { allowed: true, remaining: 999, retryAfterMs: null };

    // Cooldown check first
    const cdExpiry = this.cooldowns.get(identityId);
    if (cdExpiry && cdExpiry > Date.now()) {
      return { allowed: false, remaining: 0, retryAfterMs: cdExpiry - Date.now() };
    }

    const key = `${identityId}:${limitName}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || (cfg.windowMs > 0 && now - bucket.windowStart > cfg.windowMs)) {
      bucket = { count: 0, windowStart: now };
      this.buckets.set(key, bucket);
    }
    const effectiveMax = cfg.burst ?? cfg.max;
    if (bucket.count >= effectiveMax) {
      const retryAfter = cfg.windowMs > 0 ? cfg.windowMs - (now - bucket.windowStart) : null;
      return { allowed: false, remaining: 0, retryAfterMs: retryAfter };
    }
    bucket.count++;
    return { allowed: true, remaining: effectiveMax - bucket.count, retryAfterMs: null };
  }

  // Clear only rate limit buckets, not identical message tracking (for testing)
  clearBuckets(): void {
    this.buckets.clear();
    this.cooldowns.clear();
    this.messageCounts.clear();
  }

  applyCooldown(identityId: string, durationMs: number): void {
    this.cooldowns.set(identityId, Date.now() + durationMs);
  }

  cooldownRemaining(identityId: string): number {
    const exp = this.cooldowns.get(identityId);
    if (!exp) return 0;
    const rem = exp - Date.now();
    return rem > 0 ? rem : 0;
  }

  incrementMessageCount(sessionId: string, participantId: string): number {
    const key = `${sessionId}:${participantId}`;
    const cur = this.messageCounts.get(key) ?? 0;
    const next = cur + 1;
    this.messageCounts.set(key, next);
    return next;
  }

  checkIdentical(sessionId: string, participantId: string, body: string): boolean {
    const key = `${sessionId}:${participantId}`;
    const rec = this.identicalMessages.get(key);
    if (!rec) {
      this.identicalMessages.set(key, { body, count: 1 });
      return true;
    }
    if (rec.body === body) {
      rec.count++;
      if (rec.count >= 3) return false; // reject 3+ identical
      return true;
    } else {
      this.identicalMessages.set(key, { body, count: 1 });
      return true;
    }
  }

  clear(): void {
    this.buckets.clear();
    this.cooldowns.clear();
    this.messageCounts.clear();
    this.identicalMessages.clear();
  }
}

// ---------------------------------------------------------------------------
// Connection registry (in-memory)
// ---------------------------------------------------------------------------
class ConnectionRegistry {
  private conns = new Map<string, { participantId: string; lastPing: number }>();

  register(participantId: string): void {
    this.conns.set(participantId, { participantId, lastPing: Date.now() });
  }

  unregister(participantId: string): void {
    this.conns.delete(participantId);
  }

  isConnected(participantId: string): boolean {
    return this.conns.has(participantId);
  }

  clear(): void {
    this.conns.clear();
  }
}

// ---------------------------------------------------------------------------
// Risk signal store (coarse hash, 7 days)
// ---------------------------------------------------------------------------
class RiskSignalStore {
  private signals = new Map<string, { hash: string; regionCode: string | null; expiresAt: Date }>();

  record(identityId: string, rawSignal: string): { hash: string; regionCode: string | null; expiresAt: Date } {
    // Coarse hash: simple hash of first 3 chars of IP or similar
    const coarse = rawSignal.slice(0, 6);
    const hash = `hash_${Buffer.from(coarse).toString('base64').slice(0, 16)}`;
    const rec = {
      hash,
      regionCode: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    this.signals.set(identityId, rec);
    return rec;
  }

  findActive(hash: string): { hash: string; regionCode: string | null; expiresAt: Date } | null {
    for (const v of this.signals.values()) {
      if (v.hash === hash && v.expiresAt.getTime() > Date.now()) return v;
    }
    return null;
  }

  clear(): void {
    this.signals.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton instances
// ---------------------------------------------------------------------------
export const participantStore = new ParticipantStore();
export const queueStore = new QueueStore();
export const claimStore = new ClaimStore();
export const sessionStore = new SessionStore();
export const messageBuffer = new MessageBuffer();
export const blockStore = new BlockStore();
export const banStore = new BanStore();
export const reportStore = new ReportStore();
export const safetyEventStore = new SafetyEventStore();
export const moderationStore = new ModerationStore();
export const recentPeerStore = new RecentPeerStore();
export const rateLimitStore = new RateLimitStore();
export const connectionRegistry = new ConnectionRegistry();
export const riskSignalStore = new RiskSignalStore();

export function clearAllStores(): void {
  participantStore.clear();
  queueStore.clear();
  claimStore.clear();
  sessionStore.clear();
  messageBuffer.clear();
  blockStore.clear();
  banStore.clear();
  reportStore.clear();
  safetyEventStore.clear();
  moderationStore.clear();
  recentPeerStore.clear();
  rateLimitStore.clear();
  connectionRegistry.clear();
  riskSignalStore.clear();
}
