/**
 * Error contract — the single source of truth for the error taxonomy.
 *
 * Authority: API_CONTRACT.md §6 (normative table). This file is the typed
 * mirror of that table; a code here without a table row (or vice versa) is a
 * contract violation caught by UNIT-ERR-001.
 *
 * Requirements: NFR-SEC-010 (no internals in bodies), THREAT T-13,
 * FR-AUTH-* (auth codes), all UPLOAD_* and STORAGE_* (NFR-SEC-007/008).
 *
 * Tasks: T-FOUND-009 (implementation of AppError + mapping), UNIT-ERR-001.
 *
 * Invariants:
 * - 5xx bodies NEVER carry stack traces, storage paths, or vendor errors.
 * - `message` is user-visible-safe (it is shown verbatim to users).
 * - Private-data lookups fail 404 (no existence leak), role failures 403
 *   (API_CONTRACT §1 — IDOR policy, THREAT T-04).
 */

/** Every error code the system can emit (API_CONTRACT.md §6, complete list). */
export type ErrorCode =
  // AUTH_*
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_TAKEN'
  | 'AUTH_DISABLED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_ACCOUNT_GONE'
  // CATALOG_*/MANGA_*/CHAPTER_*/READER_*
  | 'CATALOG_PAGE_INVALID'
  | 'MANGA_NOT_FOUND'
  | 'MANGA_SLUG_TAKEN'
  | 'CHAPTER_NOT_FOUND'
  | 'CHAPTER_NOT_READY'
  | 'CHAPTER_DUPLICATE_NUMBER'
  | 'CHAPTER_LIST_TOO_LARGE'
  | 'READER_INVALID_PAGE'
  // LIBRARY_*/SEARCH_*/UPLOAD_*/STORAGE_*
  | 'LIBRARY_BOOKMARK_EXISTS'
  | 'SEARCH_QUERY_INVALID'
  | 'UPLOAD_BAD_CONTAINER'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_TOO_MANY_FILES'
  | 'UPLOAD_BAD_MIME'
  | 'UPLOAD_PATH_TRAVERSAL'
  | 'UPLOAD_SYMLINK'
  | 'UPLOAD_DECOMPRESSION_BOMB'
  | 'UPLOAD_IMAGE_DECODE'
  | 'UPLOAD_DIMENSIONS_EXCEEDED'
  | 'UPLOAD_NO_IMAGES'
  | 'UPLOAD_BAD_ENTRY_NAME'
  | 'UPLOAD_JOB_TIMEOUT'
  | 'STORAGE_ERROR'
  // VALIDATION_*/RATE_LIMIT_*/INTERNAL_*
  | 'VALIDATION_BAD_QUERY'
  | 'VALIDATION_PASSWORD_POLICY'
  | 'RATE_LIMIT_LOGIN'
  | 'RATE_LIMIT_REGISTER'
  | 'RATE_LIMIT_RESET'
  | 'RATE_LIMIT_SEARCH'
  | 'RATE_LIMIT_UPLOAD'
  | 'RATE_LIMIT_BEACON'
  | 'RATE_LIMIT_GENERIC'
  // admin
  | 'ADMIN_LAST_ADMIN'
  | 'INTERNAL_ERROR';

/**
 * The mapping for each code: HTTP status, user-visible message, log level,
 * and whether the code triggers an alert (OBSERVABILITY.md §5).
 *
 * TODO(T-FOUND-009): materialize as a frozen data table `ERROR_MAPPINGS`
 * (one entry per code, values exactly as API_CONTRACT.md §6). This skeleton
 * intentionally defines the shape only — no implementation in this phase.
 */
export interface ErrorMapping {
  code: ErrorCode;
  httpStatus: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502;
  /** Shown verbatim to users (must be safe — no PII, no internals). */
  userMessage: string;
  /** Minimum log level when this code is raised. */
  logLevel: 'info' | 'warn' | 'error';
  /** Part of an alert rule (OBSERVABILITY.md §5). */
  alerts?: boolean;
}

/**
 * A typed application error. Thrown inside features/services; mapped to the
 * HTTP envelope by the route layer (thin handlers rule, dependency-rules.md).
 *
 * Edge cases to handle at T-FOUND-009:
 * - per-field details for VALIDATION_* (path + message pairs);
 * - `requestId` injected at the route boundary (never set by throwers);
 * - unknown codes are a compile-time error (exhaustive mapping check).
 */
export class AppError extends Error {
  declare readonly code: ErrorCode;
  /** Optional structured detail (VALIDATION_* field list, failed page list…). */
  declare readonly details?: Array<{ path?: string; message: string }>;

  /**
   * TODO(T-FOUND-009): constructor + mapping lookup.
   * Invariant: `code` must always be a known ErrorCode (no free strings).
   */
  // constructor body intentionally absent (architecture phase).
}

/**
 * The HTTP error envelope (API_CONTRACT.md §1):
 * `{ error: { code, message, details?, requestId } }`
 */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<{ path?: string; message: string }>;
    requestId: string;
  };
}
