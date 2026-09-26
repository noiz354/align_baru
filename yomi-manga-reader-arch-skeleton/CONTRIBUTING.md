# CONTRIBUTING.md

For humans and coding agents working in this repository. The operating contract for agents is `AGENTS.md` — read it first. This file covers repository conventions.

## 1. Golden Rules

1. **Specs first, always.** Every change traces to requirement IDs (FR-*/NFR-*) and a task ID (T-*) in `TASKS.md`. No untraceable code. If the work isn't in TASKS.md, the task is created (with requirement mapping) before code.
2. **ADRs are law until amended.** A change contradicting an Accepted ADR requires a new ADR (process in `ADR.md`).
3. **No fake implementations.** Skeletons throw `Not implemented: T-*`. Tests use `describe.todo` until the task is executed. Never hardcode product data (seed harness is the only fixture path — TEST_STRATEGY.md §6).
4. **Dependency rules are enforced.** `features/*` never imports `server/*`; only `server/db` imports drizzle; only `server/storage` imports the S3 SDK; only `server/telemetry` imports OTel SDK packages. ESLint boundary rules fail CI otherwise (T-FOUND-011).

## 2. Branching & Commits

- Branch: `task/T-<MODULE>-<NNN>-<slug>` (e.g., `task/T-READER-031-reader-window`).
- Commit messages: Conventional Commits — `feat(reader): ...`, `fix(uploads): ...`, `test(reader): ...`, `docs: ...`, `chore: ...`. Reference the task ID in the body: `Task: T-READER-031`.
- One task = one branch = one PR. A task may need multiple commits; it must not span unrelated tasks.

## 3. Definition of Done (per task — normative for agents too)

A task is done when ALL hold:

1. Implementation matches the task's Expected behavior, edge cases, and security notes.
2. Requirement IDs listed on the task are satisfied (checked against PRD text).
3. Planned tests for the task exist and pass (TEST_STRATEGY.md IDs); no `describe.todo` remains for that task.
4. `npm run typecheck`, `npm run lint`, `npm run test:unit` pass.
5. Integration tests pass when the task touches persistence (Docker PG/MinIO).
6. E2E updated/added when the task is user-visible; a11y (axe) passes on touched routes.
7. Browser inspection performed for any UI change (desktop + mobile viewport) — screenshot in the PR.
8. Docs touched if behavior/contracts changed (PRD wording unchanged unless requirement amended; API_CONTRACT/DATA_MODEL updated if shapes changed).
9. No dependency added without research-registry entry (docs/research/2026-stack-validation.md).
10. No secrets, no fake data, no TODOs without task IDs.

## 4. Verification Commands (planned — wired in VS-0, T-FOUND-001/011)

```
npm run typecheck        # tsc --noEmit (strict)
npm run lint             # eslint (incl. boundary rules) + prettier check
npm run test:unit        # vitest run tests/unit
npm run test:integration # vitest run tests/integration (needs compose: up)
npm run test:e2e         # playwright test (needs app + compose + seed)
npm run build            # next build (CI)
npm run perf:bundle      # bundle budget check (T-PERF-003)
```

Order of verification (fast first): typecheck → lint → focused unit → integration (if DB/storage touched) → E2E (if user-visible) → build.

## 5. Dependencies

- Install: `npm ci` only (lockfile is committed; never hand-edit the lockfile).
- New/updated dependency: must be SELECTED/PLANNED/OPTIONAL in the research registry, or get an ADR note + registry row in the same PR. `npm audit --audit-level=high` blocks CI.
- Version bumps: patch/minor via dependency automation (reviewed); major = ADR or task-level justification + full milestone verification.

## 6. Code Style

- TypeScript strict (tsconfig is the source of truth); no `any` (escape hatch: `unknown` + narrowing, with a comment).
- Naming: files kebab-case, types/interfaces PascalCase, functions/vars camelCase, feature dirs as in the module map.
- Comments: explain *why* and link (requirement/task/ADR). Skeleton-phase comment density is the bar — preserve it.
- Error handling: throw typed `AppError` (shared/contracts/errors.ts); route handlers map to the API contract — never leak internals.

## 7. Review Checklist (self-review before PR)

- [ ] Traces to task + requirements (IDs in PR description).
- [ ] Boundary rules respected (imports).
- [ ] Security implications considered (THREAT_MODEL row if a new surface).
- [ ] Performance implications considered (PERFORMANCE budget if hot path).
- [ ] a11y for UI (axe + keyboard).
- [ ] Tests: unit always; integration if data; E2E if user-visible.
- [ ] Docs updated (contracts/data model/runbook if applicable).
- [ ] Browser-verified for UI.

## 8. Documentation Update Triggers

| Change | Update |
|---|---|
| New route | `src/app` map in ARCHITECTURE.md, API_CONTRACT if API |
| New table/column | DATA_MODEL.md + migration + repository skeleton comment |
| New API operation | API_CONTRACT.md + error taxonomy if new codes |
| New dependency | research registry |
| New ADR-level decision | docs/adr/ + ADR.md index |
| New requirement | PRD.md (with ID) + traceability table (final-review.md) |
| New task | TASKS.md (epic section) + ROADMAP slice mapping |
