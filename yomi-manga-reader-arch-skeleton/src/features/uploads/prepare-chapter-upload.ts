/**
 * Prepare chapter images for ingestion — the PURE security core.
 *
 * Responsibility: inspect an upload (container, entries, caps, names,
 * sizes, MIME via magic bytes, dimension pre-checks) and produce the
 * ordered image manifest (PreparedChapterUpload) — or a typed rejection.
 * ZERO I/O: the input is already-staged metadata; this function is
 * maximally unit-testable against attack fixtures (T-UPLOAD-015).
 *
 * Requirements:
 * - FR-UPLOAD-002
 * - NFR-SEC-011  (see: SECURITY.md §6 — the upload contract is normative)
 *
 * Security considerations (each has a fixture in T-UPLOAD-015):
 * - archive path traversal (Zip Slip: `..`, absolute, backslash-absolute)
 * - symlinks / hardlinks (rejected outright)
 * - misleading MIME types (magic bytes are authoritative, never the
 *   extension — spoofed .jpg containing script bytes ⇒ UPLOAD_BAD_MIME)
 * - decompression bombs (cumulative decompressed > 500 MB ⇒ abort)
 * - excessive file count (> 500 files ⇒ UPLOAD_TOO_MANY_FILES)
 * - oversized files (> 100 MB ⇒ UPLOAD_TOO_LARGE) / total (> 500 MB)
 * - oversized dimensions (> 10,000 px per side ⇒ UPLOAD_DIMENSIONS_EXCEEDED)
 * - encrypted ZIPs (flag bit ⇒ UPLOAD_BAD_CONTAINER, friendly message)
 * - non-UTF8 entry names (⇒ UPLOAD_BAD_ENTRY_NAME)
 *
 * References:
 * - SECURITY.md §6
 * - THREAT_MODEL.md (T-08, T-09, T-10)
 * - docs/product/admin-workflow.md §5
 *
 * Tasks:
 * - T-UPLOAD-014
 * - T-UPLOAD-015
 *
 * Invariants (normative):
 * - total function over the documented input table: every fixture ⇒ exact
 *   typed code (UNIT-UP-001/002)
 * - pure: same input ⇒ same output; no clock, no RNG, no I/O
 * - manifest order = archive order (reading order; documented)
 * - fileNames are display-only (truncated, sanitized) — NEVER used for
 *   storage keys (keys are 128-bit random, T-UPLOAD-005)
 *
 * TODO:
 * Actual implementation belongs to VS-7 / T-UPLOAD-014.
 */
import type { ChapterUploadInput, PreparedChapterUpload } from '../../shared/contracts';

export async function prepareChapterUpload(
  input: ChapterUploadInput,
): Promise<PreparedChapterUpload> {
  throw new Error('Not implemented: T-UPLOAD-014');
}
