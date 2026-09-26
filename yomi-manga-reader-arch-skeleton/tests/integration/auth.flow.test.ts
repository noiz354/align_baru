/**
 * Integration tests — auth flows (real PG, real argon2, per-test
 * transaction rolled back).
 * Canonical plan: TEST_STRATEGY.md §3 (INT-AUTH-*).
 *
 * TODO(T-AUTH-003/004/006/010): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// INT-AUTH-001 (T-AUTH-004/005/006): register → login (cookie set, flags
// correct) → protected call OK → logout → call 401; second login rotates
// token.
describe.todo('INT-AUTH-001 register/login/logout round-trip');

// INT-AUTH-003 (T-AUTH-010): rate limits — 11th login/min/IP → 429
// RATE_LIMIT_LOGIN; per-account limit.
describe.todo('INT-AUTH-003 login rate limiting');
