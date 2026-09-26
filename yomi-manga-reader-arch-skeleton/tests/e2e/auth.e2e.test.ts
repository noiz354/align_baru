/**
 * E2E tests — auth (Playwright against a local boot; test profile per
 * DEPLOYMENT.md).
 * Canonical plan: TEST_STRATEGY.md §4 (E2E-AUTH-*).
 *
 * TODO(T-AUTH-012/013): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// E2E-AUTH-001 (T-AUTH-003/012): register → login → protected → logout;
// forms: labels, error announcement (axe); `?next=` sanitized to
// same-origin relative paths.
describe.todo('E2E-AUTH-001 register → login journey');

// E2E-AUTH-004 (T-AUTH-013): cookie flags (HttpOnly/Secure/SameSite)
// asserted on the raw Set-Cookie; cross-origin CSRF POST rejected.
describe.todo('E2E-AUTH-004 cookie flags + CSRF rejection');

// Guard authority (T-AUTH-007; no dedicated E2E ID in the plan):
// forged/absent session cookie rejected by the server-side guard (not
// just the middleware presence check).
describe.todo('forged/absent cookie guard rejection (T-AUTH-007)');
