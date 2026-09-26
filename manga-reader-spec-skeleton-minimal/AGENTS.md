# Instructions for future coding agents

## Phase gate
Current repository is specification/skeleton only. Do not implement until a task is explicitly authorized. Never infer a feature from a route or TODO. No fake data, fake DB/auth, handlers, migrations, upload/storage behavior or production UI.

## Before coding
1. Read the relevant PRD requirement and acceptance criteria.
2. Read linked ADRs and research constraints.
3. Read the exact TASKS.md entry and dependencies.
4. Inspect architecture and module dependency rules.
5. Inspect affected public contracts and tests.
6. Identify security boundaries and abuse cases.
7. Identify performance, mobile and accessibility implications.
8. Implement the smallest coherent task slice only after authorization.

## Repository discovery
Prefer repository index/symbol search, then `rg`, then targeted reads. Avoid recursively dumping repository or broad repeated grep. Keep findings task-specific.

## After coding
Run focused verification first, then milestone-level checks: formatter/lint, strict typecheck, focused unit tests, relevant integration tests, E2E where route/user path changes, browser inspection for UI, accessibility checks, and documentation/traceability update. Do not claim tests passed if not run.

## Definition of Done
Task acceptance criteria met; security/edge cases tested; API/schema compatibility reviewed; no secrets or unrelated changes; accessibility/performance budgets considered; tests and relevant docs updated; all verification recorded; reviewer can map implementation back to requirement, ADR and task. Feature work must not be hidden in refactors.

## Invariants
- Feature modules depend on ports/contracts, not server drivers.
- Only server/db accesses SQL/database driver; only server/storage talks to object provider.
- Authorization is enforced at server application boundary, not UI.
- IDs are opaque; no physical storage paths/credentials in DTOs.
- Reader resource usage is bounded; direction is explicit metadata.
- Content is published only after authorized validation/review.
