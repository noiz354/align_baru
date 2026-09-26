/**
 * Unit tests — catalog domain rules.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-MANGA-001).
 *
 * TODO(T-CATALOG-001): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-MANGA-001 (T-CATALOG-001): slug generation/uniqueness rules;
// alias normalization.
describe.todo('UNIT-MANGA-001 slug + alias rules');

// Visibility matrix (T-CATALOG-001, no dedicated UNIT ID in the plan):
// status × published × deleted — draft/deleted never visible to
// non-admin; admin override path.
describe.todo('isMangaVisible matrix (T-CATALOG-001)');
