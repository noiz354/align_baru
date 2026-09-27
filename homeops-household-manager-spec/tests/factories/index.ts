// HomeOps — test factories (T-PLAT-016, docs/testing/TEST-DATA.md §4).
//
// Rules this file obeys:
//  - a factory returns a **valid** entity by default and takes overrides only for what a test cares
//    about; every default is asserted once in tests/unit/harness/factories.test.ts, so a default
//    cannot silently change behaviour across the suite;
//  - factories never write to a database (they build domain objects; persistence belongs to the
//    integration layer, tests/helpers/db.ts);
//  - no factory inlines expectations (there is no "expectedStatus" field anywhere);
//  - a factory whose module has not been implemented yet throws and names the task that fixes its
//    defaults, rather than guessing values no document has settled (AGENTS.md §3).

import type { Household, HouseholdSettings, Invitation } from '../../src/domain/household/types';
import type { Membership } from '../../src/domain/members/types';
import type { Id, Instant, LocalDate, Role } from '../../src/shared/types';

export type FactoryOverrides<T> = Partial<T>;

/** The instant every fixture starts from: 2026-10-05 07:00 in Asia/Jakarta (00:00Z). */
export const FACTORY_NOW: Instant = '2026-10-05T00:00:00.000Z';

let sequence = 0;
/** Unique-but-readable ids: `hh-1`, `mem-2`. Override `id` when a test asserts on a specific one. */
function nextId(prefix: string): Id {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Reset the id sequence between tests so a failure message is reproducible. */
export function resetFactorySequence(): void {
  sequence = 0;
}

/**
 * Defaults follow the HH_MAIN fixture (TEST-DATA.md §2): `Asia/Jakarta`, Monday week start, one
 * owner. `createdByMemberId` points at a member id the caller usually overrides with the owner's.
 */
export function household(overrides: FactoryOverrides<Household> = {}): Household {
  return {
    id: nextId('hh'),
    name: 'HH_MAIN',
    timezone: 'Asia/Jakarta',
    weekStartsOn: 'MONDAY',
    createdAt: FACTORY_NOW,
    createdByMemberId: 'mem-owner',
    ...overrides,
  };
}

/** Policy knobs at their documented defaults (DATA_MODEL.md §2.1 / `household_settings` DDL). */
export function householdSettings(overrides: FactoryOverrides<HouseholdSettings> = {}): HouseholdSettings {
  return {
    householdId: 'hh-1',
    maintenanceLeadDays: 7,
    snoozeMaxHours: 24,
    infoExpiryDays: 14,
    dailyCapCeiling: 10,
    roomOverrideMaxHours: 168,
    ...overrides,
  };
}

/** Defaults: MEMBER role, present (not away), joined at `FACTORY_NOW` (TEST-DATA.md §2). */
export function member(overrides: FactoryOverrides<Membership> = {}): Membership {
  return {
    id: nextId('mem'),
    householdId: 'hh-1',
    userId: nextId('user'),
    role: 'MEMBER' as Role,
    displayName: 'Sari',
    joinedAt: FACTORY_NOW,
    ...overrides,
  };
}

/** A pending, single-use invitation that expires in 7 days (FR-MEM-003, `INVITE_EXPIRED`). */
export function invitation(overrides: FactoryOverrides<Invitation> = {}): Invitation {
  return {
    id: nextId('inv'),
    householdId: 'hh-1',
    tokenHash: nextId('hash'),
    role: 'MEMBER',
    expiresAt: '2026-10-12T00:00:00.000Z',
    ...overrides,
  };
}

/* --------------------------------------------------------------------- pending with their slices */

export function choreOccurrence(_overrides?: FactoryOverrides<unknown>): never {
  // Valid defaults for an occurrence (status set, due-time semantics, the one-open-occurrence rule)
  // are fixed by the chores slice; guessing them here would encode assumptions no document states.
  throw new Error('Not implemented: T-CHORE-002');
}

export function resource(_overrides?: FactoryOverrides<unknown>): never {
  // `mode`-consistent thresholds (QUANTITY vs PERCENT) are the resources slice's invariant.
  throw new Error('Not implemented: T-RES-002');
}

export function room(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-ROOM-001');
}

export function choreDefinition(_overrides?: FactoryOverrides<unknown>): never {
  // A recurrence rule's valid shapes are fixed by ADR-007 and T-CHORE-001.
  throw new Error('Not implemented: T-CHORE-001');
}

export function trashContainer(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-TRASH-001');
}

export function maintenancePlan(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-MNT-001');
}

export function issue(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-ISSUE-001');
}

export function alert(_overrides?: FactoryOverrides<unknown>): never {
  // Priority, dedupe key and state machine defaults come from ADR-008 and T-ALERT-001.
  throw new Error('Not implemented: T-ALERT-001');
}

export function activityEvent(_overrides?: FactoryOverrides<unknown>): never {
  // The `type` vocabulary and the PII-free metadata rule are fixed by T-ACT-001.
  throw new Error('Not implemented: T-ACT-001');
}

export function attachment(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-ISSUE-006');
}

/** Re-exported so a suite can import types from one place. */
export type { Household, HouseholdSettings, Invitation, Membership, Id, Instant, LocalDate, Role };
