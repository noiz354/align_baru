export type MetricName =
  | "shifts.started" | "shifts.closed" | "sync.records.outcome" | "payments.state.age"
  | "payments.verification.backlog" | "cash.variance.amount" | "stock.variance.count"
  | "incidents.open" | "expenses.review.latency" | "notifications.attempt.outcome"
  | "dashboard.read_model.contract_failure" | "dashboard.read_model.latency" | "dashboard.read.failure";

export interface Metrics {
  increment(name: MetricName, labels?: Readonly<Record<string, string>>): void;
  observeDuration(name: MetricName, seconds: number, labels?: Readonly<Record<string, string>>): void;
  setGauge(name: MetricName, value: number, labels?: Readonly<Record<string, string>>): void;
}

// MOCK ONLY — ANALYTICS NOT CONNECTED TO REAL TELEMETRY
class InMemoryMetrics implements Metrics {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  private key(name: MetricName, labels?: Readonly<Record<string, string>>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(",");
    return `${name}{${labelStr}}`;
  }

  increment(name: MetricName, labels?: Readonly<Record<string, string>>): void {
    const k = this.key(name, labels);
    this.counters.set(k, (this.counters.get(k) || 0) + 1);
  }

  observeDuration(name: MetricName, seconds: number, labels?: Readonly<Record<string, string>>): void {
    const k = this.key(name, labels);
    // For simplicity, treat as gauge
    this.gauges.set(k, seconds);
  }

  setGauge(name: MetricName, value: number, labels?: Readonly<Record<string, string>>): void {
    const k = this.key(name, labels);
    this.gauges.set(k, value);
  }

  // For debugging
  dump(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) result[k] = v;
    for (const [k, v] of this.gauges.entries()) result[k] = v;
    return result;
  }
}

const metricsInstance = new InMemoryMetrics();

export function createMetrics(): Metrics {
  return metricsInstance;
}

export const metrics = metricsInstance;
