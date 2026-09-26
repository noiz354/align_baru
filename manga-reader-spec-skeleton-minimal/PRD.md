# Product Requirements Document

## Problem and intent
Readers need a dependable, accessible way to discover and read authorized manga/comics across phones, tablets, and desktops, while creators/publishers need controlled catalog and chapter administration. Large image chapters, mixed reading direction, low bandwidth, and privacy-sensitive account state make a generic content page inadequate.

## Objectives / non-objectives
**Objectives:** licensed catalog and metadata; responsive reader modes and input methods; optional accounts/library/progress; secure authorized publishing workflows; reliable operations and observable performance. **Non-objectives:** piracy aggregation, scraping or circumvention; public UGC/comments; social feeds, recommendations/ML, payments/licensing marketplace, DRM claims, native apps, microservices, offline content download in initial scope.

## Users and JTBD
- Guest reader: quickly find an authorized work and begin reading without account friction.
- Registered reader: resume across devices, save works/bookmarks, tune reader preferences.
- Catalog editor: curate metadata and chapter ordering with preview and audit trail.
- Ingestion operator: safely prepare authorized assets, see processing/rejection status, publish deliberately.
- Operations/security: detect faults, recover service, investigate without exposing reading secrets.

## Product scope and requirements
Priority: P0 launch-critical, P1 valuable. Stable IDs are trace keys.

### Catalog and discovery
- FR-CATALOG-001 (P0): browse published works with pagination and explicit availability/status.
- FR-CATALOG-002 (P0): detail page shows titles, creators, genres/tags, synopsis, status, and ordered chapters.
- FR-CATALOG-003 (P1): filter/sort catalog using documented facets; hidden/unpublished content never leaks.
- FR-SEARCH-001 (P0): search published title aliases and metadata; validate bounded query and pagination.
- FR-SEARCH-002 (P1): provide relevance and deterministic tie ordering; disclose no promise of typo-tolerant search initially.

### Reader
- FR-READER-001 (P0): open authorized published chapter with ordered page manifest and direction/mode metadata.
- FR-READER-002 (P0): vertical, single-page, and double-page display modes; spread pairing respects first-page/cover policy and direction.
- FR-READER-003 (P0): support RTL manga and LTR comics as separate explicit direction metadata, never infer from locale.
- FR-READER-004 (P0): keyboard, pointer, touch, swipe, and configurable tap zones; controls remain operable without gestures.
- FR-READER-005 (P1): zoom and fullscreen with accessible exit and preserved viewport intent.
- FR-READER-006 (P0): responsive layout and adaptive image delivery suitable for mobile/desktop.
- FR-READER-007 (P0): recoverable per-page loading/error state and retry affordance; no broken-image dead end.
- FR-READER-008 (P0): bounded active image window; work with chapters of 50/100/200/500 pages without retaining all decoded images.
- FR-READER-009 (P0): next/previous chapter links only across published, authorized sequence; clear boundary behavior.
- FR-READER-010 (P1): progress state reflects chapter/page and completion; anonymous state is device-local only if privacy-reviewed design accepts it.
- FR-READER-011 (P0): slow connections and offline transitions show honest pending/failure state; never promise offline chapter availability.
- FR-READER-012 (P1): preferences include mode, direction override policy, fit/zoom, and input settings; defaults and sync behavior documented.
- FR-READER-013 (P0): no image response or manifest reveals storage credentials, internal keys, or unauthorized content.
- FR-READER-014 (P0): authenticated progress writes are ownership checked, monotonic/concurrency policy explicit, and resumable across devices.

### Accounts and library
- FR-AUTH-001 (P0): support secure account sign-in/out and session revocation; no implementation specified beyond ADR-006.
- FR-LIBRARY-001 (P0): authenticated user adds/removes manga from private library.
- FR-LIBRARY-002 (P0): list library with stable pagination and latest reading summary.
- FR-LIBRARY-003 (P1): bookmarks point to a chapter/page and remain valid only while target content exists.
- FR-LIBRARY-004 (P0): reading history records meaningful chapter activity with privacy policy and retention.
- FR-LIBRARY-005 (P1): user reader preferences persist and are applied with accessibility overrides.
- FR-LIBRARY-006 (P0): progress can be read/written only by owner; conflict policy prevents accidental regression.

### Administration and media
- FR-ADMIN-001 (P0): role-protected editors create/edit catalog metadata and publish/unpublish with audit event.
- FR-ADMIN-002 (P0): manage chapter ordering and publication state, with cross-entity validation.
- FR-ADMIN-003 (P0): admin operations are least-privilege, audited, and resistant to CSRF/IDOR.
- FR-ADMIN-004 (P0): ingestion status is inspectable and failed/rejected assets cannot be published.
- FR-UPLOAD-001 (P0): authorized operator initiates bounded upload of chapter source assets; server validates identity, limits, and ownership.
- FR-UPLOAD-002 (P0): validate archive structure, paths, count, compressed/uncompressed size, dimensions, formats, and content before publication.
- FR-UPLOAD-003 (P0): processing is staged/quarantined; publication is explicit and atomic at catalog boundary.
- FR-UPLOAD-004 (P0): generated delivery assets are private-origin and delivered via controlled, expiring access.

### Quality requirements
- NFR-PERF-001 (P0): meet budgets in PERFORMANCE.md at p75/p95 as applicable.
- NFR-PERF-013 (P0): image requests are prioritized around active page; speculative work is bounded/cancelable.
- NFR-PERF-014 (P0): reader retains a bounded image/decoded memory window, not chapter-sized memory.
- NFR-SEC-001 (P0): deny by default; enforce authorization on every object operation.
- NFR-SEC-011 (P0): untrusted upload/archive content is quarantined and resource bounded before decode.
- NFR-DATA-003 (P0): progress/history writes are consistent, idempotent where specified, and recoverable.
- NFR-A11Y-001 (P0): WCAG 2.2 AA target for application controls and flows; image content alternatives are editorial metadata, not fabricated OCR.
- NFR-OBS-001 (P0): correlate traces/logs/metrics without sensitive content or identifiers beyond policy.
- NFR-REL-001 (P0): backups, restore exercises, health checks, rollback and incident runbooks exist before production.

## Journeys and acceptance
Guest: discover → detail → choose chapter → reader loads first usable page → navigate/read → next chapter or return. Acceptance: only published catalog; loading/error/empty states; keyboard and touch flows verified. Member: authenticate → add library → read → progress/bookmark → return on another device. Acceptance: authorization isolation and concurrent update behavior tested. Editor: draft metadata → validate chapter/page ordering → publish → verify public view. Operator: initiate upload → quarantine/check → inspect processing state → review preview → explicitly publish or reject; no unsafe input becomes public.

## Accessibility, performance, security
Normative details in ACCESSIBILITY.md, PERFORMANCE.md, SECURITY.md. Respect reduced motion, keyboard focus, accessible names/status announcements, contrast, zoom and touch target sizing. Do not encode directional gestures as sole controls. Never treat licensed content security as DRM.

## Success metrics
P75 catalog LCP, reader first-page usable latency, chapter image failure rate, search p95, progress restore success, task completion, accessibility audit violations, upload rejection/processing outcomes, security incidents, availability and recovery objectives. Establish baseline and privacy-reviewed analytics before setting product growth targets; no invasive per-page behavioral analytics by default.

## Edge cases
See docs/product/edge-cases.md: deleted/unpublished chapter while open, zero/one page, malformed page sequence, 500-page chapters, cover pairing, mode switch, stale progress, multiple tabs/devices, expired signed delivery, slow/offline/partial loads, revoked editor, duplicate upload, malformed archive, and screen reader/reduced motion.
