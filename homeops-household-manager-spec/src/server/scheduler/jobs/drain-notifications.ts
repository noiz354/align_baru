// HomeOps - server skeleton (specification phase). Job contract only.

/** Job: drain the outbox (T-NOTIF-010). Batches <= 200, exponential backoff, dead-letter after N
 * attempts, idempotent across restarts, no long transactions. Carries ids only - never content. */
export async function runDrainNotificationsJob(_input: { readonly nowInstant: string }): Promise<{
  readonly delivered: number;
  readonly suppressed: number;
  readonly failed: number;
}> {
  throw new Error('Not implemented: T-NOTIF-010');
}
