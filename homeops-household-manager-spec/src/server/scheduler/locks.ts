// HomeOps - server skeleton (specification phase). Single-flight contract only.

/**
 * Cross-process single-flight using Postgres advisory locks (ADR-013). A second datastore (Redis)
 * is not justified at this scale - the simplicity budget in ARCHITECTURE.md section 3 is the reason.
 *
 * Status: unimplemented by design. Owning task: T-PLAT-010.
 */
export async function tryAdvisoryLock(_input: {
  readonly key: string;
  readonly timeoutMs?: number;
}): Promise<{ readonly acquired: boolean; readonly release: () => Promise<void> }> {
  throw new Error('Not implemented: T-PLAT-010');
}
