# TESTING.md — Test Strategy

> 2026-09-26 · Status: **STRATEGY SPECIFIED, SKELETONS ONLY** · No test in this repository executes product logic; every test file is a `describe.todo` placeholder tied to a task ID.
> Tooling decision: docs/research/STACK-2026.md#7 (Vitest 4, Vitest Browser Mode stable, Playwright 1.62, axe-core).

## 1. Principles

| # | Principle |
| --- | --- |
| TP-1 | **Tests are the executable form of the requirements.** Names include the requirement and task ID. |
| TP-2 | **Test behaviour, not implementation.** Domain tests call services with a fake clock and in-memory ports; they never reach the database. |
| TP-3 | **Boundaries get integration tests.** Authorization, household scoping, transactions, idempotency, and scheduler behaviour are tested against a real Postgres. |
| TP-4 | **A bug fix starts with a failing test** (named after the bug, referencing the task). |
| TP-5 | **No test depends on wall-clock time.** The `Clock` port is injected everywhere. |
| TP-6 | **No test depends on ordering or on other tests' data.** Each integration test seeds its own household fixture. |
| TP-7 | **Fast by default.** Unit suite must stay under ~10 s locally; integration under ~60 s; E2E is the slow tier. |
| TP-8 | **Conversion, not accumulation.** `describe.todo` skeletons become real tests; we do not create parallel copies. |
| TP-9 | **Accessibility is testable** (axe pass + keyboard path per journey), not just a manual aspiration. |
| TP-10 | **Security tests are negative tests** — they assert that the wrong thing fails. |

## 2. Test layers

| Layer | Tooling | Runs against | Owns | Target count (per slice) |
| --- | --- | --- | --- | --- |
| Unit | Vitest (node) | Pure functions, domain services with fakes | Recurrence, thresholds, dedupe keys, status derivation, transitions, time math, validation schemas | 15–40 |
| Integration | Vitest + real Postgres (docker compose) | Repository ports, authorization, transactions, scheduler jobs, notification policy | Household isolation, idempotency, cascades, alert lifecycle, outbox drain | 6–15 |
| Component | Vitest Browser Mode (Playwright provider) | Real DOM, real events | Card/row interactions, keyboard paths, empty/loading/error states | 4–10 |
| E2E | Playwright | Full app in a container with seeded data | The journeys in QA.md, plus PWA/offline behaviour | 2–5 |
| Accessibility | axe-core via Playwright + component tests; manual SR pass | Rendered pages | WCAG 2.2 AA checks per ACCESSIBILITY.md §9 | per UI task |
| Performance | Playwright trace + Lighthouse budgets | Built app | PERFORMANCE.md PB-C1..C7 | 1–2 |

## 3. What must be covered (mapped to risk)

| Risk area | Required coverage |
| --- | --- |
| Household isolation (T-01/T-02) | One isolation test per repository port and per dashboard read model |
| Authorization (T-03) | Negative tests per role for every operation in docs/security/AUTHZ-MATRIX.md |
| Recurrence correctness (ADR-007) | Calendar, completion-anchored, DST, month clamping, leap year, anchor stability, skip non-advancement, idempotent materialisation |
| Alert dedupe & lifecycle (ADR-008) | One-open-per-key, grouping, auto-resolve with reason, ack≠resolve, snooze bounds + re-open, escalation once, quiet hours/caps |
| Notification policy (ADR-009) | Recipient resolution order, away skipping, intent idempotency, cap overflow digest, payload redaction |
| Idempotency (FR-CHORE-005, FR-TRASH-005, FR-RES-008) | Double-tap, retry, scheduler re-run |
| Resource thresholds (ADR-011) | Each mode's low/critical boundaries, crossing-only events, mode-change reset |
| Room status (ADR-010) | Rule precedence, override TTL expiry, `UNKNOWN` case, timezone boundary |
| Maintenance dates (ADR-012) | Month/year clamping, lead time windows, pause effects, backdating |
| Issue lifecycle (FR-ISSUE-003) | Legal transitions accepted, illegal rejected, audit rows written |
| Privacy (PRIVACY.md §5) | Log-shape test: forbidden field names cannot be passed to the logger; payload redaction test |
| Accessibility | axe clean, keyboard path, live-region semantics per screen |

## 4. Test data & isolation

| Aspect | Rule |
| --- | --- |
| Fixtures | Builders in `tests/**/fixtures` (to be created in VS-0): `makeHousehold()`, `makeRoom()`, `makeChore()`, `makeOccurrence()`, plus a frozen `TestClock` |
| Two households | Every integration suite seeds household A and household B so isolation can be asserted |
| Database | Ephemeral Postgres per test run (docker compose service); migrations applied once, data truncated per test |
| Determinism | No `Date.now()`; ids from a deterministic counter-based generator in tests |
| Cleanup | Transaction rollback per test where possible; explicit truncate otherwise |
| PII | Fixtures use obviously fake data (`Ayu Test`, `aki@example.test`) — never real names |

## 5. Naming conventions

```ts
// Unit — file: tests/unit/domain/chores/recurrence.test.ts
describe.todo('T-CHORE-021 daily recurrence advances by one household day (FR-CHORE-014)');
describe.todo('T-CHORE-022 AFTER_COMPLETION anchors on lastCompletedAt (FR-CHORE-015)');
describe.todo('T-CHORE-023 DST boundaries keep the household-local date stable (FR-CHORE-016)');

// Integration — file: tests/integration/household-isolation.test.ts
describe.todo('T-SEC-002 roomRepository cannot read another household’s room (NFR-SEC-002)');

// E2E — file: tests/e2e/chore-completion.spec.ts
test.todo('T-CHORE-004 one tap completes a chore from /today and records activity (FR-CHORE-004)');
```

Rules: the first token of the name is the task ID; the trailing parenthetical is the requirement ID. A test without either is a review failure.

## 6. CI tiers (implemented in VS-0)

| Stage | Contents | Duration target | Blocking |
| --- | --- | --- | --- |
| `verify:docs` | `scripts/verify-docs.mjs` (traceability + no-fake-implementation) | < 5 s | Yes |
| `typecheck` | `tsc --noEmit` | < 60 s | Yes |
| `lint` | ESLint + import-boundary rules (ADR-003/ADR-005) | < 60 s | Yes |
| `unit` | Vitest node project | < 60 s | Yes |
| `integration` | Vitest with Postgres service container | < 5 min | Yes |
| `build` | `next build` | < 5 min | Yes |
| `e2e` | Playwright against the built app + seeded DB | < 10 min | Yes (main branch; PRs may run a subset) |
| `a11y` | axe pass inside E2E | included | Yes |
| `perf` | Lighthouse budget check (informational first, blocking after baseline) | < 3 min | Warn → block in VS-16 |

## 7. Manual vs automated

| Concern | Automated | Manual (QA.md) |
| --- | --- | --- |
| Rules, math, dedupe, transitions | ✅ unit | — |
| Tenancy, roles, idempotency | ✅ integration | spot check |
| Happy-path journeys | ✅ E2E | ✅ exploratory pass |
| Screen-reader experience | partial (axe) | ✅ per slice |
| Real device PWA install/push | ❌ | ✅ |
| Notification on a real lock screen | ❌ | ✅ |
| Offline behaviour | partial (Playwright offline) | ✅ |
| Visual quality (typography, spacing, calm) | ❌ | ✅ visual review against DESIGN.md |

## 8. Definition of test-complete for a task

1. All `describe.todo` skeletons for that module belonging to that task are now real tests.
2. New edge cases discovered during implementation are added as tests **and** to docs/domain/INVARIANTS.md if they represent a rule.
3. Integration coverage exists if the task touches the database, tenancy, or authorization.
4. E2E coverage exists if the task changes a user journey in QA.md.
5. Any skipped test has an inline `// SKIP: <reason> — <task>` and appears in the PR description.
