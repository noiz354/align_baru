/**
 * TEST STRATEGY integration test — library (TEST_STRATEGY §4).
 *
 * Coverage:
 * - INT-LIB-001: add/exit idempotency (double-add is a no-op 200, not
 *   409), last-read ordering, exit-while-progress-exists (progress
 *   retained — FR-LIBRARY-003 rule), unread badge count derivation.
 *
 * TODO(INT-LIB-001): replace with real tests (real PG).
 */
import { describe } from 'vitest';

describe.todo('library add/exit semantics (INT-LIB-001)');
