/**
 * E2E tests — accessibility (WCAG 2.1 AA gates, VS-10).
 * Canonical plan: TEST_STRATEGY.md §4 (a11y legs live in E2E-READER-017
 * and E2E-AUTH-001); spec: ACCESSIBILITY.md.
 *
 * Harness note: Playwright removed page.accessibility() in v1.57 — use
 * @axe-core/playwright + keyboard scripts only (docs/research/2026).
 *
 * TODO(T-READER-017/018, T-AUTH-012, T-SEC-001): replace describe.todo
 * with real tests.
 */
import { describe } from 'vitest';

// E2E-READER-017 (T-READER-017): axe pass on reader mid-state;
// keyboard-only full journey (catalog → read → library → bookmarks);
// focus initial/trap/restore; reduced-motion media emulation.
describe.todo('E2E-READER-017 reader a11y (axe + keyboard)');

// E2E-AUTH-001 (form legs, T-AUTH-012): labeled inputs, error
// announcement (role=alert + aria-describedby), skip link, focus
// management on route change.
describe.todo('form a11y legs (E2E-AUTH-001)');
