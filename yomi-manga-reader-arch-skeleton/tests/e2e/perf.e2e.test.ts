/**
 * E2E tests — performance budgets (automated non-functional gates).
 * Canonical plan: TEST_STRATEGY.md §5 (gates) + §4 (E2E-READER-007
 * marathon); budgets: PERFORMANCE.md §2 (normative).
 *
 * No dedicated E2E-PERF-* IDs exist in the plan — this file is the
 * budget-assertion runner for T-PERF-005 (throttled profile: slow-3G
 * network + 4× CPU).
 *
 * TODO(T-PERF-005): replace describe.todo with real assertions
 * (Playwright tracing + budget script).
 */
import { describe } from 'vitest';

// Reader hot path: LCP, TTI, first-page time for 50/200/500-page
// chapters (E2E-READER-007 is the 500-page representative); INP ≤ 200 ms
// on navigation.
describe.todo('reader budgets (PERFORMANCE §2)');

// Catalog + search: grid TTFB p95, search TTFB p95 (INT-SEARCH-001
// carries the 10k-title ≤ 400 ms p95 load leg — NFR-PERF-005).
describe.todo('catalog/search budgets (PERFORMANCE §2)');
