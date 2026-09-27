/**
 * Error taxonomy - the single vocabulary of failure across the whole system.
 *
 * Where this belongs: `shared/contracts` because domain, application and HTTP layers all need it, and
 * because API.md's error shapes and the UI's messages are derived from these codes.
 * Why it is written as real types in Phase 0: the taxonomy *is* the specification (API.md §errors).
 * Invariants: every failure a user can see has exactly one code here; codes are stable strings that may
 *   never be renamed (clients and audit records depend on them); a code never carries personal data.
 * Security: error responses must not disclose existence of another tenant's objects (ADR-0017 maps
 *   cross-org access to NOT_FOUND).
 * Privacy: a code is never accompanied by the offending value (no echoed tokens, contacts or text).
 */
export const ErrorCode = {
  // Generic
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_BUSY: "SERVER_BUSY",
  UNAVAILABLE: "UNAVAILABLE",
  INTERNAL: "INTERNAL",
  // Registration
  REGISTRATION_CLOSED: "REGISTRATION_CLOSED",
  REGISTRATION_FULL: "REGISTRATION_FULL",
  ALREADY_REGISTERED: "ALREADY_REGISTERED",
  INVITATION_REQUIRED: "INVITATION_REQUIRED",
  CAPACITY_CONTENTION: "CAPACITY_CONTENTION",
  // Check-in
  INVALID_FORMAT: "INVALID_FORMAT",
  INVALID_TOKEN: "INVALID_TOKEN",
  WRONG_EVENT: "WRONG_EVENT",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  REGISTRATION_CANCELLED: "REGISTRATION_CANCELLED",
  WINDOW_NOT_OPEN: "WINDOW_NOT_OPEN",
  WINDOW_CLOSED: "WINDOW_CLOSED",
  ALREADY_CHECKED_IN: "ALREADY_CHECKED_IN",
  // Media
  CHUNK_TOO_LARGE: "CHUNK_TOO_LARGE",
  CHUNK_VALIDATION_FAILED: "CHUNK_VALIDATION_FAILED",
  CHUNK_SEQUENCE_CONFLICT: "CHUNK_SEQUENCE_CONFLICT",
  SESSION_LIMIT_EXCEEDED: "SESSION_LIMIT_EXCEEDED",
  SESSION_ALREADY_ASSEMBLED: "SESSION_ALREADY_ASSEMBLED",
  // Transcription
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_AUTH: "PROVIDER_AUTH",
  PROVIDER_QUOTA: "PROVIDER_QUOTA",
  PROVIDER_REJECTED_INPUT: "PROVIDER_REJECTED_INPUT",
  PROVIDER_MALFORMED_OUTPUT: "PROVIDER_MALFORMED_OUTPUT",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  EGRESS_DISABLED: "EGRESS_DISABLED",
  EMPTY_OUTPUT: "EMPTY_OUTPUT",
  // Publication / content
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKING_FLAGS_UNRESOLVED: "BLOCKING_FLAGS_UNRESOLVED",
  POLICY_FORBIDS_PUBLICATION: "POLICY_FORBIDS_PUBLICATION",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  // Feedback
  FEEDBACK_WINDOW_CLOSED: "FEEDBACK_WINDOW_CLOSED",
  FEEDBACK_ALREADY_SUBMITTED: "FEEDBACK_ALREADY_SUBMITTED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP mapping used by the API layer (API.md). Keep in sync with the routes, not with the UI. */
export const HTTP_STATUS_BY_ERROR: Readonly<Record<ErrorCode, number>> = {
  // API.md §1 error table: VALIDATION_FAILED is 422 with field-level detail, not 400.
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_BUSY: 503,
  UNAVAILABLE: 503,
  INTERNAL: 500,
  REGISTRATION_CLOSED: 409,
  REGISTRATION_FULL: 409,
  ALREADY_REGISTERED: 200, // success-shaped: the participant has a valid registration already
  INVITATION_REQUIRED: 403,
  CAPACITY_CONTENTION: 409,
  INVALID_FORMAT: 400,
  INVALID_TOKEN: 404,
  WRONG_EVENT: 409,
  TOKEN_EXPIRED: 410,
  TOKEN_REVOKED: 410,
  REGISTRATION_CANCELLED: 409,
  WINDOW_NOT_OPEN: 409,
  WINDOW_CLOSED: 409,
  ALREADY_CHECKED_IN: 200, // success-shaped by design (CHECKIN.md §5)
  CHUNK_TOO_LARGE: 413,
  CHUNK_VALIDATION_FAILED: 422,
  CHUNK_SEQUENCE_CONFLICT: 409,
  SESSION_LIMIT_EXCEEDED: 413,
  SESSION_ALREADY_ASSEMBLED: 409,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_AUTH: 500,
  PROVIDER_QUOTA: 429,
  PROVIDER_REJECTED_INPUT: 422,
  PROVIDER_MALFORMED_OUTPUT: 502,
  PROVIDER_TIMEOUT: 504,
  EGRESS_DISABLED: 500, // configuration error, surfaced loudly, never a silent fallback
  EMPTY_OUTPUT: 502,
  REVIEW_REQUIRED: 409,
  BLOCKING_FLAGS_UNRESOLVED: 409,
  POLICY_FORBIDS_PUBLICATION: 403,
  REVISION_CONFLICT: 409,
  FEEDBACK_WINDOW_CLOSED: 409,
  FEEDBACK_ALREADY_SUBMITTED: 200,
};

/** Typed application error. Implementations are not needed in Phase 0 beyond construction. */
export interface AppErrorShape {
  readonly code: ErrorCode;
  /** Indonesian, user-facing, no internal detail (DESIGN.md: calm, plain language). */
  readonly message: string;
  /** Opaque correlation id for support; never contains request content. */
  readonly requestId?: string;
  /** Field-level detail for forms only; never echoes a token, contact or transcript text. */
  readonly fields?: Readonly<Record<string, string>>;
}

/**
 * Typed application error - the only error shape allowed to cross a layer boundary.
 *
 * Where this belongs: `shared/contracts` so domain rules, application services, repositories and route
 * handlers all throw and map the same vocabulary. Owner task: T-ARCH-004 (error taxonomy -> HTTP shapes);
 * the class itself landed with T-SEC-001, which is the first task that must throw a typed
 * `NotFoundError` instead of a generic `Error` (ADR-0017: cross-organization access is a 404).
 *
 * Invariants:
 *   1. A code is never invented at the throw site - it comes from `ErrorCode` above.
 *   2. `message` is Indonesian, user-facing and calm; internal detail goes to logs, never here.
 *   3. No error carries a token, contact value, transcript text or another tenant's object data
 *      (PRIVACY.md, SECURITY.md §11).
 *   4. `httpStatus` is derived from `HTTP_STATUS_BY_ERROR`, never chosen by the caller.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly requestId: string | undefined;
  readonly fields: Readonly<Record<string, string>> | undefined;

  constructor(shape: AppErrorShape, options?: { cause?: unknown }) {
    super(shape.message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = shape.code;
    this.requestId = shape.requestId;
    this.fields = shape.fields;
  }

  /** HTTP status is data (API.md), not a decision made at the throw site. */
  get httpStatus(): number {
    return HTTP_STATUS_BY_ERROR[this.code];
  }

  /** Shape safe to serialise into an API response body (no stack, no cause, no internals). */
  toShape(): AppErrorShape {
    const shape: AppErrorShape = { code: this.code, message: this.message };
    if (this.requestId !== undefined) {
      return { ...shape, requestId: this.requestId, ...(this.fields ? { fields: this.fields } : {}) };
    }
    return this.fields ? { ...shape, fields: this.fields } : shape;
  }

  /**
   * Existence privacy: a caller without rights to an object gets NOT_FOUND, never FORBIDDEN
   * (ADR-0017, SECURITY.md §4). The message must not hint that the object exists.
   */
  static notFound(message = "Data tidak ditemukan.", requestId?: string): AppError {
    return new AppError(
      requestId === undefined
        ? { code: ErrorCode.NOT_FOUND, message }
        : { code: ErrorCode.NOT_FOUND, message, requestId },
    );
  }

  static forbidden(message = "Anda tidak memiliki izin untuk tindakan ini.", requestId?: string): AppError {
    return new AppError(
      requestId === undefined
        ? { code: ErrorCode.FORBIDDEN, message }
        : { code: ErrorCode.FORBIDDEN, message, requestId },
    );
  }

  static unauthenticated(message = "Silakan masuk terlebih dahulu.", requestId?: string): AppError {
    return new AppError(
      requestId === undefined
        ? { code: ErrorCode.UNAUTHENTICATED, message }
        : { code: ErrorCode.UNAUTHENTICATED, message, requestId },
    );
  }

  /** `retryAfterSeconds` is surfaced as the `Retry-After` header (API.md §errors). */
  static rateLimited(retryAfterSeconds: number, requestId?: string): AppError & { retryAfterSeconds: number } {
    const error = new AppError(
      requestId === undefined
        ? { code: ErrorCode.RATE_LIMITED, message: "Terlalu banyak percobaan. Coba lagi sebentar." }
        : { code: ErrorCode.RATE_LIMITED, message: "Terlalu banyak percobaan. Coba lagi sebentar.", requestId },
    );
    return Object.assign(error, { retryAfterSeconds });
  }

  static validation(
    message = "Data yang dikirim belum benar.",
    fields?: Readonly<Record<string, string>>,
    requestId?: string,
  ): AppError {
    const shape: AppErrorShape = { code: ErrorCode.VALIDATION_FAILED, message };
    const withFields: AppErrorShape = fields ? { ...shape, fields } : shape;
    return new AppError(requestId === undefined ? withFields : { ...withFields, requestId });
  }
}

/** Narrowing helper so route handlers never have to inspect error messages. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** True when the error must be rendered as "does not exist" to the caller (ADR-0017). */
export function isNotFoundError(error: unknown): boolean {
  return isAppError(error) && error.code === ErrorCode.NOT_FOUND;
}
