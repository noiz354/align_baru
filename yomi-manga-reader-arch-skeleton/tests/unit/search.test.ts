/**
 * Unit tests — search rules.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-SEARCH-001).
 *
 * TODO(T-SEARCH-003/002): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-SEARCH-001 (T-SEARCH-003): ranking weights — exact > prefix >
// contains > creator/tag; tie-breakers stable.
describe.todo('UNIT-SEARCH-001 ranking weights');

// Query building (T-SEARCH-002, no dedicated UNIT ID in the plan):
// whitespace/length/punctuation normalization, min 2-char rule, no
// operator injection into trigram expressions.
describe.todo('query building (T-SEARCH-002)');
