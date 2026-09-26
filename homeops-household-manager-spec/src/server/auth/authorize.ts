// HomeOps - server skeleton (specification phase). Boundary contract only.

import type { HouseholdContext } from './context';

/**
 * Server-side authorization. UI hiding is a convenience, never a control
 * (docs/security/AUTHZ-MATRIX.md, NFR-SEC-001).
 *
 * Contract:
 *  - every operation declares the matrix row it implements (docs/api/CONVENTIONS.md section 7);
 *  - isolation failures surface as NOT_FOUND, permission failures as FORBIDDEN;
 *  - denials are audited with ids and outcome only - never content (PRIVACY.md section 5).
 *
 * Status: unimplemented by design. Owning task: T-AUTH-005.
 */
export type OperationName = string;

export async function authorizeOperation(
  _ctx: HouseholdContext,
  _operation: OperationName,
  _target?: { readonly kind: string; readonly id: string },
): Promise<{ readonly allowed: true } | { readonly allowed: false; readonly code: 'FORBIDDEN' | 'ROLE_NOT_PERMITTED' | 'NOT_FOUND' }> {
  throw new Error('Not implemented: T-AUTH-005');
}
