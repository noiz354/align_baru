/**
 * E2E tests — catalog (Playwright).
 * Canonical plan: TEST_STRATEGY.md §4 (E2E-CATALOG-*).
 *
 * TODO(T-CATALOG-003/010): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// E2E-CATALOG-001 (T-CATALOG-003): J-1 — land → catalog (cards render,
// LCP assert) → genre filter → sort → detail page (all FR-CATALOG-006
// fields) → chapter list order; unknown slug → 404 page (no existence
// leak); draft manga invisible to anonymous.
describe.todo('E2E-CATALOG-001 J-1 catalog journey');

// E2E-CATALOG-002 (T-CATALOG-003): page 1 → 2 → back; cursor stable
// with a concurrent admin insert (two contexts).
describe.todo('E2E-CATALOG-002 pagination stability');
