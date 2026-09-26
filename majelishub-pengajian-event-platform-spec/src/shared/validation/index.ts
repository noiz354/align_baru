/**
 * Validation schemas live here, one file per contract area, and are shared by:
 *   - Server Actions / route handlers (input validation, API.md)
 *   - forms (client-side pre-checks, which are UX only - the server re-validates)
 *   - tests/unit/contracts/** (accept/reject corpora)
 *
 * Rules:
 *   1. A schema never accepts a field the data inventory (PRIVACY.md §4) does not justify.
 *   2. Rejection messages never echo the submitted value (no tokens, no contacts).
 *   3. Schemas are the single source of truth for field limits; the UI reads them, never duplicates
 *      magic numbers.
 *
 * TODO(T-ARCH-001): add one module per area - registration.ts, checkin.ts, audio.ts, transcript.ts,
 *   feedback.ts, notifications.ts - each exporting a schema and its inferred type.
 */
export {};
