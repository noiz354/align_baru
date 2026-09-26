/**
 * E2E tests — admin curator loop (Playwright, admin profile).
 * Canonical plan: TEST_STRATEGY.md §4 (E2E-ADMIN-*).
 *
 * TODO(T-ADMIN-001…005, T-UPLOAD-010): replace describe.todo with real
 * tests (uses tests/fixtures/ samples).
 */
import { describe } from 'vitest';

// E2E-ADMIN-001 (T-ADMIN-001…005): J-4 curator loop end-to-end — create
// manga → chapter → upload 30-page ZIP → ready → publish → read.
describe.todo('E2E-ADMIN-001 curator loop');

// E2E-ADMIN-002 (T-SEC-003): J-5 + IDOR — reader calling admin endpoints
// → 403/404; failed upload shows the typed reason in the UI (never raw
// error text, NFR-SEC-010).
describe.todo('E2E-ADMIN-002 IDOR + typed failure reason');
