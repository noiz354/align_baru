# TESTING STRATEGY

Requirements: all · ADR-0021 (stack), `QA.md` (manual scenarios), `docs/testing/CONCURRENCY-TESTS.md`,
`docs/testing/TEST-DATA.md`

---

## 1. Philosophy

1. **Test the risk, not the coverage number.** The four riskiest behaviours are: attendance
   integrity under concurrency, QR/token security, a 2-hour recording surviving failure, and the
   transcript publication gate. Those get exhaustive tests. CRUD forms get one happy path.
2. **Test at the lowest layer that can express the rule.** Domain rules → unit. Integrity rules →
   integration against **real PostgreSQL**. Browser realities → real browsers.
3. **No test may lie.** A test that passes with a stub of the thing being tested is worse than no
   test. This is why `PROHIBITED: mocking the database for constraint behaviour` exists.
4. **Skeletons first.** Phase 0 ships placeholder test files that name the required behaviours:
   `describe.todo()` / `test.todo()` in Vitest layers (unit, integration, browser) and
   `test.fixme(title, async () => {})` inside a `test.describe(...)` in the Playwright layers (E2E, a11y,
   load), because Playwright has no `todo` API and `fixme` is its documented way to declare a test that
   must exist but must not run yet. Note the exact signature: Playwright's `test.fixme` accepts
   `(title, body)`, `(title, details, body)`, or the in-test `fixme()` / `fixme(condition, description)`
   forms — a single-string `test.fixme(title)` is **not** a valid signature and does not typecheck
   (corrected during VS-0 exit verification, 2026-09-27). Implementing a slice means replacing its
   placeholders with real tests — the list is the acceptance checklist (`TASKS.md` DoD).
5. **Determinism.** Injected `Clock`, seeded randomness, no `sleep`, no implicit ordering, no
   network, no shared mutable fixtures.

## 2. Layers and ownership

| Layer | Location | Runner | What it must cover | Environment |
|---|---|---|---|---|
| Unit — domain | `tests/unit/domain/**` | Vitest (node) | State machines (exhaustive allowed/forbidden transitions), invariants, capacity arithmetic, policy resolution, time resolution (ADR-0018), token formatting/parsing, provenance derivation | Pure; no I/O |
| Unit — application | `tests/unit/**` | Vitest (node) | Services with **fake ports** (repositories, storage, provider) — behaviour, error mapping, idempotency decisions | Fakes in `tests/support/fakes` |
| Unit — contracts | `tests/unit/contracts/**` | Vitest | Validation schemas (accept/reject), error taxonomy mapping, event payload schemas, allow-list enforcement for logger | Pure |
| Integration | `tests/integration/**` | Vitest + real Postgres — the service container when `INTEGRATION_DATABASE_URL` is set, otherwise the embedded PGlite PostgreSQL 18 (`tests/support/db.ts`); MinIO container when a suite needs storage | Repositories, constraints (`ON CONFLICT`, unique indexes, FK tenancy), transactions, outbox emission, job handler idempotency, retention behaviours, provider adapter contract tests against fixture responses | Containers, no browser |
| Browser/component | `tests/browser/**` | Vitest browser mode (Playwright provider) | Components with real DOM behaviour: focus management, live regions, form errors, scanner state machine UI, recorder state UI, transcript editor interactions (Arabic bidi) | Chromium (+ WebKit for a subset) |
| E2E | `tests/e2e/**` | Playwright | The two money paths + the accessibility/keyboard script + offline behaviours | Ephemeral stack (compose), fake media devices |
| Load/soak | `tests/e2e/load/**` + scripted runners | k6 or Playwright-driven synthetic load (decision: `T-PERF-001`) | Check-in throughput, registration contention, upload concurrency | Ephemeral stack, seeded data |
| Security | `tests/integration/security/**` | Vitest | Isolation suite, token properties, policy enforcement, upload validation, header assertions | Containers |
| Accessibility | `tests/e2e/a11y/**` | Playwright + `@axe-core/playwright` | Zero critical violations on P0 flows; keyboard script | Browsers |

## 3. Requirement → test-type mapping (mandatory minimums)

| Requirement family | Unit | Integration | Browser | E2E | Load |
|---|---|---|---|---|---|
| FR-ORG-* (tenancy) | — | isolation | — | — | — |
| FR-MOSQUE-* | validation | repository | form | discovery | — |
| FR-SPEAKER-* | — | repository | profile | — | — |
| FR-PROGRAM-* | recurrence maths (extensive) | generation idempotency | — | create→generate | — |
| FR-EVENT-* | state machine (exhaustive) | publish checklist | create form | create→publish→view | — |
| FR-REG-* | capacity rules | contention (C1), dedupe | form + result | register→QR | contention |
| FR-CHECKIN-* | result mapping, token parse | concurrency (C2), wrong event | scanner UI states | entrance drill | throughput |
| FR-ATTEND-* | derivation rules | constraints, corrections | summary UI | summary + export | — |
| FR-AUDIO-* | chunk sequencing | idempotency (C7/C8), assembly | recorder UI states | 2-hour survival | upload soak |
| FR-TRANSCRIPT-* | state machine, provenance | revision conflict (C6), gate constraint | editor | machine→review→publish | — |
| FR-CONTENT-* | policy resolution | search exclusions | — | archive browse | — |
| FR-FEEDBACK-* | anonymity rules | constraint | form | submit anonymous | — |
| FR-NOTIF-* | dedupe keys | idempotent dispatch | — | one-request-only | — |
| NFR-SEC-* | — | security suite | CSP/frame | — | abuse |
| NFR-PRIV-* | — | constraint + retention | — | — | — |
| NFR-A11Y-* | — | — | component a11y | axe + keyboard | — |
| NFR-PERF-* | — | query plans | — | — | budgets |
| NFR-OBS-* | logger allow-list | metric emission | — | — | — |

## 4. The four "must be exhaustive" suites

### 4.1 State machines (`tests/unit/domain/**/*.transitions.test.ts`)
For every machine in `STATE_MACHINE.md`: enumerate **all** state pairs; assert allowed transitions
succeed and every other transition is rejected with a typed error. This is cheap (tables are data)
and gives complete coverage of the most dangerous logic in the system.

### 4.2 Attendance integrity (`tests/integration/attendance/*`)
- Duplicate insert fails at the database (constraint proof, not service proof).
- N parallel check-ins → exactly one row, N-1 `ALREADY_CHECKED_IN`.
- Walk-in convergence with the same `walkInRef` and with a matching contact.
- Cancelled registration cannot check in; checked-in registration cannot be cancelled.
- Corrections never create duplicates and always require a reason.

### 4.3 QR/token security (`tests/integration/security/tokens.test.ts`)
- Entropy/format properties; no collisions across 1e6 generations (sampled).
- Storage contains no plaintext token.
- Payload contains no PII, no entity UUID, no URL parameters beyond the token.
- Wrong-event, expired, revoked, cancelled paths all produce their distinct results.
- Rate limits trigger at the configured thresholds.
- Logger allow-list rejects token-shaped fields (unit).

### 4.4 Publication gate (`tests/integration/transcription/publish-gate.test.ts`)
- Direct attempt to set `PUBLISHED` on a machine draft fails (API **and** DB constraint).
- Approval persists `approved_by`/`approved_revision_id`; publishing serves that revision.
- Editing after publication does not change the public output until re-approval.
- Unpublish requires a reason and removes the content from search.
- An `INTERNAL` policy blocks publishing entirely.

## 5. Concurrency tests

Catalogue and expectations: `docs/testing/CONCURRENCY-TESTS.md`. Every concurrency-sensitive change
must cite a case ID (C1…C12) in its PR and add/execute the matching test.

Implementation notes: use controlled interleaving (advisory locks or explicit test hooks), never
`sleep()`-based race attempts; assert **invariants** (row counts, single effect), not timing.

## 6. Browser and E2E specifics

### 6.1 Fake media devices
- Chromium flags for a synthetic audio device
  (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`) and a fixture file played into
  the fake device for the recorder tests.
- Camera: `--use-file-for-fake-video-capture` with a fixture video containing QR codes at varying
  brightness/angle, plus a screen-photo fixture (the realistic case).
- Permission-denied and permission-revoked paths tested via context permissions.

### 6.2 Network conditions
- Playwright `route` interception and `context.setOffline(true)` for offline/degraded paths.
- Throttling via CDP for 3G-class measurements on the performance suites.
- Upload interruption is simulated by aborting chunk requests on a schedule and asserting eventual
  convergence.

### 6.3 E2E scenarios (the thin, high-value set)
1. **Discovery → attendance**: browse → register → obtain code → scan (fake camera) → summary shows
   1 attendance record → participant page shows "sudah check-in".
2. **Entrance drill**: 200 seeded registrations, 3 parallel browser contexts scanning from fixture
   videos, including duplicate and wrong-event codes; assert zero duplicates and correct counts.
3. **Recording survival**: 20-minute accelerated session (chunk interval compressed) with a forced
   reload at ~30%, a 60-second network outage, and one server restart; assert contiguous sequences
   and a playable asset.
4. **Transcription → review → publish**: request → fake provider response (fixture, including an
   Arabic code-switch passage and a deliberate error) → reviewer edits, marks uncertainty, approves →
   publish → public page shows provenance and the corrected text → attempt to publish without
   approval fails.
5. **Offline participant code**: with the context offline, the participant page still renders the
   QR/short code from cache with a last-sync statement.
6. **Cancel and waitlist**: fill capacity → waitlist → cancel → offer → accept → same registration
   and token reused.

### 6.4 Visual verification
Baseline screenshots for: check-in result states (success/already/failure, light and dark-of-day
contrast variants), recorder states, transcript editor with Arabic content, attendance summary.
Stored in the repo, diffed in CI; changes require an explicit update commit reviewed by a human
(the safety-critical layouts must not drift silently).

## 7. Non-functional testing

| Concern | Approach |
|---|---|
| Performance | Budget assertions in the nightly job plus a pre-release run; load tests at 3× target throughput |
| Accessibility | axe on P0 flows + manual keyboard/screen-reader script each release (`ACCESSIBILITY.md` §6) |
| Security | Isolation suite, token suite, upload abuse corpus, header assertions, dependency audit |
| Privacy | Constraint tests (anonymity, retention), telemetry allow-list tests, "no participant history surface" facility test |
| Resilience | Fault injection: DB unavailable, storage unavailable, provider timeout, worker restart during a job (`docs/architecture/FAILURE-MODEL.md`) |
| Migration safety | Apply migrations to a restored copy of a production-shaped dataset in CI before release |

## 8. Test data

Rules and fixtures: `docs/testing/TEST-DATA.md`. Hard rules:

1. **Never real participant data**, in any environment, ever. No production dumps in test/dev.
2. Arabic/Indonesian code-switching content is a first-class fixture set (transcript tests are
   meaningless without it).
3. Fixture audio is synthetic or cleared for use; **no real religious recitation** is redistributed
   as a test artefact unless the deployment owns the rights and marks it clearly.
4. Ids are deterministic ULIDs seeded per test to make failures reproducible.

## 9. CI pipeline (see `DEPLOYMENT.md` §CI for the YAML contract)

| Stage | Blocks merge | Notes |
|---|---|---|
| typecheck (`tsc --noEmit`) | yes | strict |
| lint (ESLint 9 + boundary rules) | yes | includes "no fake implementations" custom rule (`T-ARCH-003`) |
| unit tests | yes | fast (< 60 s target) |
| integration tests (Postgres + MinIO services) | yes | |
| contract/event schema tests | yes | |
| security suite (isolation + tokens + policy) | yes | |
| build (both images) | yes | |
| browser component tests | yes | chromium |
| E2E smoke (scenarios 1, 4, 5) | yes | chromium |
| E2E full + entrance drill + recording survival | nightly | |
| Load + performance budgets | nightly / pre-release | |
| a11y axe + visual snapshots | yes (P0 flows) | |
| dependency audit + SBOM | yes | fails on high/critical with an accepted-risk note required |

## 10. What is explicitly not tested (and why)

| Not tested | Reason |
|---|---|
| Third-party providers' internal behaviour | Out of our control; we test our adapter contract and our failure handling |
| Every browser/OS combination | Documented support matrix; automated coverage on Chromium + WebKit; manual spot checks recorded in `QA.md` |
| Pixel-perfect rendering | Only safety-critical layouts get visual baselines |
| Generated migration SQL correctness beyond application | Migrations are reviewed by a human; CI applies them to a production-shaped copy |
| Load beyond 3× the largest supported deployment | The architecture is explicitly scoped (`docs/research/STACK-2026.md`), and premature scale work is an anti-goal |
