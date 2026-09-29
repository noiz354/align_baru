/**
 * The machine-checked inventory of what is not implemented.
 *
 * Why this file exists
 * --------------------
 * A file-existence check is the wrong instrument for most of this codebase's gaps.
 * A port with no implementation usually still HAS a file: `search.repository.ts`
 * declares the interface, `admin.service.ts` declares the service, and the factory
 * inside throws. Counting files would report those as done — which is exactly the
 * false completion that the `WIRED` bucket was deleted for in `ab19d63`.
 *
 * So the evidence is the THROW, not the file. Every entry below asserts two things
 * at once, and `scripts/check-claims.mjs` fails the build if either stops holding:
 *
 *   1. the file exists, and
 *   2. it still contains `Not implemented: <task>` for that exact task.
 *
 * When a port is implemented, the throw disappears — and this inventory then FAILS
 * until the entry is removed. That is the intended direction of failure. An
 * inventory that cannot be stale is the point; `PLANNED_REPOSITORIES` in
 * `server/db/repositories/index.ts` guards the opposite case (a port listed as
 * pending that has since gained a file) and this guards this one.
 *
 * Scope
 * -----
 * Every `throw new Error('Not implemented: T-…')` reachable in shipped code, one
 * entry per (file, task) pair. A file that throws for two tasks has two entries.
 *
 * Excluded on purpose: `queries/reader-state.ts`, whose defects are a different
 * class of problem — it is not a stub, it is working code that violates an
 * invariant, and it is scheduled for deletion in F-006-S2 rather than here.
 *
 * Related: specs/yomi/ARCHITECTURE.md §5 (which ports have no implementation),
 * specs/yomi/execution/CHECKLIST.md (the plan that closes them).
 *
 * Requirements: NFR-SEC-015 (no runtime value in a machine-read literal)
 * Tasks: T-FOUND-009, F-023-S1
 */

export interface PendingPort {
  /** Path relative to THIS file's directory, so the inventory is self-contained
   *  and cannot mean the wrong root of a monorepo. Everything here is one level
   *  up, because this file sits in `src/`. */
  readonly file: string;
  /** The task the stub throws, so the entry and the code cannot drift apart. */
  readonly task: string;
}

export const PLANNED_STUB_PORTS: readonly PendingPort[] = [
  // ── auth (deferred track) ──────────────────────────────────────────────────
  { file: '../server/auth/session-store.ts', task: 'T-AUTH-006' },
  { file: '../features/auth/session.ts', task: 'T-AUTH-006' },
  { file: '../features/auth/auth.service.ts', task: 'T-AUTH-001' },
  { file: '../features/auth/password.ts', task: 'T-AUTH-002' },
  { file: '../middleware.ts', task: 'T-AUTH-007' },

  // ── search (F-010/011/012) ─────────────────────────────────────────────────
  // `search.service.ts` (T-SEARCH-001) and `api/search/route.ts` (T-SEARCH-003)
  // left this list in F-011, and `app/search/page.tsx` (T-SEARCH-001/003) in
  // F-012 when `NotYetBuilt` was replaced by the real page — each time
  // `check-claims.mjs` failed the build on the stale entry, which is the point:
  // the inventory cannot outlive the code it describes.

  // ── admin + upload (F-016/017, service layer only — no routes) ─────────────
  { file: '../features/admin/admin.service.ts', task: 'T-ADMIN-001' },
  { file: '../features/uploads/upload-pipeline.ts', task: 'T-UPLOAD-006' },
  { file: '../features/uploads/prepare-chapter-upload.ts', task: 'T-UPLOAD-014' },
  { file: '../server/media/image-processor.ts', task: 'T-UPLOAD-004' },
  { file: '../app/api/uploads/prepare/route.ts', task: 'T-UPLOAD-008' },
  { file: '../app/api/uploads/[jobId]/status/route.ts', task: 'T-UPLOAD-009' },
  { file: '../app/api/uploads/[jobId]/finalize/route.ts', task: 'T-UPLOAD-010' },

  // ── reader helpers (F-007) ─────────────────────────────────────────────────
  { file: '../features/reader/reader-window.ts', task: 'T-READER-031' },
  { file: '../features/reader/page-index.ts', task: 'T-READER-032' },
  { file: '../features/reader/reader-state.ts', task: 'T-READER-001' },
  { file: '../features/reader/reader-state.ts', task: 'T-READER-003' },

  // ── observability ──────────────────────────────────────────────────────────
  { file: '../server/telemetry/otel.ts', task: 'T-OBS-001' },
  { file: '../app/readyz/route.ts', task: 'T-OBS-004' },
  { file: '../app/api/reader/beacon/route.ts', task: 'T-OBS-007' },
] as const;
