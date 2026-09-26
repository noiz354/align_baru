// HomeOps - server skeleton (specification phase). Job contract only.

/** Job: prune activity past each household's retention window (T-ACT-004). Batched deletes, counts
 * logged only, idempotent. Never touches open alerts or open issues (I-ACT-004). */
export async function runPruneActivityJob(_input: { readonly nowInstant: string }): Promise<{ readonly deleted: number }> {
  throw new Error('Not implemented: T-ACT-004');
}
