// HomeOps — skeleton (specification phase). Contracts only.
// Owning tasks: T-PLAT-007.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

import type { DomainError } from './codes';

/**
 * The envelope every operation returns. No throwing for expected outcomes,
 * no `undefined` on failure (docs/api/CONVENTIONS.md §2).
 */
export type OperationResult<T> =
  | { readonly ok: true; readonly data: T; readonly meta?: OperationMeta }
  | { readonly ok: false; readonly error: DomainError; readonly meta?: OperationMeta };

export type OperationMeta = {
  readonly clientRequestId?: string;
  /** True when an idempotency key matched and the original result was replayed. */
  readonly deduped?: boolean;
};

/** Convenience constructors are deliberately absent: returning a result incorrectly should be visible. */
