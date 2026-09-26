// HomeOps - server skeleton (specification phase). Boundary mapping only.

import type { DomainError } from '../../shared/errors/codes';
import type { OperationResult } from '../../shared/errors/result';

/**
 * The only place domain errors become wire results (docs/api/CONVENTIONS.md section 9).
 *
 * Rules:
 *  - expected outcomes are returned as DomainError values, never thrown;
 *  - invariant breaches are caught here and become INTERNAL with a correlation id - stack traces and
 *    SQL text never reach a member;
 *  - unknown error codes degrade to a calm message plus the reference id (DESIGN.md section 10, E-7).
 *
 * Status: unimplemented by design. Owning task: T-PLAT-007.
 */
export function toOperationResult<T>(_input: {
  readonly error: unknown;
  readonly requestId: string;
}): OperationResult<T> {
  throw new Error('Not implemented: T-PLAT-007');
}

export function toHttpStatus(_error: DomainError): number {
  throw new Error('Not implemented: T-PLAT-007');
}
