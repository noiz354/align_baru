/**
 * Integration tests — progress persistence (real PG).
 * Canonical plan: TEST_STRATEGY.md §3 (INT-PROG-*).
 *
 * TODO(T-READER-021/022/015): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// INT-PROG-001 (T-READER-021/022): concurrency — 2 sessions × 50
// interleaved progress writes → final = latest server stamp; no
// constraint violations.
describe.todo('INT-PROG-001 concurrent progress writes');

// INT-PROG-002 (T-READER-015): history — session boundary (5-min idle)
// creates new rows; deepest page tracked.
describe.todo('INT-PROG-002 history session boundary');
