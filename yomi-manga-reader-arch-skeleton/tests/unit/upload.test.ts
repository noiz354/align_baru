/**
 * Unit tests — upload validation core.
 * Canonical plan: TEST_STRATEGY.md §2 (UNIT-UP-*).
 *
 * TODO(T-UPLOAD-014/003): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// UNIT-UP-001 (T-UPLOAD-014): prepareChapterUpload validation table —
// 501 files, 110 MB file, 501 MB total, bad magic bytes, 0-byte file,
// disallowed extension → each typed code.
describe.todo('UNIT-UP-001 prepare validation table');

// UNIT-UP-002 (T-UPLOAD-003): path normalization — `..` entries,
// absolute, backslash, symlink flag → rejected codes (Zip Slip class,
// THREAT T-08).
describe.todo('UNIT-UP-002 path normalization');
