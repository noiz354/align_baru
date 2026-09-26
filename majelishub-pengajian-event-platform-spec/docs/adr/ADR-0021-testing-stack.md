# ADR-0021 — Testing stack: Vitest 4 + Playwright, contract-first test skeletons

- Status: Accepted · Date: 2026-09-26 · Deciders: QA architect, Principal Architect
- Requirements affected: TESTING.md (all), NFR-REL-001/003 · Related: `TESTING.md`, `QA.md`, `docs/testing/CONCURRENCY-TESTS.md`

## Context

The risky behaviours are not typical CRUD: a 2-hour browser recording surviving a crash; 20
scanners/second at an entrance; idempotent chunk uploads; optimistic concurrency in the
transcript editor; and a publishing gate that must be **provably** unbreakable. jsdom-based
tests cannot exercise `MediaRecorder`, `getUserMedia`, camera APIs, `IndexedDB`, real focus
management or real network conditions. Meanwhile the integration layer must exercise **real
PostgreSQL** constraint behaviour (`ON CONFLICT`, `SKIP LOCKED`, unique indexes), because those
constraints are the product's integrity mechanism (ADR-0025).

## Decision

Four layers, with explicit ownership:

| Layer | Tool | Scope | Isolation |
|---|---|---|---|
| Unit | **Vitest 4** (Node env) | Domain functions, state machines, validation, mapping, capacity arithmetic | Pure, no I/O, injected `Clock`; no mocking of the database (there is nothing to mock) |
| Integration | **Vitest** + real PostgreSQL (Testcontainers or a CI service container) | Repositories, constraint behaviour, transactions, job handlers, provider adapters against fakes/fixtures | Transaction-per-test rollback, or a fresh schema per suite; no network |
| Browser/component | **Vitest browser mode** (Playwright provider, stable in v4) for components; **Playwright** for page-level flows | Real DOM, focus, camera/mic permission paths (with fake devices), offline simulation, screenshot verification | Playwright projects per browser; fake media devices via Chromium flags |
| E2E | **Playwright** | The two money paths: (1) discover → register → QR → check-in → attendance; (2) record → upload → assemble → transcribe → review → publish | Ephemeral environment via compose; no production dependencies |

Also decided:

- **Vitest is the only unit/integration runner** (no Jest). **Playwright is the only**
  browser-automation tool (no Cypress).
- **Test skeletons precede implementations.** Phase 0 ships `describe.todo()` files that name
  the required behaviours; a slice is not complete until its todos are real tests.
- Determinism rules: injected time, seeded randomness, no `sleep`-based synchronisation, no
  ordering dependence, no shared mutable fixtures, no hitting third-party networks (fake
  adapters or recorded fixtures only).
- Visual verification: Playwright screenshots on failure + a small curated set of baseline
  screenshots for check-in result states and recorder states (where layout is safety-critical).
- Accessibility: `@axe-core/playwright` on P0 flows; critical violations fail the build.
- Performance: a narrow set of budget assertions (check-in latency, upload cadence, page
  weight) run in the nightly job against the containerised stack, not in the fast PR job.

## Alternatives considered

- **Jest + React Testing Library + Cypress.** *Costs:* slower cold start, ESM/TS friction,
  a separate browser tool, and jsdom's inability to test the features that matter here.
  *Rejected.*
- **Vitest only (no Playwright).** *Costs:* cannot test camera/mic/IndexedDB/offline or real
  navigation; the most expensive failures would be untested. *Rejected.*
- **Playwright component testing as the primary component tool.** *Gains:* one browser API.
  *Costs:* still marked experimental in 2026 and slower for logic-heavy components; Vitest
  browser mode is now stable and shares the config with unit tests. *Rejected as primary*
  (Playwright still owns page-level flows).
- **Mocked database (in-memory repository fakes) for integration tests.** *Costs:* the
  constraints we rely on would be untested — a fake cannot reproduce `ON CONFLICT` semantics.
  *Rejected:* real Postgres is required for anything integrity-related.
- **Recorded HTTP fixtures for the STT provider (VCR-style).** *Gains:* deterministic adapter
  tests. *Kept* as the approach for adapter contract tests, with fixtures redacted of any real
  audio, plus a manual smoke test against a real provider behind a flag.

## Consequences

**Positive:** the two riskiest workflows get real-browser coverage with traces and videos on
failure; constraint behaviour is verified against the real engine; one config surface for
component and unit tests; a shared vocabulary of test names that maps to `TASKS.md` entries.

**Negative:** the CI matrix is heavier (a database and browsers in CI); browser tests are
slower than jsdom, so we deliberately keep the E2E set thin and push detail into unit/integration
layers; fake media devices occasionally diverge from real ones (documented as a residual risk
mitigated by the manual long-recording QA scenario in `QA.md`).

**Neutral:** Phase 0 installs no test runner; the skeleton suite is text. Installing the runner
is part of VS-0 completion (task `T-TEST-001`).

## Enforcement

- A slice is "done" only when its `describe.todo()` entries from Phase 0 exist as real tests
  (`TASKS.md` DoD template).
- Integration tests must run against a real Postgres; a CI guard fails if a suite tagged
  `integration` runs without a database URL.
- No test may call a third-party network; a lint rule bans `fetch` to non-localhost in tests
  except through an approved fake adapter module.
- Concurrency-sensitive changes must reference a case from `docs/testing/CONCURRENCY-TESTS.md`.

## Revisit trigger

Reopen if: Vitest browser mode or Playwright component testing materially reduces the
maintenance of two toolchains (consolidation) — or if E2E flakiness exceeds the agreed budget
(> 2% per 100 runs), in which case the response is quarantine + fix, not a tool change.
