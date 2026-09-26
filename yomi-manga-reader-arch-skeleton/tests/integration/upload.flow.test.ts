/**
 * Integration tests — upload pipeline (real PG; storage port may use an
 * in-memory fake implementing ObjectStoragePort — no fake business
 * logic).
 * Canonical plan: TEST_STRATEGY.md §3 (INT-UP-*). Attack-fixture legs
 * per THREAT_MODEL T-08/T-09/T-10.
 *
 * TODO(T-UPLOAD-002…008): replace describe.todo with real tests.
 */
import { describe } from 'vitest';

// INT-UP-001 (T-UPLOAD-002/003/004/005/006/007/014/015) — the upload
// suite: (a) valid 30-page ZIP → ready, variants in MinIO, metadata
// correct, chapter publishable; (b) every attack fixture (Zip Slip,
// symlink, bomb 500 MB, 501 files, 110 MB file, spoofed MIME,
// 9999×9999 px) → failed with typed code, zero side effects; (c) job
// state transitions logged; (d) re-ingest replaces asset set, old keys
// GC-queued.
describe.todo('INT-UP-001 upload suite (valid + attack legs)');

// INT-UP-002 (T-UPLOAD-008): multipart — 3 parts → assembled → pipeline
// runs.
describe.todo('INT-UP-002 multipart assembly');
