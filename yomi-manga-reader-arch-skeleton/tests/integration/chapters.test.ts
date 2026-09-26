/**
 * Integration tests — chapter repository (real PG).
 * Canonical plan: TEST_STRATEGY.md §3 (INT-CHAP-001).
 *
 * TODO(T-CATALOG-001/007): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// INT-CHAP-001 (T-CATALOG-007): chapter order — number with decimals
// (10.5), tiebreak by reading_order, drafts excluded for non-admin.
describe.todo('INT-CHAP-001 chapter ordering');

// commitPages atomicity (T-CATALOG-001): partial commit rejected
// all-or-nothing (page insert + metadata in one transaction);
// re-commit (re-ingest) replaces the page set; deleted-chapter guard.
describe.todo('commitPages atomicity (T-CATALOG-001)');
