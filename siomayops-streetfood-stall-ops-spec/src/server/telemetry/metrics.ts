/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/** Business metrics with BOUNDED labels and no PII (NFR-OBS-003). Catalogue: OBSERVABILITY.md §4. */
export type MetricName =
  | "shifts.started" | "shifts.closed" | "sync.records.outcome" | "payments.state.age"
  | "payments.verification.backlog" | "cash.variance.amount" | "stock.variance.count"
  | "incidents.open" | "expenses.review.latency" | "notifications.attempt.outcome";

export interface Metrics {
  increment(name: MetricName, labels?: Readonly<Record<string, string>>): void;
  observeDuration(name: MetricName, seconds: number, labels?: Readonly<Record<string, string>>): void;
  setGauge(name: MetricName, value: number, labels?: Readonly<Record<string, string>>): void;
}

/** Throws. Task: T-OBS-001. */
export function createMetrics(): Metrics {
  throw new Error("Not implemented: T-OBS-001");
}
