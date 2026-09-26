/**
 * Unit tests — shared contracts.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-ERR-001).
 *
 * TODO(T-FOUND-009): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-ERR-001 (T-FOUND-009): error contract — every ErrorCode maps to
// {http, user-visible, logLevel, alert?} and the mapping is total
// (compile-time exhaustiveness), envelope shape per API_CONTRACT §1.
describe.todo('UNIT-ERR-001 error mapping totality');
