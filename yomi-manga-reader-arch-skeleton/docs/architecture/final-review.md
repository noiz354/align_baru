# Final Architecture Review — Yomi (Manga Reader)

Date: 2026-09-26 · Phase: specification + architecture + skeleton (no implementation)
Auditor role: Principal Software Architect · Status: **APPROVED for implementation start (T-FOUND-001)**

## 1. Scope & Method

Audited the complete deliverable set:

- 38 Markdown documents (19 root, 9 ADRs, 4 architecture, 4 product, 1 research registry, 1 fixtures guide)
- 114 TypeScript/TSX skeleton files (92 under `src/`, 22 under `tests/`)
- Tooling config: `package.json`, `tsconfig.json`, `.nvmrc`, `.gitignore`, `.editorconfig`

Method: automated cross-reference checks (word-bounded ID sets), full strict
typecheck, manual module-boundary review, and spot verification of task-ID
semantics against TASKS.md definitions. Per the phase constraint, every fix
applied in this review is **documentation or skeleton alignment only** — no
feature, query, handler, or integration was implemented.

## 2. Findings & Fixes (applied in this review)

| ID | Severity | Location | Finding | Fix applied |
|---|---|---|---|---|
| F-01 | compile | `src/shared/contracts/errors.ts` | Comment text `UPLOAD_*/STORAGE_*` contains a literal `*/` that terminated the block comment early; the tail of the comment parsed as code (octal/decimal errors). | Reworded to "all UPLOAD_* and STORAGE_*". Swept all 114 files for the pattern — only this file affected. |
| F-02 | compile | `src/shared/types/ids.ts` | Invalid `declare brand { const B: unique symbol }` syntax. | Replaced with the standard ambient brand: `declare const BRAND: unique symbol`. |
| F-03 | compile | `src/shared/validation/env.ts` | `import type { z } from 'zod'` + `extends z.ZodType` while zod is PLANNED-not-installed (TS2307). | Removed the import; `Env` is now a documented empty placeholder interface whose fields land with the Zod schema at T-FOUND-002. |
| F-04 | compile | `src/shared/contracts/{manga,reader}.ts` | `ReadingDirection` exported from both modules → TS2308 on the `export *` barrel. | Canonical definition kept in `manga.ts` (a property of the title, FR-READER-004/005); `reader.ts` imports it. |
| F-05 | traceability | `tests/**` (17 files) | Test skeletons cited non-canonical test IDs (e.g., `INT-CH-001`, `INT-DB-001`, `INT-READER-001`, `INT-UP-003`, `E2E-AUTH-005`, `E2E-CATALOG-003`, `E2E-READER-014`, `E2E-UPLOAD-001`, `E2E-A11Y-001/002`, `E2E-PERF-001`) that do not exist in TEST_STRATEGY.md. | All test files reconciled to the canonical UNIT/INT/E2E IDs from TEST_STRATEGY §2–§4; extra assertions beyond the plan cite their owning task (e.g., `commitPages atomicity (T-CATALOG-001)`). |
| F-06 | doc cross-ref | `TEST_STRATEGY.md` (E2E-READER-022 row) | Cited task `T-MEDIA-001`, which does not exist in TASKS.md. | Corrected to `T-CATALOG-010` (Cover asset delivery — owns INT-MEDIA-001 + E2E-READER-022 fuzz per its Testing line). |
| F-07 | doc cross-ref | `TEST_STRATEGY.md` (E2E-CATALOG-002 row) | Cited task `T-CATALOG-010` (a media-delivery task) for pagination coverage. | Corrected to `T-CATALOG-003` (Catalog page SSR — its Testing line already lists E2E-CATALOG-002). |
| F-08 | note (no change) | `TEST_STRATEGY.md` (UNIT-AUTH-002 row) | Password-policy unit test attributed to T-AUTH-004 (sign in) while policy is enforced at registration (T-AUTH-003). | Accepted as-is: the policy function serves both flows (registration + sign-in rejection); the attribution is defensible and both tasks' Testing lines remain coherent. |
| F-09 | environment | sandbox | Node v20.20.2 in the sandbox vs `engines: >=24 <25` (EBADENGINE warning on install). | Documented, not a defect: typecheck runs cleanly on 20; all runtime work (T-FOUND-001+) executes under Node 24 per `.nvmrc` and DEPLOYMENT.md §1. |

## 3. Verification Results (all green after fixes)

1. **Typecheck:** `npx tsc --noEmit` — TypeScript 6.0.3, `strict` plus
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `verbatimModuleSyntax`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
   — **0 errors** across all 114 files.
2. **ID cross-references** (word-bounded set difference, canonical docs → skeleton/tests):
   - Requirement IDs (FR/NFR, incl. `NFR-A11Y-*`): **0** missing vs PRD.md.
   - Task IDs (`T-*`): **0** missing vs TASKS.md.
   - Test IDs (`UNIT-*/INT-*/E2E-*`): **0** missing vs TEST_STRATEGY.md.
   - (Initial audit used a too-narrow pattern that skipped `NFR-A11Y`;
     re-run with the broadened pattern — result unchanged.)
3. **Error taxonomy parity:** 40 concrete `ErrorCode`s in
   `src/shared/contracts/errors.ts` ↔ the 31 rows of API_CONTRACT.md §6
   (families expanded: `VALIDATION_*` → 2, `RATE_LIMIT_*` → 7 with exact
   member match, `INTERNAL_*` → 1). No code exists outside the table and no
   table row is unrepresented.
4. **No-implementation audit:** 33 `throw new Error('Not implemented: T-*')`
   stubs across 31 files; 0 SQL strings, 0 crypto calls, 0 hardcoded data
   sets, 0 mock implementations. The two `SELECT`/`UPDATE` grep hits are
   comment text only.
5. **Dependency discipline:** installed dev packages — `typescript 6.0.3`,
   `@types/node`, `@types/react`, `@types/react-dom`, `vitest 4.1.x`
   (+ transitive). Zero runtime dependencies; every product dependency
   (next, react runtime, drizzle, @aws-sdk, sharp, argon2, pino, OTel SDK
   modules, playwright) remains PLANNED in `docs/research/2026-stack-validation.md`
   and is installed only by its owning task.
6. **Boundary spot-check (rules D1–D9, dependency-rules.md):** features import
   shared only; server implements ports without importing feature logic; the
   web layer (routes/RSC) constructs nothing (composition root only); every
   feature package exposes a single `index.ts` public surface.

## 4. Traceability Table

Requirement group → governing ADRs → owning modules → EPIC / vertical slice
→ representative skeleton → planned tests.

| Req group (count) | ADRs | Modules | EPIC / VS | Skeleton (representative) | Tests (canonical IDs) |
|---|---|---|---|---|---|
| FR-CATALOG (8) | 001, 002, 003 | features/catalog, server/db, src/app/discover+manga | EPIC-02 / VS-1 | catalog.service.ts, manga.repository.ts, discover/page.tsx, manga/[slug]/page.tsx | UNIT-MANGA-001; INT-CAT-001, INT-CHAP-001; E2E-CATALOG-001/002 |
| FR-READER (24) | 007 (+001) | features/reader, src/app reader route | EPIC-03 / VS-2, VS-3, VS-4 | reader-state.ts, reader-window.ts, page-index.ts, reader page shell | UNIT-READER-001…010; E2E-READER-001…008/017/019/022 |
| FR-CHAPTER (4) | 003 | features/chapters | EPIC-02 / VS-1 | chapters.repository.ts (commitPages contract) | INT-CHAP-001; commitPages atomicity (T-CATALOG-001) |
| FR-AUTH (10) | 006 | features/auth, server/auth, src/middleware.ts | EPIC-04 / VS-5 (+EPIC-09 hardening) | auth.service.ts, password.ts, session.ts, session-store.ts, middleware.ts | UNIT-AUTH-001…003; INT-AUTH-001…004; E2E-AUTH-001/004 |
| FR-LIBRARY (10) | 002, 003 | features/library, features/progress | EPIC-05 / VS-5 | library.service.ts, reader-progress.repository.ts, history.repository.ts | INT-LIB-001, INT-PROG-001/002; E2E-LIB-001 |
| FR-MEDIA (3) | 004, 005 | server/media, server/storage | EPIC-07 / VS-7 (+T-CATALOG-010) | page-delivery.ts, object-storage.ts | INT-MEDIA-001; E2E-READER-022 |
| FR-UPLOAD (11) | 004, 005 | features/uploads, server/storage, server/media | EPIC-07 / VS-7 | prepare-chapter-upload.ts, upload-pipeline.ts, upload.repository.ts | UNIT-UP-001/002; INT-UP-001/002; E2E-ADMIN-001/002 |
| FR-SEARCH (5) | 009 | features/search | EPIC-08 / VS-8 | search.service.ts, search.repository.ts | UNIT-SEARCH-001; INT-SEARCH-001; E2E-SEARCH-001 |
| FR-ADMIN (8) | 006 (guards) | features/admin, src/app/admin | EPIC-06 / VS-6 | admin.service.ts, admin route shells | INT-ADMIN-001/002; E2E-ADMIN-001/002 |
| NFR-PERF (15) | 007, 004 | features/reader (window), server/media | EPIC-11 / VS-4, VS-11 | reader-window.ts (cap 12), page-delivery.ts (immutable cache) | E2E-READER-007 (500-page marathon); INT-SEARCH-001 (≤ 400 ms p95); perf budget file (T-PERF-005) |
| NFR-SEC (16) | 006, 004, 005 | server/auth guards, features/uploads, server/storage | EPIC-09 / VS-9 | session-store.ts (guards), prepare-chapter-upload.ts (caps), object-storage.ts (no passthrough) | T-SEC-001…007; INT-UP-001 (attack legs); E2E-READER-019/022 |
| NFR-OBS (7) | 008 | server/telemetry | EPIC-10 / VS-10 | otel.ts, beacon route shell | INT-OBS-001; E2E-OBS-001 |
| NFR-DATA (6) | 002, 003 | server/db | EPIC-01 / VS-0 | schema.ts (descriptive), db/index.ts | schema assertions (T-FOUND-006) |
| NFR-OPS (6) | 009 | server/composition, healthz/readyz routes | EPIC-12 / VS-11 | composition.ts, healthz/route.ts, readyz/route.ts | T-PROD-*; E2E-OBS-001 (readiness) |
| NFR-A11Y (10) | 001 (React/Next) | shared/ui, all route shells | cross-cutting (gate at VS-10) | AppShell.tsx (landmarks, skip link), not-found.tsx, error.tsx | E2E-READER-017 (axe + keyboard); E2E-AUTH-001 form legs |

Coverage: 143 requirements (83 FR + 60 NFR), 145 tasks, 12 EPICs, 12
vertical slices, 9 ADRs — every row above has at least one skeleton file and
at least one planned test ID, closing the PRD → ADR → architecture →
TASKS → skeleton → test chain.

## 5. Residual Risks & Revisit Triggers (carried from ADRs, unchanged)

- TypeScript 7.x native compiler — revisit only when a stable programmatic
  API ships (ADR-001; research: none as of 2026-09).
- Drizzle 1.0 GA vs 0.45.x — revisit at GA (ADR-003).
- Prisma 8 GA (Oct 2026) — decision already closed against it; no revisit
  unless the rejected drivers' assumptions break (ADR-002).
- `@opentelemetry/sdk-node` — remains experimental; if it stabilizes,
  re-evaluate init ergonomics only, not the api/SDK split (ADR-008).
- Node 26 LTS (2026-10) — engines stay pinned to 24 for this release;
  upgrade is an ops task (DEPLOYMENT.md §8).
- Reader window size (cap 12) — calibrate at VS-4 with the E2E-READER-007
  marathon data (PERFORMANCE.md §3).

## 6. Conclusion

The specification, architecture, and skeleton are internally consistent:
every ID resolves, every requirement has an owning module, task, slice,
skeleton file, and planned test; the tree typechecks clean under the
hardened strict config; and no implementation logic exists (all behavior is
contract + `Not implemented` stubs). The repository is ready for
**T-FOUND-001 (Project bootstrap & toolchain)** as the first execution task.
Per the phase constraint, that task was **not** executed in this session.
