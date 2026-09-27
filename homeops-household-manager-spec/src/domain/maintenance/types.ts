// HomeOps - domain skeleton (specification phase). Types and value objects only.

import type { Id, Instant, LocalDate } from '../../shared/types';

export type Asset = {
  readonly id: Id;
  readonly householdId: Id;
  readonly name: string;
  readonly category:
    'APPLIANCE' | 'HVAC' | 'PLUMBING' | 'ELECTRICAL' | 'SAFETY' | 'VEHICLE' | 'OUTDOOR' | 'OTHER';
  readonly roomId?: Id;
  readonly locationNote?: string;
  readonly installedOn?: LocalDate;
  readonly notes?: string;
  readonly archivedAt?: Instant;
};

/** Household-oriented by decision: no work orders, approvals, parts, or SLAs (ADR-012, I-MNT-004). */
export type MaintenancePlan = {
  readonly id: Id;
  readonly householdId: Id;
  readonly assetId?: Id; // a household-level plan (pest control, gutters) is legitimate (T-MNT-015)
  readonly name: string;
  readonly frequency: ServiceFrequency;
  /** Days of warning before the service date (0-90). */
  readonly leadDays: number;
  readonly assigneeMemberId?: Id;
  readonly vendorNote?: string;
  readonly estimatedCostNote?: string;
  readonly pausedAt?: Instant;
  /** Derived and recomputable - never hand-edited, never advanced by an alert or snooze (I-MNT-001). */
  readonly nextServiceAt: LocalDate;
  readonly archivedAt?: Instant;
};

export type ServiceFrequency =
  | { readonly kind: 'EVERY_N_DAYS'; readonly interval: number }
  | { readonly kind: 'EVERY_N_WEEKS'; readonly interval: number }
  | { readonly kind: 'EVERY_N_MONTHS'; readonly interval: number; readonly dayOfMonth: number }
  | {
      readonly kind: 'EVERY_N_YEARS';
      readonly interval: number;
      readonly month: number;
      readonly dayOfMonth: number;
    }
  | { readonly kind: 'MONTHS_OF_YEAR'; readonly months: readonly number[]; readonly dayOfMonth: number };

export type MaintenanceRecord = {
  readonly id: Id;
  readonly householdId: Id;
  readonly planId?: Id;
  readonly assetId?: Id;
  readonly performedOn: LocalDate;
  /** A member, or EXTERNAL with a vendor note - never a fabricated member (I-MNT-002). */
  readonly performedByMemberId?: Id;
  readonly vendorNote?: string;
  readonly summary: string;
  readonly costNote?: string;
  readonly attachmentId?: Id;
  readonly linkedIssueId?: Id;
  readonly recordedByMemberId: Id;
  readonly recordedAt: Instant;
};
