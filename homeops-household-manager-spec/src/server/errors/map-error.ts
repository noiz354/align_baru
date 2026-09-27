// HomeOps — boundary error mapping (T-PLAT-007, docs/api/ERROR-CATALOG.md, docs/api/CONVENTIONS.md §2/§9).
//
// The only place domain errors become wire results:
//  - expected outcomes are returned as DomainError values, never thrown;
//  - invariant breaches are caught here and become INTERNAL with a correlation id — stack traces and
//    SQL text never reach a member (DESIGN.md §11, SECURITY.md §5);
//  - unknown error codes degrade to a calm message plus the reference id (E-7).

import { ERROR_CODES, type DomainError, type ErrorCode } from '../../shared/errors/codes';
import type { OperationResult } from '../../shared/errors/result';

/**
 * HTTP status per code, copied from docs/api/ERROR-CATALOG.md §"Mapping table". The docs are the
 * source of truth; `tests/unit/errors/codes.test.ts` asserts this table stays in sync.
 */
const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  // cross-cutting
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  ALREADY_EXISTS: 409,
  RATE_LIMITED: 429,
  FEATURE_NOT_AVAILABLE: 409,
  IDEMPOTENCY_REPLAY: 200, // the original success result is replayed, never an error body
  INTERNAL: 500,
  // household, membership, auth
  HOUSEHOLD_NOT_FOUND: 404,
  LAST_OWNER_CANNOT_LEAVE: 409,
  OWNER_TRANSFER_REQUIRED: 409,
  MEMBER_ALREADY_IN_HOUSEHOLD: 409,
  INVITE_EXPIRED: 410,
  INVITE_ALREADY_USED: 409,
  QUIET_HOURS_INVALID: 422,
  TIMEZONE_INVALID: 422,
  SESSION_EXPIRED: 401,
  SESSION_REVOKED: 401,
  ROLE_NOT_PERMITTED: 403,
  // rooms
  ROOM_NAME_TAKEN: 409,
  ROOM_IN_USE: 409,
  ROOM_OVERRIDE_EXPIRED: 409,
  ROOM_OVERRIDE_TOO_LONG: 422,
  ROOM_LIMIT_REACHED: 422,
  // chores & recurrence
  OCCURRENCE_ALREADY_OPEN: 409,
  OCCURRENCE_NOT_OPEN: 409,
  OCCURRENCE_STALE: 409,
  SNOOZE_TOO_LONG: 422,
  SKIP_REASON_REQUIRED: 422,
  REOPEN_WINDOW_CLOSED: 409,
  RECURRENCE_RULE_INVALID: 422,
  RECURRENCE_INTERVAL_INVALID: 422,
  DEFINITION_ARCHIVED: 409,
  ADHOC_REQUIRES_TITLE: 422,
  // trash
  TRASH_INVALID_TRANSITION: 409,
  TRASH_RESET_REASON_REQUIRED: 422,
  CONTAINER_ARCHIVED: 409,
  TRASH_NAME_TAKEN: 409,
  // resources & shopping
  RESOURCE_MODE_MISMATCH: 422,
  RESOURCE_LEVEL_INVALID: 422,
  RESOURCE_THRESHOLD_INVALID: 422,
  RESOURCE_NAME_TAKEN: 409,
  RESOURCE_MODE_CHANGE_REQUIRES_CONFIRM: 409,
  SHOPPING_ITEM_ALREADY_BOUGHT: 409,
  // maintenance
  FREQUENCY_INVALID: 422,
  LEAD_TIME_INVALID: 422,
  SERVICE_DATE_IN_FUTURE: 422,
  ASSET_NAME_TAKEN: 409,
  RECORD_TARGET_INVALID: 422,
  PLAN_ALREADY_PAUSED: 409,
  // issues
  ISSUE_INVALID_TRANSITION: 409,
  ISSUE_CLOSED_READONLY: 409,
  ISSUE_TITLE_REQUIRED: 422,
  ISSUE_CLOSE_NOT_PERMITTED: 403,
  ISSUE_WONT_FIX_REASON_REQUIRED: 422,
  COMMENT_BODY_INVALID: 422,
  ATTACHMENT_REJECTED: 422,
  // alerts
  ALERT_TERMINAL: 409,
  ALERT_ALREADY_ACKNOWLEDGED: 409,
  ALERT_NOT_ASSIGNED_TO_YOU: 403,
  SNOOZE_ALREADY_ACTIVE: 409,
  DEDUPE_CONFLICT: 409,
  // notifications
  CHANNEL_DISABLED: 409,
  PUSH_PERMISSION_DENIED: 422,
  SUBSCRIPTION_INVALID: 422,
  TEST_NOTIFICATION_LIMIT: 429,
  EMAIL_NOT_CONFIGURED: 409,
};

/** True for values produced by `domainError(...)`; used to separate expected from unexpected. */
export function isDomainError(value: unknown): value is DomainError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string' &&
    (ERROR_CODES as readonly string[]).includes(candidate.code)
  );
}

/** The single constructor for an expected outcome. Codes come from the catalogue, never ad hoc. */
export function domainError(
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, string | number>>,
): DomainError {
  return details ? { code, message, details } : { code, message };
}

export function toHttpStatus(error: DomainError): number {
  return HTTP_STATUS[error.code] ?? 500;
}

/**
 * Turn anything thrown or returned at a boundary into an `OperationResult` failure.
 * `requestId` is the correlation id shown to the member (E-7) and written to the log line — the
 * only diagnostic detail that ever crosses the boundary.
 */
export function toOperationResult<T>(input: {
  readonly error: unknown;
  readonly requestId: string;
}): OperationResult<T> {
  if (isDomainError(input.error)) {
    return { ok: false, error: input.error, meta: { clientRequestId: input.requestId } };
  }
  // Never leak internals: no stack trace, no SQL text, no library message (SECURITY.md §5).
  return {
    ok: false,
    error: {
      code: 'INTERNAL',
      message: 'Unexpected error',
      details: { reference: input.requestId },
    },
    meta: { clientRequestId: input.requestId },
  };
}

/**
 * Field-level validation failure shape used by every action (docs/api/CONVENTIONS.md §6):
 * `VALIDATION_FAILED` with `details.fields` carrying `name: message` pairs.
 */
export function validationError(fields: Readonly<Record<string, string>>): DomainError {
  return domainError('VALIDATION_FAILED', 'Validation failed', { fields: JSON.stringify(fields) });
}
