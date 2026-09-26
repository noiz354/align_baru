// HomeOps — domain skeleton (specification phase). Types and value objects only.
// Owning tasks: T-HH-001..019.

import type { Id, Instant, LocalDate, Role } from '../../shared/types';

/** Aggregate root. References nothing outside its own module (DOMAIN.md §4.1). */
export type Household = {
  readonly id: Id;
  readonly name: string;
  /** IANA identifier; validated on write (I-HH-001). Affects future dates only (I-HH-004). */
  readonly timezone: string;
  readonly weekStartsOn: 'MONDAY' | 'SUNDAY';
  readonly archivedAt?: Instant;
  readonly createdAt: Instant;
  readonly createdByMemberId: Id;
};

/** 1:1 with the household. Defaults for everything a member would otherwise configure one by one. */
export type HouseholdSettings = {
  readonly householdId: Id;
  /** Days before a service date that the household wants to be reminded (0–90). */
  readonly maintenanceLeadDays: number;
  /** Maximum snooze duration offered anywhere in the UI. */
  readonly snoozeMaxHours: number;
  /** Age at which an INFO alert expires (I-ALERT-005 / docs/product/ALERTS.md). */
  readonly infoExpiryDays: number;
  /** Default quiet window; may be undefined when the household wants none (I-HH-003). */
  readonly quietHours?: QuietHours;
  /** Ceiling for a member's personal daily cap. */
  readonly dailyCapCeiling: number;
  /** Length options for room status overrides (I-ROOM-002). */
  readonly roomOverrideMaxHours: number;
};

export type QuietHours = { readonly start: string; readonly end: string }; // 'HH:MM', household-local

/** Single-use, expiring invitation (FR-MEM-003). Stored hashed; the raw token never persists. */
export type Invitation = {
  readonly id: Id;
  readonly householdId: Id;
  readonly tokenHash: string;
  readonly invitedEmail?: string;
  readonly role: Exclude<Role, 'OWNER'>;
  readonly expiresAt: Instant;
  readonly acceptedAt?: Instant;
  readonly revokedAt?: Instant;
};

export type HouseholdSnapshot = {
  readonly household: Household;
  readonly settings: HouseholdSettings;
  readonly memberCount: number;
  readonly today: LocalDate;
};
