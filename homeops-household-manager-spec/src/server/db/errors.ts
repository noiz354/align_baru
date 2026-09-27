// HomeOps — database error classification (T-PLAT-005, docs/api/CONVENTIONS.md §6).
//
// Constraint violations are translated into domain error codes here and nowhere else: SQL text,
// table names, and driver messages never reach a member (SECURITY.md §5, DESIGN.md §11).

import type { ErrorCode } from '../../shared/errors/codes';

type PgErrorLike = { readonly code?: string; readonly constraint_name?: string; readonly message?: string };

export function isPgError(value: unknown): value is PgErrorLike {
  return typeof value === 'object' && value !== null && 'code' in value;
}

/** SQLSTATE 23505 — a unique or partial-unique index said no. */
export function isUniqueViolation(value: unknown): boolean {
  return isPgError(value) && value.code === '23505';
}

/** SQLSTATE 23503 — a foreign key is missing (usually a cross-household id). */
export function isForeignKeyViolation(value: unknown): boolean {
  return isPgError(value) && value.code === '23503';
}

/** SQLSTATE 23514 — a CHECK constraint said no. */
export function isCheckViolation(value: unknown): boolean {
  return isPgError(value) && value.code === '23514';
}

/** SQLSTATE 40001 / 40P01 — safe to retry once inside the unit of work (ARCHITECTURE.md §10). */
export function isRetriableSerializationFailure(value: unknown): boolean {
  return isPgError(value) && (value.code === '40001' || value.code === '40P01');
}

/**
 * Map a constraint name to the business code a member can act on. Unknown constraints degrade to
 * `CONFLICT`, never to a leak of the schema (docs/domain/ERRORS.md).
 */
export function uniqueViolationCode(constraint: string | undefined): ErrorCode {
  switch (constraint) {
    case 'uq_household_name_lower':
      return 'ALREADY_EXISTS';
    case 'uq_member_household_user':
      return 'MEMBER_ALREADY_IN_HOUSEHOLD';
    case 'uq_invitation_token_hash':
      return 'CONFLICT';
    case 'uq_user_email':
      return 'ALREADY_EXISTS';
    case 'uq_idempotency_household_key':
      return 'CONFLICT';
    case 'uq_outbox_dedupe':
      return 'CONFLICT';
    default:
      return 'CONFLICT';
  }
}

/** Isolation failures are NOT_FOUND, never FORBIDDEN: existence is not confirmed (I-XA-002). */
export function notFound(entityKind: string): ErrorCode {
  void entityKind;
  return 'NOT_FOUND';
}
