# ADR-005: Image Pipeline

Status: Accepted
Date: 2026-09-26

## Context

Uploaded pages arrive as JPEG/PNG/WebP (occasionally HEIC/BMP/TIFF) at unbounded sizes (scan quality can exceed 2560 px). Readers range from desktops to mid-range phones on mobile data. The pipeline must normalize at ingestion (one-time CPU cost) so delivery is a cheap byte stream (ADR-004), and must serve a format ladder matching device capability (NFR-PERF-009, FR-MEDIA-002).

## Decision Drivers

1. Batch throughput: 200–500-page chapters must ingest in minutes, not hours.
2. Multi-format encode: AVIF (best bytes), WebP (compat), JPEG (universal fallback).
3. Safety: decode of untrusted input (memory bounds, format spoofing — NFR-SEC-007/008).
4. Metadata hygiene: strip EXIF/embedded data (NFR-SEC-010, NFR-SEC-016).
5. Stable, maintained library.

## Options Considered

### Option A — sharp 0.35.x (libvips, Node-API v9)

0.35.4 (2026-08-26), ~71.7M weekly downloads, 4–5× faster than ImageMagick configs, AVIF/WebP/JPEG/PNG/TIFF/GIF in+out, HEIC decode available. The de-facto standard for Node image work.

### Option B — libvips directly (no Node binding)

Same engine, but we'd shell out or write FFI glue for every operation; no DX benefit.

### Option C — jimp (pure JS)

Rejected: an order of magnitude slower on 500-page batches; AVIF encode absent.

### Option D — @napi-rs/image

Promising (Rust, modern), but a shorter production record for exactly this workload (large AVIF encode batches from untrusted input) than sharp's decade of it.

## Decision

**sharp 0.35.x** (PLANNED install at T-UPLOAD-004; not installed during the architecture phase) as the single image engine, invoked only inside `server/media` (boundary-enforced).

Pipeline contract (implemented at T-UPLOAD-004/005/006):

```
input (zip entry / multipart file)
  → safety pre-check (magic bytes → real format; NFR-SEC-007)
  → sharp.decode: validate decodability; reject non-images
  → strip: all metadata (EXIF/ICC/profiles)
  → resize: max(dim) ≤ 2560, only downscale, aspect preserved
  → encodes: avif (q≈30, 8-bit) | webp (q≈80) | jpeg (q≈82, for fallback)
  → measure: dimensions + byte sizes (persisted to ChapterPage, DATA_MODEL §10)
  → storage put (variant per extension, ADR-004 layout)
```

Rules:
- Decode failures → page-level failure; the whole job fails only if > 5% of pages fail or the first page fails (typed `UPLOAD_IMAGE_DECODE` error).
- Dimensions > 10,000 px per side are rejected pre-decode (NFR-SEC-007) — before any memory is spent.
- Concurrency: ≤ 4 pages decoded in parallel per job (memory bound on the app); sequential storage puts.
- Re-ingest (FR-UPLOAD-009): new asset keys, old keys queued for GC (never mutated in place).

## Consequences

### Positive
- One-time normalization cost; delivery is pure byte streaming (fast, cacheable, immutable — NFR-PERF-013).
- Format ladder (FR-MEDIA-002) handled by `<picture>` on the client — no runtime negotiation server-side.
- Untrusted-input safety is concentrated in one module (media), reviewable as a unit.

### Negative
- Native module: needs platform binaries (prebuilt by sharp; fallback to build-from-source in Docker — `T-FOUND-010` verifies).
- Triple encoding ~3× encode CPU vs one format; acceptable one-time cost (measured in T-PERF-001).

## Risks

- **R1:** AVIF decode coverage on old mobile browsers (2023 or earlier). → WebP + JPEG fallbacks exist; reader picks via `<picture>` (FR-MEDIA-002). AVIF remains primary because all 2024+ browsers (our baseline, Tailwind 4 parity) support it.
- **R2:** libvips memory on pathological images. → Pre-decode dimension caps (NFR-SEC-007), `limitInputPixels`, sharp concurrency cap.
- **R3:** Native build issues on a given Docker base. → Test at T-FOUND-010 with the exact production base image; fallback: `@img/sharp-linux-x64` explicit binary.

## Mitigations

Dedicated media module + boundary lint; per-page timeout (decode+encode ≤ 30 s/page, job-level watchdog); metrics on per-page duration (OBSERVABILITY.md, NFR-OBS-007).

## Revisit When

- AVIF encode quality/size at q30 is unsatisfactory for manga line art (measure at T-PERF-001) → adjust quality params or add a 2nd AVIF tier (documented, not a new ADR).
- Storage provider offers server-side transforms we'd rather use (ADR-004 Revisit When).

## References

- docs/research/2026-stack-validation.md (image pipeline section, ref [15])
- PERFORMANCE.md §4 (image budgets), SECURITY.md §6 (upload attacks), ADR-004, docs/product/admin-workflow.md §5
