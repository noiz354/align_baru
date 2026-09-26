/**
 * E2E tests — reader UX (Playwright).
 * Canonical plan: TEST_STRATEGY.md §4 (E2E-READER-*); behavior spec:
 * docs/product/reader-behavior.md.
 *
 * TODO(T-READER-001…008/011/017/022/027): replace describe.todo with
 * real tests.
 */
import { describe } from 'vitest';

// E2E-READER-001 (T-READER-001/004/005): vertical RTL — scroll through
// 20 pages of a seeded 30-page chapter; progress restored after reload
// (FR-READER-012).
describe.todo('E2E-READER-001 vertical RTL + restore');

// E2E-READER-002 (T-READER-002/008): single-page LTR — next/prev via
// keyboard; swipe gesture (touch emulation) with cancel.
describe.todo('E2E-READER-002 single LTR keyboard + swipe');

// E2E-READER-003 (T-READER-006/007): double-page LTR odd page → single
// fallback; RTL pairing order correct (visual + DOM order).
describe.todo('E2E-READER-003 double-page pairing');

// E2E-READER-007 (T-READER-027): 500-page marathon (lab phone profile)
// — scroll 500 pages, assert residency ≤ 12 (CDP), heap delta, no
// > 50 ms jank samples, INP ≤ 200 ms.
describe.todo('E2E-READER-007 500-page marathon');

// E2E-READER-008 (T-READER-023): deep-link fuzz — /manga/x/chapter/1
// with ?page=999 / -3 / abc → clamped with notice, no crash
// (deep-link wins over stored progress).
describe.todo('E2E-READER-008 deep-link fuzz');

// E2E-READER-022 (T-CATALOG-010): asset key enumeration — 1000 random
// keys → all 404; Content-Type nosniff on every response.
describe.todo('E2E-READER-022 asset enumeration');
