// HomeOps - server skeleton (specification phase). Job contract only.

/**
 * Job: reconcile alerts for every active household (FR-ALERT-005/009).
 * Per household: load the state snapshot, call evaluateAlerts (pure), then applyAlertPlan.
 * Single-flight per household, bounded batch, partial failure isolated. Running twice with unchanged
 * state changes nothing (I-ALERT-008) - this is the property the test suite asserts first.
 *
 * Owning task: T-ALERT-027.
 */
export async function runEvaluateAlertsJob(_input: { readonly nowInstant: string }): Promise<{
  readonly created: number;
  readonly refreshed: number;
  readonly resolved: number;
}> {
  throw new Error('Not implemented: T-ALERT-027');
}
