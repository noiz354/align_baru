/**
 * server/media — ImageProcessorPort implementation (sharp 0.35, PLANNED
 * dependency — NOT installed in the architecture phase).
 *
 * Responsibility: the ADR-005 normalization pipeline for UNTRUSTED input:
 *   decode (magic-byte validated) → strip ALL metadata (EXIF/ICC/profiles)
 *   → resize (max 2560 px, downscale-only, aspect preserved) → encode
 *   {avif q≈30, webp q≈80, jpeg q≈82} + measured dimensions/sizes.
 * Plus the cover pipeline (max 1200 px, webp+jpeg).
 *
 * Requirements: FR-UPLOAD-004/005, ADR-005, NFR-SEC-007, NFR-PERF-009,
 * THREAT T-10 (spoofed content).
 * Tasks: T-UPLOAD-004 (pipeline), T-PERF-001 (quality tuning),
 * INT-UP-001 (normalization legs).
 *
 * Security hardening (normative — the attack fixtures exercise these):
 * - `limitInputPixels` + pre-decode dimension guard (≤ 10,000 px per
 *   side where headers allow) BEFORE heavy memory use (T-09).
 * - decode must succeed as an image or reject (UPLOAD_IMAGE_DECODE) —
 *   script-bytes-in-.jpg never reach storage (T-10).
 * - metadata strip is verified by test (EXIF GPS in fixture ⇒ absent out).
 * - per-page timeout 30 s (job watchdog 15 min, T-UPLOAD-006).
 * - concurrency ≤ 4 decodes per job (memory bound, PERFORMANCE.md §6).
 *
 * Performance: 200-page chapter ≤ 3 min wall-clock reference
 * (PERFORMANCE.md §9) — measured per job (NFR-OBS-007).
 *
 * TODO(T-UPLOAD-004): createImageProcessor() → ImageProcessorPort.
 */
export function createImageProcessor(): unknown {
  throw new Error('Not implemented: T-UPLOAD-004 (sharp pipeline)');
}
