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
 *
 * ── How "user-visible-safe by construction" is guaranteed (T-FOUND-009,
 * T-13, NFR-SEC-010) ────────────────────────────────────────────────────────
 * 1. `ERROR_MAPPINGS` is the ONLY place a user-visible string is written, and
 *    every value is a **string literal** taken from API_CONTRACT.md §6. There is
 *    no template literal, concatenation, or interpolation anywhere in the table,
 *    so no internal `Error`, path, query, or vendor string can reach it — a
 *    leaked value would have to be typed into the table by hand, which review
 *    and the CI check below both see.
 * 2. `AppError.message` is set to the mapped literal, never to a cause's
 *    message: `new AppError(code, { cause })` keeps the cause reachable for the
 *    logger (OBSERVABILITY.md §3) and out of the error's own message.
 * 3. `toRouteError` builds the envelope from the mapping only. It never reads
 *    `error.stack`, `error.cause`, or any other internal.
 * 4. `details[]` is the *only* per-request text a body may carry, and it is
 *    authored by the validating layer as user-facing copy (Zod messages,
 *    API_CONTRACT §1) — the same rule as (1), applied to the detail array.
 * 5. UNIT-ERR-001 (tests/unit/error-contract.test.ts) asserts the whole table
 *    against a hand-written snapshot of §6 and scans every message for
 *    path/URL/internal tokens; `node scripts/check-error-contract.mjs` asserts
 *    the same table against the markdown rows themselves in CI.
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
  | 'LIBRARY_BOOKMARK_NOT_FOUND'
  | 'VALIDATION_FIELD_INVALID'
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
 * One structured, user-safe field error.
 *
 * Task: T-FOUND-009 (edge case "codes with per-field details"). The shape is
 * the one the skeleton's `AppError.details` and `ErrorBody.error.details`
 * already declared, extracted to a name so both can use it. Structural only —
 * a detail's `message` is user-facing copy authored by the validating layer
 * (e.g. Zod), never an internal error string (NFR-SEC-010).
 */
export interface ErrorDetail {
  /** Dotted field path (e.g. `password`); absent for a whole-payload error. */
  path?: string;
  /** User-visible text for this field. */
  message: string;
}

/**
 * The mapping for each code: HTTP status, user-visible message, log level,
 * and whether the code triggers an alert (OBSERVABILITY.md §5).
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
 * The frozen code → mapping table (API_CONTRACT.md §6, row for row).
 *
 * Requirements: NFR-SEC-010, T-13. Task: T-FOUND-009.
 *
 * Two compile-time guarantees live here:
 * - `satisfies { [K in ErrorCode]: ErrorMapping }` makes a **missing** code a
 *   compile error, and the excess-property check makes an **unknown** code a
 *   compile error (the union is closed — there are no free strings, so an
 *   invented code cannot be represented at all).
 * - Every value is a literal copied from the §6 row named above it; the status
 *   and level unions below re-check the column values, so a typo in a status is
 *   a compile error rather than a runtime surprise.
 *
 * Note on the three codes marked PENDING-§6: they are part of the
 * `ErrorCode` contract and are mandated by other spec documents, but the §6
 * table has no row for them yet. Their values follow the conventions of the
 * family they belong to. `scripts/check-error-contract.mjs` reports them as a
 * contract gap on every run (spec-question, needs a §6 row — see AGENTS.md §6).
 */
const ERROR_MAPPINGS_DATA = {
  // ── AUTH_* ────────────────────────────────────────────────────────────────
  AUTH_REQUIRED: {
    code: 'AUTH_REQUIRED',
    httpStatus: 401,
    userMessage: 'Sign in to continue.',
    logLevel: 'info',
    alerts: false,
  },
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    httpStatus: 401,
    userMessage: 'Invalid email or password.',
    logLevel: 'warn',
    alerts: true, // §6 A: spike rule → OBSERVABILITY.md §5 auth_spike
  },
  AUTH_EMAIL_TAKEN: {
    code: 'AUTH_EMAIL_TAKEN',
    httpStatus: 409,
    userMessage: 'An account with this email exists.',
    logLevel: 'info',
    alerts: false,
  },
  AUTH_DISABLED: {
    code: 'AUTH_DISABLED',
    httpStatus: 403,
    userMessage: 'Account disabled. Contact the operator.',
    logLevel: 'warn',
    alerts: false,
  },
  AUTH_FORBIDDEN: {
    code: 'AUTH_FORBIDDEN',
    httpStatus: 403,
    userMessage: "You don't have permission.",
    logLevel: 'warn',
    alerts: false,
  },
  AUTH_ACCOUNT_GONE: {
    code: 'AUTH_ACCOUNT_GONE',
    httpStatus: 404,
    userMessage: 'Account no longer exists.',
    logLevel: 'info',
    alerts: false,
  },
  // ── CATALOG_*/MANGA_*/CHAPTER_*/READER_* ───────────────────────────────────
  CATALOG_PAGE_INVALID: {
    code: 'CATALOG_PAGE_INVALID',
    httpStatus: 422,
    userMessage: 'Invalid pagination.',
    logLevel: 'info',
    alerts: false,
  },
  MANGA_NOT_FOUND: {
    code: 'MANGA_NOT_FOUND',
    httpStatus: 404,
    userMessage: 'Manga not found.',
    logLevel: 'info',
    alerts: false,
  },
  MANGA_SLUG_TAKEN: {
    code: 'MANGA_SLUG_TAKEN',
    httpStatus: 409,
    userMessage: 'Slug already in use.',
    logLevel: 'info',
    alerts: false,
  },
  CHAPTER_NOT_FOUND: {
    code: 'CHAPTER_NOT_FOUND',
    httpStatus: 404,
    userMessage: 'Chapter not found.',
    logLevel: 'info',
    alerts: false,
  },
  CHAPTER_NOT_READY: {
    code: 'CHAPTER_NOT_READY',
    httpStatus: 409,
    userMessage: "This chapter isn't available yet.",
    logLevel: 'warn',
    alerts: false,
  },
  CHAPTER_DUPLICATE_NUMBER: {
    code: 'CHAPTER_DUPLICATE_NUMBER',
    httpStatus: 409,
    userMessage: 'A chapter with this number exists.',
    logLevel: 'info',
    alerts: false,
  },
  CHAPTER_LIST_TOO_LARGE: {
    code: 'CHAPTER_LIST_TOO_LARGE',
    httpStatus: 409,
    userMessage: 'Chapter list too large to display.',
    logLevel: 'error',
    alerts: true, // §6 A: yes — a data problem, not a user mistake
  },
  READER_INVALID_PAGE: {
    code: 'READER_INVALID_PAGE',
    httpStatus: 422,
    userMessage: 'Page is out of range for this chapter.',
    logLevel: 'info',
    alerts: false,
  },
  // ── LIBRARY_*/SEARCH_* ────────────────────────────────────────────────────
  LIBRARY_BOOKMARK_EXISTS: {
    code: 'LIBRARY_BOOKMARK_EXISTS',
    httpStatus: 409,
    userMessage: 'You already bookmarked this page.',
    logLevel: 'info',
    alerts: false,
  },
  LIBRARY_BOOKMARK_NOT_FOUND: {
    code: 'LIBRARY_BOOKMARK_NOT_FOUND',
    httpStatus: 404,
    // Deliberately the same sentence an unknown id would get: the repository
    // returns one answer for "not yours" and "not there" alike (THREAT T-04), and
    // a distinct message would turn this 404 into an oracle for whether some other
    // reader's bookmark id exists.
    userMessage: 'Bookmark not found.',
    logLevel: 'info',
    alerts: false,
  },
  VALIDATION_FIELD_INVALID: {
    code: 'VALIDATION_FIELD_INVALID',
    httpStatus: 422,
    userMessage: 'One of the fields is not valid.',
    logLevel: 'info',
    alerts: false,
  },
  SEARCH_QUERY_INVALID: {
    code: 'SEARCH_QUERY_INVALID',
    httpStatus: 422,
    userMessage: 'Search query is empty or too long.',
    logLevel: 'info',
    alerts: false,
  },
  // ── UPLOAD_* (NFR-SEC-007 caps, NFR-SEC-008 archive safety) ───────────────
  UPLOAD_BAD_CONTAINER: {
    code: 'UPLOAD_BAD_CONTAINER',
    httpStatus: 415,
    userMessage: 'Only ZIP archives are accepted.',
    logLevel: 'warn',
    alerts: false,
  },
  UPLOAD_TOO_LARGE: {
    code: 'UPLOAD_TOO_LARGE',
    httpStatus: 413,
    userMessage: 'Upload exceeds the size limit.',
    logLevel: 'warn',
    alerts: false,
  },
  UPLOAD_TOO_MANY_FILES: {
    code: 'UPLOAD_TOO_MANY_FILES',
    httpStatus: 413,
    userMessage: 'Too many files.',
    logLevel: 'warn',
    alerts: false,
  },
  UPLOAD_BAD_MIME: {
    code: 'UPLOAD_BAD_MIME',
    httpStatus: 415,
    userMessage: 'One or more files are not supported images.',
    logLevel: 'warn',
    alerts: false,
  },
  UPLOAD_PATH_TRAVERSAL: {
    code: 'UPLOAD_PATH_TRAVERSAL',
    httpStatus: 415,
    userMessage: 'Archive contains unsafe paths.',
    logLevel: 'error',
    alerts: true, // Zip Slip (T-08)
  },
  UPLOAD_SYMLINK: {
    code: 'UPLOAD_SYMLINK',
    httpStatus: 415,
    userMessage: 'Archive contains unsafe links.',
    logLevel: 'error',
    alerts: true,
  },
  UPLOAD_DECOMPRESSION_BOMB: {
    code: 'UPLOAD_DECOMPRESSION_BOMB',
    httpStatus: 413,
    userMessage: 'Archive expands beyond the safe limit.',
    logLevel: 'error',
    alerts: true, // bomb (T-09)
  },
  UPLOAD_IMAGE_DECODE: {
    code: 'UPLOAD_IMAGE_DECODE',
    httpStatus: 422,
    userMessage: 'Some images could not be read.',
    logLevel: 'warn',
    alerts: true, // §6 A: > 5% rule → reader_image_errors_high
  },
  UPLOAD_DIMENSIONS_EXCEEDED: {
    code: 'UPLOAD_DIMENSIONS_EXCEEDED',
    httpStatus: 422,
    userMessage: 'Image dimensions exceed the limit.',
    logLevel: 'warn',
    alerts: false,
  },
  // PENDING-§6 — 422 is fixed by docs/product/edge-cases.md EC-UP-02; message,
  // level and alert flag follow the UPLOAD_* 4xx conventions above.
  UPLOAD_NO_IMAGES: {
    code: 'UPLOAD_NO_IMAGES',
    httpStatus: 422,
    userMessage: 'The archive contains no images.',
    logLevel: 'warn',
    alerts: false,
  },
  // PENDING-§6 — 415 (rejected at container validation, like UPLOAD_BAD_CONTAINER)
  // per docs/product/edge-cases.md EC-UP-09.
  UPLOAD_BAD_ENTRY_NAME: {
    code: 'UPLOAD_BAD_ENTRY_NAME',
    httpStatus: 415,
    userMessage: 'Archive contains unsupported file names.',
    logLevel: 'warn',
    alerts: false,
  },
  // PENDING-§6 — the 15-minute watchdog of docs/product/admin-workflow.md
  // (RUNBOOK 3.1): a job killed server-side is a 5xx, and a failed job is the
  // `upload_fail_rate_high` alert of OBSERVABILITY.md §5.
  UPLOAD_JOB_TIMEOUT: {
    code: 'UPLOAD_JOB_TIMEOUT',
    httpStatus: 500,
    userMessage: 'Upload processing timed out.',
    logLevel: 'error',
    alerts: true,
  },
  // ── STORAGE_* (NFR-SEC-008 — vendor detail never passes through) ──────────
  STORAGE_ERROR: {
    code: 'STORAGE_ERROR',
    httpStatus: 502,
    userMessage: 'Storage is temporarily unavailable.',
    logLevel: 'error',
    alerts: true,
  },
  // ── VALIDATION_* (Zod failures — per-field detail in `details[]`) ──────────
  // §6 gives the family V as "per-field message": the per-field text travels in
  // `details[]`, and the envelope message is a generic 422. The literal below is
  // the one place the family row needed an envelope string.
  VALIDATION_BAD_QUERY: {
    code: 'VALIDATION_BAD_QUERY',
    httpStatus: 422,
    userMessage: 'Invalid input.',
    logLevel: 'info',
    alerts: false,
  },
  VALIDATION_PASSWORD_POLICY: {
    code: 'VALIDATION_PASSWORD_POLICY',
    httpStatus: 422,
    userMessage: 'Invalid input.',
    logLevel: 'info',
    alerts: false,
  },
  // ── RATE_LIMIT_* (NFR-SEC-005/006) ────────────────────────────────────────
  // §6 row: L is "warn (spike → error)", A is "spike rules" — the base level is
  // warn and the spike escalation belongs to the rate-limit alert rules.
  RATE_LIMIT_LOGIN: {
    code: 'RATE_LIMIT_LOGIN',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_REGISTER: {
    code: 'RATE_LIMIT_REGISTER',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_RESET: {
    code: 'RATE_LIMIT_RESET',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_SEARCH: {
    code: 'RATE_LIMIT_SEARCH',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_UPLOAD: {
    code: 'RATE_LIMIT_UPLOAD',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_BEACON: {
    code: 'RATE_LIMIT_BEACON',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  RATE_LIMIT_GENERIC: {
    code: 'RATE_LIMIT_GENERIC',
    httpStatus: 429,
    userMessage: 'Too many requests. Try again soon.',
    logLevel: 'warn',
    alerts: true,
  },
  // ── ADMIN_* / INTERNAL_* ──────────────────────────────────────────────────
  ADMIN_LAST_ADMIN: {
    code: 'ADMIN_LAST_ADMIN',
    httpStatus: 409,
    userMessage: 'Another admin is required.',
    logLevel: 'warn',
    alerts: false,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    httpStatus: 500,
    userMessage: 'Something went wrong.',
    logLevel: 'error',
    alerts: true, // §6 A: yes — unhandled failures page the operator
  },
} satisfies { [K in ErrorCode]: ErrorMapping };

/**
 * The frozen table, exported for route handlers, the logger, and the CI
 * completeness check. Frozen so no caller can patch a 5xx into a leaky message
 * at runtime (NFR-SEC-010).
 *
 * Requirements: NFR-SEC-010, T-13. Task: T-FOUND-009. Tests: UNIT-ERR-001.
 */
export const ERROR_MAPPINGS: { readonly [K in ErrorCode]: ErrorMapping } =
  Object.freeze(ERROR_MAPPINGS_DATA);

/**
 * Resolve a code to its §6 mapping.
 *
 * Requirements: API_CONTRACT.md §6, NFR-SEC-010. Task: T-FOUND-009
 * (expected behavior 1 — totality, 2 — unknown codes are a compile error).
 *
 * The `switch` is the totality proof: it lists every member of the closed
 * `ErrorCode` union, and the `never` assignment in `default` turns a newly
 * added, unmapped code into a **compile error** at this line rather than a
 * runtime fallthrough. There is no stringly-typed lookup with a silent default.
 */
export function getErrorMapping(code: ErrorCode): ErrorMapping {
  switch (code) {
    case 'AUTH_REQUIRED':
      return ERROR_MAPPINGS.AUTH_REQUIRED;
    case 'AUTH_INVALID_CREDENTIALS':
      return ERROR_MAPPINGS.AUTH_INVALID_CREDENTIALS;
    case 'AUTH_EMAIL_TAKEN':
      return ERROR_MAPPINGS.AUTH_EMAIL_TAKEN;
    case 'AUTH_DISABLED':
      return ERROR_MAPPINGS.AUTH_DISABLED;
    case 'AUTH_FORBIDDEN':
      return ERROR_MAPPINGS.AUTH_FORBIDDEN;
    case 'AUTH_ACCOUNT_GONE':
      return ERROR_MAPPINGS.AUTH_ACCOUNT_GONE;
    case 'CATALOG_PAGE_INVALID':
      return ERROR_MAPPINGS.CATALOG_PAGE_INVALID;
    case 'MANGA_NOT_FOUND':
      return ERROR_MAPPINGS.MANGA_NOT_FOUND;
    case 'MANGA_SLUG_TAKEN':
      return ERROR_MAPPINGS.MANGA_SLUG_TAKEN;
    case 'CHAPTER_NOT_FOUND':
      return ERROR_MAPPINGS.CHAPTER_NOT_FOUND;
    case 'CHAPTER_NOT_READY':
      return ERROR_MAPPINGS.CHAPTER_NOT_READY;
    case 'CHAPTER_DUPLICATE_NUMBER':
      return ERROR_MAPPINGS.CHAPTER_DUPLICATE_NUMBER;
    case 'CHAPTER_LIST_TOO_LARGE':
      return ERROR_MAPPINGS.CHAPTER_LIST_TOO_LARGE;
    case 'READER_INVALID_PAGE':
      return ERROR_MAPPINGS.READER_INVALID_PAGE;
    case 'LIBRARY_BOOKMARK_EXISTS':
      return ERROR_MAPPINGS.LIBRARY_BOOKMARK_EXISTS;
    case 'LIBRARY_BOOKMARK_NOT_FOUND':
      return ERROR_MAPPINGS.LIBRARY_BOOKMARK_NOT_FOUND;
    case 'VALIDATION_FIELD_INVALID':
      return ERROR_MAPPINGS.VALIDATION_FIELD_INVALID;
    case 'SEARCH_QUERY_INVALID':
      return ERROR_MAPPINGS.SEARCH_QUERY_INVALID;
    case 'UPLOAD_BAD_CONTAINER':
      return ERROR_MAPPINGS.UPLOAD_BAD_CONTAINER;
    case 'UPLOAD_TOO_LARGE':
      return ERROR_MAPPINGS.UPLOAD_TOO_LARGE;
    case 'UPLOAD_TOO_MANY_FILES':
      return ERROR_MAPPINGS.UPLOAD_TOO_MANY_FILES;
    case 'UPLOAD_BAD_MIME':
      return ERROR_MAPPINGS.UPLOAD_BAD_MIME;
    case 'UPLOAD_PATH_TRAVERSAL':
      return ERROR_MAPPINGS.UPLOAD_PATH_TRAVERSAL;
    case 'UPLOAD_SYMLINK':
      return ERROR_MAPPINGS.UPLOAD_SYMLINK;
    case 'UPLOAD_DECOMPRESSION_BOMB':
      return ERROR_MAPPINGS.UPLOAD_DECOMPRESSION_BOMB;
    case 'UPLOAD_IMAGE_DECODE':
      return ERROR_MAPPINGS.UPLOAD_IMAGE_DECODE;
    case 'UPLOAD_DIMENSIONS_EXCEEDED':
      return ERROR_MAPPINGS.UPLOAD_DIMENSIONS_EXCEEDED;
    case 'UPLOAD_NO_IMAGES':
      return ERROR_MAPPINGS.UPLOAD_NO_IMAGES;
    case 'UPLOAD_BAD_ENTRY_NAME':
      return ERROR_MAPPINGS.UPLOAD_BAD_ENTRY_NAME;
    case 'UPLOAD_JOB_TIMEOUT':
      return ERROR_MAPPINGS.UPLOAD_JOB_TIMEOUT;
    case 'STORAGE_ERROR':
      return ERROR_MAPPINGS.STORAGE_ERROR;
    case 'VALIDATION_BAD_QUERY':
      return ERROR_MAPPINGS.VALIDATION_BAD_QUERY;
    case 'VALIDATION_PASSWORD_POLICY':
      return ERROR_MAPPINGS.VALIDATION_PASSWORD_POLICY;
    case 'RATE_LIMIT_LOGIN':
      return ERROR_MAPPINGS.RATE_LIMIT_LOGIN;
    case 'RATE_LIMIT_REGISTER':
      return ERROR_MAPPINGS.RATE_LIMIT_REGISTER;
    case 'RATE_LIMIT_RESET':
      return ERROR_MAPPINGS.RATE_LIMIT_RESET;
    case 'RATE_LIMIT_SEARCH':
      return ERROR_MAPPINGS.RATE_LIMIT_SEARCH;
    case 'RATE_LIMIT_UPLOAD':
      return ERROR_MAPPINGS.RATE_LIMIT_UPLOAD;
    case 'RATE_LIMIT_BEACON':
      return ERROR_MAPPINGS.RATE_LIMIT_BEACON;
    case 'RATE_LIMIT_GENERIC':
      return ERROR_MAPPINGS.RATE_LIMIT_GENERIC;
    case 'ADMIN_LAST_ADMIN':
      return ERROR_MAPPINGS.ADMIN_LAST_ADMIN;
    case 'INTERNAL_ERROR':
      return ERROR_MAPPINGS.INTERNAL_ERROR;
    default: {
      // Unreachable for a well-typed caller: an unmapped code fails to compile
      // here (TS narrows `code` to `never` once every case is covered).
      const unmappedCode: never = code;
      throw new Error(`Unmapped error code: ${String(unmappedCode)}`);
    }
  }
}

/** Constructor options for {@link AppError} (T-FOUND-009). */
export interface AppErrorOptions {
  /**
   * Per-field, user-safe detail — the VALIDATION_* family (API_CONTRACT §6
   * "details[]"). Omit for every other code.
   */
  details?: ErrorDetail[];
  /**
   * The internal failure that caused this error. Kept for the log line
   * (OBSERVABILITY.md §3) and deliberately **not** rendered into any body
   * (NFR-SEC-010, T-13).
   */
  cause?: unknown;
}

/**
 * A typed application error. Thrown inside features/services; mapped to the
 * HTTP envelope by the route layer (thin handlers rule, dependency-rules.md).
 *
 * Requirements: NFR-SEC-010, T-13, API_CONTRACT.md §6. Task: T-FOUND-009.
 *
 * Edge cases handled here:
 * - per-field details for VALIDATION_* (path + message pairs) — copied, so a
 *   later mutation of the caller's array cannot change what a body says;
 * - the internal `cause` is preserved for logs and never becomes `message`;
 * - `code` is a member of the closed `ErrorCode` union — there is no way to
 *   construct an `AppError` with a code that is not in the §6 table.
 */
export class AppError extends Error {
  declare readonly code: ErrorCode;
  /** Optional structured detail (VALIDATION_* field list, failed page list…). */
  declare readonly details?: ErrorDetail[];

  /**
   * Build a typed error whose `message` is the §6 user-visible literal, so the
   * message is safe even if a handler renders `error.message` directly.
   */
  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const mapping = getErrorMapping(code);
    super(mapping.userMessage, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    if (options.details !== undefined) {
      this.details = options.details.map((detail) => ({ ...detail }));
    }
  }
}

/** What a route handler needs to answer and to log (T-FOUND-009). */
export interface MappedAppError {
  /** The §6 status for this code. */
  httpStatus: ErrorMapping['httpStatus'];
  /** Minimum level for the log line (OBSERVABILITY.md §3). */
  logLevel: ErrorMapping['logLevel'];
  /** Whether this code feeds an alert rule (OBSERVABILITY.md §5). */
  alerts: boolean;
  /** The response body (API_CONTRACT §1 envelope). */
  body: ErrorBody;
}

/**
 * Map an `AppError` to the HTTP response a route handler returns.
 *
 * Requirements: API_CONTRACT.md §1 + §6, NFR-SEC-010, T-13.
 * Task: T-FOUND-009 ("mapping helper for route handlers"). Tests: UNIT-ERR-001.
 *
 * `requestId` is supplied by the route boundary and is never set by a thrower,
 * so a user can always quote it to support (API_CONTRACT §6 rules). The body is
 * assembled from the mapping alone: no stack, no cause, no storage path.
 */
export function toRouteError(error: AppError, requestId: string): MappedAppError {
  const mapping = getErrorMapping(error.code);
  const errorBody: ErrorBody = {
    error: {
      code: error.code,
      message: mapping.userMessage,
      ...(error.details === undefined
        ? {}
        : { details: error.details.map((detail) => ({ ...detail })) }),
      requestId,
    },
  };
  return {
    httpStatus: mapping.httpStatus,
    logLevel: mapping.logLevel,
    alerts: mapping.alerts === true,
    body: errorBody,
  };
}

/**
 * The HTTP error envelope (API_CONTRACT.md §1):
 * `{ error: { code, message, details?, requestId } }`
 */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
  };
}
