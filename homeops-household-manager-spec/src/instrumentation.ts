// HomeOps — process bootstrap (ADR-013, T-PLAT-010, T-PLAT-011).
//
// The scheduler is an in-process loop guarded by a Postgres advisory lock, not a second service
// (ARCHITECTURE.md §3). It starts once per Node process; Next.js may call `register` more than once
// in development, so the loop is guarded by a module-level flag and by the lock itself.

export async function register(): Promise<void> {
  // Only in the Node runtime, never in the Edge bundler or during a static build.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (globalThis.__homeopsBootstrapDone) return;
  globalThis.__homeopsBootstrapDone = true;

  const { startTracing } = await import('./server/telemetry/tracing');
  startTracing();

  const enabled = (process.env.SCHEDULER_ENABLED ?? 'true') !== 'false';
  if (!enabled) return;
  if (process.env.NODE_ENV === 'test') return;

  const { startSchedulerLoop } = await import('./server/scheduler/loop');
  startSchedulerLoop();
}

declare global {
  var __homeopsBootstrapDone: boolean | undefined;
}
