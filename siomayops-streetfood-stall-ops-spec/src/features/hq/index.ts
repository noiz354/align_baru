/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * HQ values come from stored read models with explicit freshness; nothing is recomputed inline
 * (ARCHITECTURE.md §8). Verified and unverified digital amounts are never merged (FR-PAYMENT-010).
 */
import type { BusinessDay } from "../../shared/time";
import type { Money } from "../../shared/money";

export interface ReadModelEnvelope<T> {
  readonly computedAt: Date;
  readonly sourceWatermark?: string;
  readonly freshnessBand: "current" | "recent" | "stale";
  readonly value: T;
}

export interface CoverageCardValue {
  readonly shiftsActive: number;
  readonly shiftsWithoutLocationReport: number;
  readonly stallsIdle: number;
}

/** Requirements: FR-HQ-001/008, FR-LOCATION-010. Task: T-HQ-001. An unreported location is a gap, not a suspicion. */
export async function getCoverageCard(_input: {
  organizationId: string; businessDay: BusinessDay;
}): Promise<ReadModelEnvelope<CoverageCardValue>> {
  throw new Error("Not implemented: T-HQ-001");
}

export interface VerificationBacklogValue {
  readonly pendingCount: number;
  readonly pendingAmountUnverified: Money;
  readonly oldestAgeHours: number;
}

/** Requirements: FR-HQ-004/008, FR-PAYMENT-010/015. Task: T-HQ-002. */
export async function getVerificationBacklogCard(_input: {
  organizationId: string;
}): Promise<ReadModelEnvelope<VerificationBacklogValue>> {
  throw new Error("Not implemented: T-HQ-002");
}

export interface CashPositionCardValue {
  readonly expectedCash: Money;
  readonly countedCash: Money;
  readonly varianceAmount: Money;
  readonly unresolvedVerificationsCount: number;
}

/** Requirements: FR-HQ-003/008, FR-CASH-003/004. Task: T-HQ-002. */
export async function getCashPositionCard(_input: {
  organizationId: string; businessDay: BusinessDay;
}): Promise<ReadModelEnvelope<CashPositionCardValue>> {
  throw new Error("Not implemented: T-HQ-002");
}

/** Requirements: FR-HQ-009. Task: T-HQ-003. Drill-down is scope-checked and audited when exported. */
export async function drillDown(_input: {
  organizationId: string; card: string; key: string; cursor?: string;
}): Promise<{ readonly rows: readonly unknown[]; readonly nextCursor?: string }> {
  throw new Error("Not implemented: T-HQ-003");
}
