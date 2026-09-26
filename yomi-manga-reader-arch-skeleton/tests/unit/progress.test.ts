/**
 * Unit tests — progress semantics.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-PROG-*).
 *
 * TODO(T-READER-021/023): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-PROG-001 (T-READER-021): idempotency — identical update twice →
// 1 row, no changed.
describe.todo('UNIT-PROG-001 update idempotency');

// UNIT-PROG-002 (T-READER-021): LWW — older server timestamp never
// overwrites newer.
describe.todo('UNIT-PROG-002 last-write-wins ordering');

// UNIT-PROG-003 (T-READER-023): merge on sign-in (FR-READER-013) —
// local vs server, per-chapter latest wins.
describe.todo('UNIT-PROG-003 sign-in merge');
