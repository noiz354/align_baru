// HomeOps - server skeleton (specification phase). Job contract only.

/**
 * Job: materialise the next occurrence for every household that needs one (FR-CHORE-017).
 * Per household: build a HouseholdContext, ask the domain service, commit. Idempotent - running it
 * twice must produce one occurrence thanks to the deterministic key plus the partial unique index.
 * Metrics: occurrences created per run, households processed, duration (OBSERVABILITY.md).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-010 - requirements, ADR, design, and tests are listed there.
 */
export async function runMaterialiseChoresJob(_input: {
  readonly nowInstant: string;
}): Promise<{ readonly created: number }> {
  // The loop over households belongs to T-CHORE-010; nothing here may pretend to have run.
  throw new Error('Not implemented: T-CHORE-010');
}
