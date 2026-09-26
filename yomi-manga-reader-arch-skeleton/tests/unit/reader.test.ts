/**
 * Unit tests — reader pure functions.
 * Canonical plan: TEST_STRATEGY.md §2 (IDs UNIT-READER-*); tasks per table.
 *
 * TODO(T-READER-003/031/032): replace describe.todo with real tests
 * (pure functions — no mocks, no I/O).
 */
import { describe } from 'vitest';

// UNIT-READER-001 (T-READER-003): ReaderState reducer — every transition
// (mode, direction, zoom, page) preserves invariants (page in [1..M],
// window valid, direction flip keeps logical page).
describe.todo('UNIT-READER-001 reducer invariants');

// UNIT-READER-002 (T-READER-032): page index — negative, zero, > M, NaN,
// non-integer inputs → clamped/rejected (no negative page indexes).
describe.todo('UNIT-READER-002 page index validation');

// UNIT-READER-004 (T-READER-031): calculateReaderWindow — first/last/
// middle page, chapter smaller than window, 500-page chapter, mode
// sizes, hard cap 12.
describe.todo('UNIT-READER-004 window calculation');

// UNIT-READER-005 (T-READER-031): window recompute idempotency +
// rapid-navigation sequences (1k random walks fuzz).
describe.todo('UNIT-READER-005 window fuzz');
