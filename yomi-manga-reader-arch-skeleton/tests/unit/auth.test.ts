/**
 * Unit tests — auth pure functions.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-AUTH-*).
 *
 * TODO(T-AUTH-002/004): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-AUTH-001 (T-AUTH-002): Argon2id parameters present in produced
// hashes (m=64MB/t=3/p=4 asserted per research registry; constant-time
// compare path).
describe.todo('UNIT-AUTH-001 argon2id parameters');

// UNIT-AUTH-002 (T-AUTH-004): password policy — min length, composition
// rules, reject list of common passwords (user-facing messages per
// API_CONTRACT §6 VALIDATION_PASSWORD_POLICY).
describe.todo('UNIT-AUTH-002 password policy');
