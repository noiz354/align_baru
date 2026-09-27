export type JobName =
  | "read-model.refresh.coverage"
  | "read-model.refresh.sales"
  | "read-model.refresh.cash-position"
  | "read-model.refresh.verification-backlog"
  | "read-model.refresh.stock-position"
  | "read-model.refresh.expense-review"
  | "read-model.refresh.closing-completeness"
  | "read-model.refresh.location-usage"
  | "alerts.evaluate"
  | "notifications.dispatch"
  | "payments.sweep.pending-verification"
  | "settlement.import.expectations"
  | "retention.execute"
  | "privacy.dsar.execute"
  | "recognition.period.compute";

export interface JobQueue {
  enqueue(name: JobName, payload: unknown, options?: { readonly startAfterSeconds?: number }): Promise<void>;
  schedule(name: JobName, cron: string): Promise<void>;
}

class InMemoryJobQueue implements JobQueue {
  private jobs: { name: JobName; payload: unknown; runAt: Date }[] = [];
  private schedules = new Map<JobName, string>();

  async enqueue(name: JobName, payload: unknown, options?: { readonly startAfterSeconds?: number }): Promise<void> {
    const runAt = new Date(Date.now() + (options?.startAfterSeconds || 0) * 1000);
    this.jobs.push({ name, payload, runAt });
    // In real implementation, this would use pg-boss
    console.log(`[JobQueue] Enqueued ${name} for ${runAt.toISOString()}`);
  }

  async schedule(name: JobName, cron: string): Promise<void> {
    this.schedules.set(name, cron);
    console.log(`[JobQueue] Scheduled ${name} with cron ${cron}`);
  }

  // For testing
  getJobs(): typeof this.jobs {
    return this.jobs;
  }
}

let queueInstance: JobQueue | null = null;

export function createJobQueue(): JobQueue {
  if (!queueInstance) queueInstance = new InMemoryJobQueue();
  return queueInstance;
}
