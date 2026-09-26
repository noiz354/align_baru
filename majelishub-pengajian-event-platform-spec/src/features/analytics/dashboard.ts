/**
 * Organizer dashboard data (cards, needs-action list, operational alerts).
 *
 * Where this belongs: features/analytics.
 * Specification: OBSERVABILITY.md §8, FR-ANALYTICS-001/002/003, TASKS.md T-ANALYTICS-001…004.
 * Invariants: aggregate-only - no participant-level timelines, no per-person behaviour, no ranking of
 *   people, mosques or events (ADR-0014/0024, NFR-PRIV-005); every card states its definition on tap;
 *   capacity appears only when exact; no-show appears only after the window closes; data-quality notes
 *   (e.g. manual share > 10%) are shown, not hidden.
 * Task ownership: T-ANALYTICS-001/002/003.
 */
export interface DashboardCard {
  readonly key: string;
  readonly title: string;
  readonly definition: string;
  readonly value: string | number;
  readonly asOf: string;
  readonly actionHref?: string;
}

/** @throws Error("Not implemented: T-ANALYTICS-001") */
export async function loadDashboard(input: { scope: import("@/shared/contracts/scope").TenantScope; actor: import("@/shared/contracts/permissions").Actor }): Promise<readonly DashboardCard[]> {
  throw new Error("Not implemented: T-ANALYTICS-001");
}
