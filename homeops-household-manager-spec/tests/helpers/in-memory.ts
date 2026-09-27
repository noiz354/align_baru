// HomeOps — in-memory test doubles (T-PLAT-016, docs/testing/TEST-DATA.md §6).
//
// Properties that make a double trustworthy rather than convenient:
//  - they enforce household scoping, so an isolation bug is visible at the unit layer too;
//  - they enforce the same uniqueness rules as the database (a double that is more permissive than
//    production teaches the wrong lesson);
//  - they record their calls, so a test can assert "no write happened" (alert dedupe, idempotency);
//  - they are **not** a substitute for Postgres: every port also has an integration test
//    (tests/integration/**). A behaviour tested only against a double is not tested.
//
// Doubles exist for the ports whose adapters shipped in VS-0. The rest are listed in
// `PENDING_DOUBLES` with the task that adds them, rather than being written against domain services
// that do not exist yet (AGENTS.md §3: no fake implementations).

import type { Id, Instant, LocalDate, Role } from '../../src/shared/types';
import type { Household, HouseholdSettings, Invitation } from '../../src/domain/household/types';
import type { HouseholdRepository, InvitationRepository } from '../../src/domain/household/ports';
import type { Membership } from '../../src/domain/members/types';
import type { MembershipRepository } from '../../src/domain/members/ports';
import type { ActivityEvent } from '../../src/domain/activity/types';
import type { ActivityRepository, AuditRepository } from '../../src/domain/activity/ports';
import type { IdempotencyBeginResult, IdempotencyStore } from '../../src/shared/contracts/idempotency';
import {
  RATE_LIMIT_CLASSES,
  type RateLimitClass,
  type RateLimitDecision,
  type RateLimitStore,
} from '../../src/shared/contracts/rate-limit';
import type { OutboxMessageValue, OutboxStore } from '../../src/shared/contracts/outbox';

/** Ports whose double lands with their slice; a unit test that needs one earlier must add it here. */
export const PENDING_DOUBLES = [
  { port: 'RoomRepository, RoomOverrideRepository', owningTask: 'T-ROOM-001' },
  { port: 'ChoreDefinitionRepository, ChoreOccurrenceRepository', owningTask: 'T-CHORE-001' },
  { port: 'TrashRepository', owningTask: 'T-TRASH-001' },
  { port: 'ResourceRepository, ShoppingRepository', owningTask: 'T-RES-001' },
  { port: 'MaintenanceRepository', owningTask: 'T-MNT-001' },
  { port: 'IssueRepository', owningTask: 'T-ISSUE-001' },
  { port: 'AlertRepository', owningTask: 'T-ALERT-001' },
] as const;

/** A recorded call: `{ method, args }`, in order, so "no write happened" is assertable. */
export type RecordedCall = { readonly method: string; readonly args: readonly unknown[] };

export type CallRecorder = {
  readonly calls: readonly RecordedCall[];
  callsTo(method: string): readonly RecordedCall[];
  reset(): void;
};

function recorder(): CallRecorder & { record(method: string, ...args: unknown[]): void } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    callsTo: (method) => calls.filter((call) => call.method === method),
    reset: () => {
      calls.length = 0;
    },
    record: (method, ...args) => {
      calls.push({ method, args });
    },
  };
}

export type InMemoryHousehold = {
  readonly repository: HouseholdRepository;
  readonly invitations: InvitationRepository;
  readonly calls: CallRecorder;
  /** Seed a row without going through the port (a fixture, not an action under test). */
  givenHousehold(household: Household, settings?: HouseholdSettings): void;
  givenInvitation(invitation: Invitation): void;
};

export function inMemoryHousehold(scopeHouseholdId: Id): InMemoryHousehold {
  const households = new Map<Id, Household>();
  const settings = new Map<Id, HouseholdSettings>();
  const invitations = new Map<Id, Invitation>();
  const calls = recorder();
  const inScope = (requested: Id): boolean => requested === scopeHouseholdId;

  const repository: HouseholdRepository = {
    async findById(requested) {
      calls.record('household.findById', requested);
      return inScope(requested) ? (households.get(requested) ?? null) : null;
    },
    async findMembershipHousehold(memberId) {
      calls.record('household.findMembershipHousehold', memberId);
      // The one documented unscoped read (I-XA-001a): it still cannot return another household.
      const household = [...households.values()].find((entry) => entry.createdByMemberId === memberId);
      return household && household.id === scopeHouseholdId ? household : null;
    },
    async insert(household) {
      calls.record('household.insert', household.id);
      if (!inScope(household.id)) throw new Error('in-memory: insert of a foreign household');
      if (households.has(household.id)) throw new Error('in-memory: duplicate household id (unique index)');
      households.set(household.id, household);
    },
    async update(household) {
      calls.record('household.update', household.id);
      if (!inScope(household.id)) return;
      households.set(household.id, household);
    },
    async updateSettings(next) {
      calls.record('household.updateSettings', next.householdId);
      if (!inScope(next.householdId)) return;
      settings.set(next.householdId, next);
    },
    async findSettings(requested) {
      calls.record('household.findSettings', requested);
      return inScope(requested) ? (settings.get(requested) ?? null) : null;
    },
  };

  const invitationRepository: InvitationRepository = {
    async insert(invitation) {
      calls.record('invitation.insert', invitation.id);
      if (!inScope(invitation.householdId)) throw new Error('in-memory: insert of a foreign invitation');
      // Uniqueness is on the token hash, exactly as the database enforces it (DATA_MODEL.md §2.1).
      for (const existing of invitations.values()) {
        if (existing.tokenHash === invitation.tokenHash) throw new Error('in-memory: duplicate token_hash');
      }
      invitations.set(invitation.id, invitation);
    },
    async consumeByTokenHash(tokenHash, now) {
      calls.record('invitation.consumeByTokenHash', '<hash>', now.toISOString());
      const match = [...invitations.values()].find(
        (entry) => entry.tokenHash === tokenHash && inScope(entry.householdId),
      );
      if (!match) return null; // expired, used, revoked, or another household's: all "no invitation"
      if (match.acceptedAt || match.revokedAt || match.expiresAt <= now.toISOString()) return null;
      const accepted: Invitation = { ...match, acceptedAt: now.toISOString() };
      invitations.set(accepted.id, accepted);
      return accepted;
    },
    async listPending(requested) {
      calls.record('invitation.listPending', requested);
      if (!inScope(requested)) return [];
      return [...invitations.values()].filter(
        (entry) => entry.householdId === requested && !entry.acceptedAt && !entry.revokedAt,
      );
    },
    async revoke(requested, invitationId) {
      calls.record('invitation.revoke', requested, invitationId);
      if (!inScope(requested)) return;
      const existing = invitations.get(invitationId);
      if (existing && existing.householdId === requested) {
        invitations.set(invitationId, { ...existing, revokedAt: new Date().toISOString() });
      }
    },
  };

  return {
    repository,
    invitations: invitationRepository,
    calls,
    givenHousehold: (household, withSettings) => {
      households.set(household.id, household);
      if (withSettings) settings.set(household.id, withSettings);
    },
    givenInvitation: (invitation) => {
      invitations.set(invitation.id, invitation);
    },
  };
}

export type InMemoryMembers = {
  readonly repository: MembershipRepository;
  readonly calls: CallRecorder;
  givenMember(membership: Membership): void;
};

export function inMemoryMembers(scopeHouseholdId: Id): InMemoryMembers {
  const members = new Map<Id, Membership>();
  const calls = recorder();
  const inScope = (requested: Id): boolean => requested === scopeHouseholdId;

  const repository: MembershipRepository = {
    async findById(requested, memberId) {
      calls.record('members.findById', requested, memberId);
      if (!inScope(requested)) return null;
      const found = members.get(memberId);
      return found && found.householdId === scopeHouseholdId ? found : null;
    },
    async listByHousehold(requested) {
      calls.record('members.listByHousehold', requested);
      if (!inScope(requested)) return [];
      return [...members.values()].filter((member) => member.householdId === requested);
    },
    async listRecipients(requested) {
      calls.record('members.listRecipients', requested);
      if (!inScope(requested)) return [];
      return [...members.values()]
        .filter((member) => member.householdId === requested)
        .map((member) => ({
          id: member.id,
          role: member.role,
          ...(member.awayUntil ? { awayUntil: member.awayUntil } : {}),
        }));
    },
    async insert(membership) {
      calls.record('members.insert', membership.id);
      if (!inScope(membership.householdId)) throw new Error('in-memory: insert of a foreign membership');
      // `unique(household_id, user_id)` (DATA_MODEL.md §2.1): one membership per user per household.
      for (const existing of members.values()) {
        if (existing.householdId === membership.householdId && existing.userId === membership.userId) {
          throw new Error('in-memory: MEMBER_ALREADY_IN_HOUSEHOLD (unique household_id + user_id)');
        }
      }
      members.set(membership.id, membership);
    },
    async updateRole(requested, memberId, role) {
      calls.record('members.updateRole', requested, memberId, role);
      if (!inScope(requested)) return;
      const existing = members.get(memberId);
      if (existing && existing.householdId === requested) members.set(memberId, { ...existing, role });
    },
    async setAway(requested, memberId, awayUntil) {
      calls.record('members.setAway', requested, memberId, awayUntil);
      if (!inScope(requested)) return;
      const existing = members.get(memberId);
      if (!existing || existing.householdId !== requested) return;
      // `exactOptionalPropertyTypes`: clearing "away" removes the key, it does not set it to
      // undefined (an absent key and an explicit undefined are different to a JSON serializer).
      const { awayUntil: _previous, ...rest } = existing;
      members.set(memberId, awayUntil ? { ...rest, awayUntil } : rest);
    },
    async remove(requested, memberId) {
      calls.record('members.remove', requested, memberId);
      if (!inScope(requested)) return;
      members.delete(memberId);
    },
    async countActiveOwners(requested) {
      calls.record('members.countActiveOwners', requested);
      if (!inScope(requested)) return 0;
      return [...members.values()].filter(
        (member) => member.householdId === requested && member.role === 'OWNER',
      ).length;
    },
  };

  return {
    repository,
    calls,
    givenMember: (membership) => {
      members.set(membership.id, membership);
    },
  };
}

export type InMemoryActivity = {
  readonly activity: ActivityRepository;
  readonly audit: AuditRepository;
  readonly calls: CallRecorder;
  readonly events: readonly ActivityEvent[];
};

/** Activity takes `householdId` as its first parameter, so scoping is per call, not per handle. */
export function inMemoryActivity(): InMemoryActivity {
  const events: ActivityEvent[] = [];
  const auditEntries: unknown[] = [];
  const calls = recorder();

  const activity: ActivityRepository = {
    async append(householdId, event) {
      calls.record('activity.append', householdId, event.type);
      if (event.householdId !== householdId)
        throw new Error('in-memory: activity event scoped to another household');
      // Append-only: no update or delete method exists (I-ACT-001).
      events.push(event);
    },
    async list(householdId, options) {
      calls.record('activity.list', householdId, options.limit);
      const filtered = events
        .filter((event) => event.householdId === householdId)
        .filter((event) => (options.types ? options.types.includes(event.type) : true))
        .filter((event) => (options.actorMemberId ? event.actorMemberId === options.actorMemberId : true))
        .filter((event) => (options.since ? event.occurredAt >= options.since : true))
        .filter((event) => (options.until ? event.occurredAt < options.until : true))
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
      const start = options.cursor ? filtered.findIndex((event) => event.id === options.cursor) + 1 : 0;
      const page = filtered.slice(start, start + options.limit);
      const nextCursor = page.length === options.limit ? page[page.length - 1]?.id : undefined;
      return { events: page, ...(nextCursor ? { nextCursor } : {}) };
    },
    async listForEntity(householdId, entityKind, entityId, limit) {
      calls.record('activity.listForEntity', householdId, entityKind, entityId);
      return events
        .filter(
          (event) =>
            event.householdId === householdId &&
            event.entity.kind === entityKind &&
            event.entity.id === entityId,
        )
        .slice(0, limit);
    },
    async pruneBefore(householdId, instant, batchSize) {
      calls.record('activity.pruneBefore', householdId, instant, batchSize);
      let removed = 0;
      for (let index = events.length - 1; index >= 0 && removed < batchSize; index -= 1) {
        const event = events[index];
        if (event && event.householdId === householdId && event.occurredAt < instant) {
          events.splice(index, 1);
          removed += 1;
        }
      }
      return removed;
    },
  };

  const audit: AuditRepository = {
    async append(householdId, entry) {
      calls.record('audit.append', householdId, entry.action, entry.outcome);
      if (entry.householdId !== householdId)
        throw new Error('in-memory: audit entry scoped to another household');
      auditEntries.push(entry);
    },
  };

  return { activity, audit, calls, events };
}

export type InMemoryPlatform = {
  readonly idempotency: IdempotencyStore;
  readonly rateLimits: RateLimitStore;
  readonly outbox: OutboxStore;
  readonly calls: CallRecorder;
  /** Advance a rate-limit window without waiting: the double keys on the injected `now`. */
  outboxRows(): readonly OutboxMessageValue[];
};

export function inMemoryPlatform(): InMemoryPlatform {
  const calls = recorder();
  const keys = new Map<
    string,
    {
      readonly operation: string;
      readonly entityKind: string | null;
      readonly entityId: Id | null;
      readonly expiresAt: Date;
      readonly committed: boolean;
    }
  >();
  const buckets = new Map<
    string,
    { readonly count: number; readonly windowStartMs: number; readonly expiresAt: Date }
  >();
  const outbox = new Map<Id, OutboxMessageValue & { readonly lastErrorClass?: string }>();

  const idempotency: IdempotencyStore = {
    async begin({ householdId, clientRequestId, operation, now }) {
      calls.record('idempotency.begin', householdId, clientRequestId, operation);
      const key = `${householdId}|${clientRequestId}`;
      const existing = keys.get(key);
      if (existing && existing.expiresAt.getTime() > now.getTime()) {
        if (!existing.committed) return { status: 'IN_FLIGHT' } satisfies IdempotencyBeginResult;
        return {
          status: 'REPLAY',
          entityKind: existing.entityKind,
          entityId: existing.entityId,
        } satisfies IdempotencyBeginResult;
      }
      keys.set(key, {
        operation,
        entityKind: null,
        entityId: null,
        expiresAt: new Date(now.getTime() + 86_400_000),
        committed: false,
      });
      return { status: 'NEW' } satisfies IdempotencyBeginResult;
    },
    async commit({ householdId, clientRequestId, entityKind, entityId, expiresAt }) {
      calls.record('idempotency.commit', householdId, clientRequestId, entityKind);
      const key = `${householdId}|${clientRequestId}`;
      const existing = keys.get(key);
      keys.set(key, {
        operation: existing?.operation ?? 'unknown',
        entityKind,
        entityId,
        expiresAt,
        committed: true,
      });
    },
    async pruneExpired(now) {
      calls.record('idempotency.pruneExpired', now.toISOString());
      let removed = 0;
      for (const [key, value] of keys) {
        if (value.expiresAt.getTime() <= now.getTime()) {
          keys.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
  };

  const windowKey = (
    cls: RateLimitClass,
    scope: string,
    now: Date,
  ): { key: string; startMs: number; endMs: number } => {
    const windowMs = RATE_LIMIT_CLASSES[cls].windowSeconds * 1000;
    const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
    // The real store hashes the key; the double keeps it readable so a test can assert on scope.
    return { key: `${cls}|${scope}|${startMs}`, startMs, endMs: startMs + windowMs };
  };

  const rateLimits: RateLimitStore = {
    async consume({ cls, scope, now }): Promise<RateLimitDecision> {
      calls.record('rateLimits.consume', cls, scope, now.toISOString());
      const { key, endMs } = windowKey(cls, scope, now);
      const existing = buckets.get(key);
      const count = (existing?.count ?? 0) + 1;
      buckets.set(key, {
        count,
        windowStartMs: windowKey(cls, scope, now).startMs,
        expiresAt: new Date(endMs),
      });
      const limit = RATE_LIMIT_CLASSES[cls].limit;
      if (count <= limit) return { allowed: true, remaining: limit - count };
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((endMs - now.getTime()) / 1000)),
      };
    },
    async peek({ cls, scope, now }): Promise<RateLimitDecision> {
      calls.record('rateLimits.peek', cls, scope, now.toISOString());
      const { key, endMs } = windowKey(cls, scope, now);
      const count = buckets.get(key)?.count ?? 0;
      const limit = RATE_LIMIT_CLASSES[cls].limit;
      if (count < limit) return { allowed: true, remaining: limit - count };
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((endMs - now.getTime()) / 1000)),
      };
    },
    async pruneExpired(now) {
      calls.record('rateLimits.pruneExpired', now.toISOString());
      let removed = 0;
      for (const [key, value] of buckets) {
        if (value.expiresAt.getTime() <= now.getTime()) {
          buckets.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
  };

  const outboxStore: OutboxStore = {
    async enqueue(message) {
      calls.record('outbox.enqueue', message.dedupeKey, message.topic);
      // A duplicate dedupe key is a no-op, not a second delivery (I-XA-007).
      for (const existing of outbox.values()) {
        if (existing.dedupeKey === message.dedupeKey) return;
      }
      outbox.set(message.id, {
        id: message.id,
        householdId: message.householdId,
        dedupeKey: message.dedupeKey,
        topic: message.topic,
        payload: message.payload,
        state: 'PENDING',
        attempts: 0,
        nextAttemptAt: message.nextAttemptAt.toISOString(),
      });
    },
    async claimDue({ now, limit }) {
      calls.record('outbox.claimDue', now.toISOString(), limit);
      const due = [...outbox.values()]
        .filter((message) => message.state === 'PENDING' && message.nextAttemptAt <= now.toISOString())
        .sort((a, b) => (a.nextAttemptAt < b.nextAttemptAt ? -1 : 1))
        .slice(0, limit);
      for (const message of due) {
        outbox.set(message.id, { ...message, state: 'PROCESSING', attempts: message.attempts + 1 });
      }
      return due;
    },
    async markProcessed(id, now) {
      calls.record('outbox.markProcessed', id, now.toISOString());
      const existing = outbox.get(id);
      if (existing) outbox.set(id, { ...existing, state: 'PROCESSED' });
    },
    async markFailed({ id, now, errorClass, retryInMs }) {
      calls.record('outbox.markFailed', id, errorClass);
      const existing = outbox.get(id);
      if (existing) {
        outbox.set(id, {
          ...existing,
          state: 'PENDING',
          lastErrorClass: errorClass,
          nextAttemptAt: new Date(now.getTime() + retryInMs).toISOString(),
        });
      }
    },
    async markDead({ id, now, errorClass }) {
      calls.record('outbox.markDead', id, errorClass);
      const existing = outbox.get(id);
      if (existing)
        outbox.set(id, {
          ...existing,
          state: 'DEAD',
          lastErrorClass: errorClass,
          nextAttemptAt: now.toISOString(),
        });
    },
    async counts() {
      calls.record('outbox.counts');
      const rows = [...outbox.values()];
      return {
        pending: rows.filter((message) => message.state === 'PENDING' || message.state === 'PROCESSING')
          .length,
        dead: rows.filter((message) => message.state === 'DEAD').length,
      };
    },
    async pruneProcessed(olderThan) {
      calls.record('outbox.pruneProcessed', olderThan.toISOString());
      let removed = 0;
      for (const [id, message] of outbox) {
        if (message.state === 'PROCESSED' && message.nextAttemptAt < olderThan.toISOString()) {
          outbox.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
  };

  return { idempotency, rateLimits, outbox: outboxStore, calls, outboxRows: () => [...outbox.values()] };
}

/** Types re-exported so a suite imports the harness, not five contract paths. */
export type {
  Household,
  HouseholdSettings,
  Invitation,
  Membership,
  ActivityEvent,
  Role,
  Id,
  Instant,
  LocalDate,
};
