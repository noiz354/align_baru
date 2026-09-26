# TASKS

The work contract. Each task is implementable by an agent without a conversation: it names the
requirement, the documents to read, the modules to touch, the invariants to preserve, the tests to
write, and what "done" means.

Read `AGENTS.md` first — the ten-step pre-change checklist applies to every task here.

**Status: Phase 0.** Nothing below the "Part A" tasks that are marked *Phase 0* is implemented. The
skeleton repository contains contracts, ports, route shells and `describe.todo()` tests only.

---

## 0. How to use this file

1. Find the task. Read **all** of its fields before opening an editor.
2. Open the documents it lists. They are not optional background reading; they contain the rules.
3. Follow the pre-change checklist in `AGENTS.md` §2.
4. Implement the smallest coherent change that satisfies the task.
5. Satisfy **every** line of the Definition of Done, then update the task's status column.

### ID convention

`T-<MODULE>-<NNN>` — three digits, grouped by module, numbers are permanent (never reused, never
renumbered). Module tokens in use:

| Token | Module | Token | Module |
|---|---|---|---|
| `DOCS` | Documentation and ADRs | `REG` | Registration |
| `ARCH` | Architecture, boundaries, contracts | `CHECKIN` | QR check-in |
| `TEST` | Test infrastructure | `ATTEND` | Attendance |
| `ORG` | Identity, organizations, roles | `AUDIO` | Recording, upload, processing |
| `SEC` | Security mechanisms | `TRANSCRIPT` | Transcription and review |
| `OBS` | Observability | `CONTENT` | Archive, publication, moderation |
| `PERF` | Performance and load | `FEEDBACK` | Feedback |
| `OPS` | Operations, deployment, backup | `NOTIF` | Notifications |
| `MOSQUE` | Mosques, venues, facilities | `ANALYTICS` | Organizer dashboards |
| `SPEAKER` | Speakers | `MOD` | Moderation |
| `PROGRAM` | Programs and recurrence | `AUDIT` | Audit trail |
| `EVENT` | Events and scheduling | | |

### Task block format (all sixteen fields are mandatory)

Task ID · Requirement IDs · Goal · ADR · Product Documents · Expected Modules · Dependencies ·
Expected Behavior · Invariants · Security · Privacy · Concurrency · Failure Cases · Tests · Manual QA ·
Definition of Done. `T-CHECKIN-014` below is the canonical example.

### Definition of done (shared, in addition to each task's own DoD line)

1. No `throw new Error("Not implemented: <this task>")` remains for the task's behaviour.
2. Every skeleton file the task names has real implementation or an explicit, justified deferral
   recorded in the task itself.
3. The task's tests exist, are not `todo`, and pass; the concurrency case named is covered.
4. Telemetry emitted stays inside the allow-list (`OBSERVABILITY.md` §7).
5. Documentation that the change invalidated is updated **in the same PR**.
6. Manual QA recorded (even if the outcome is "not testable in this environment — reason").
7. No new dependency without a `docs/research/STACK-2026.md` classification.

---

# PART A — TASKS REQUIRED BY OTHER DOCUMENTS

Every task below is cited by name in at least one other document as the owner of a requirement,
mitigation or enforcement rule. They must exist with these exact IDs.

## A.1 Foundation, architecture, security, observability, operations

---

### T-DOCS-001 — Documentation and ADR consistency gate

- **Requirement IDs:** NFR-OPS-001, NFR-OBS-001 (documentation of behaviour)
- **Goal:** A repeatable check keeps the document set, the ADR index and the requirement IDs consistent, so the authoritative documentation cannot silently rot.
- **ADR:** ADR-0001 (record architecture decisions), ADR-0021 (testing stack)
- **Product documents:** `README.md`, `docs/architecture/FINAL-REVIEW.md`
- **Expected modules:** `ops/docs-lint.*` (script), `ADR.md` (index), `docs/TRACEABILITY.md`
- **Dependencies:** none (Phase 0 deliverable)
- **Expected behavior:** the gate fails a PR when (a) a file exists in `docs/adr/` but not in `ADR.md`; (b) a requirement ID is referenced anywhere but not defined in `PRD.md`; (c) a cited `docs/**` path does not exist; (d) a task ID is referenced anywhere but not defined in `TASKS.md`; (e) a document is empty or contains no headings.
- **Invariants:** the gate is read-only; it never rewrites documents; it runs in CI and locally.
- **Security:** none (no data access).
- **Privacy:** none.
- **Concurrency:** not applicable (CI-only).
- **Failure cases:** a false positive must be fixed by correcting the document, never by widening an exclusion list without a recorded reason.
- **Tests:** `tests/unit/docs/references.test.ts` — the checker itself is unit-tested against fixture document trees (missing ADR index entry, dangling requirement ID, empty doc).
- **Manual QA:** run the gate against the current repository; expect zero findings. Then introduce a deliberate dangling reference and confirm it fails.
- **Definition of Done:** the script exists, is wired into CI, is unit-tested, and the repository passes it as of the Phase 0 freeze.

---

### T-ARCH-002 — Enforce module boundaries with lint rules

- **Requirement IDs:** NFR-OPS-001, NFR-PERF-003 (keeps the domain framework-free)
- **Goal:** Make the architecture (`app → features → domain → shared/server`) mechanically enforced instead of aspirational.
- **ADR:** ADR-0002 (modular monolith), ADR-0021
- **Product documents:** `ARCHITECTURE.md` §module boundaries/imports
- **Expected modules:** `eslint.config.*` (rule), `src/domain/**`, `src/features/**`
- **Dependencies:** TypeScript project setup, ESLint 9 flat config
- **Expected behavior:** violations fail lint with a message that names the rule and the allowed direction; the rule understands `@/` path aliases; a documented exception mechanism exists (inline disable requires a reason comment and is counted in CI output).
- **Invariants:** `domain/**` may never import `features/**`, `server/**`, `app/**`, or any framework/runtime package; I/O-free.
- **Security:** none directly, but the rule prevents domain logic from bypassing the ports that security depends on.
- **Privacy:** domain never reaches the database directly, which keeps tenant scoping in one place.
- **Concurrency:** not applicable.
- **Failure cases:** a legitimate need to import across layers means the design is wrong — restructure rather than disable.
- **Tests:** `tests/unit/lint/boundaries.test.ts` — runs ESLint programmatically over violating fixtures and asserts each is reported.
- **Manual QA:** introduce a `domain → server` import in a scratch branch; confirm CI fails with an explanatory message.
- **Definition of Done:** rule active on `src/**` and `tests/**`, fixture tests pass, no unexplained disables exist in the codebase.

---

### T-ARCH-003 — Lint rule against fake implementations

- **Requirement IDs:** NFR-OPS-001 (skeleton honesty), NFR-ETH-001
- **Goal:** Make the "no fake implementations" rule mechanically detectable so skeletons can never be mistaken for working code.
- **ADR:** ADR-0002, ADR-0021
- **Product documents:** `AGENTS.md` §4/§5, `DESIGN.md` §Phase 0 shells
- **Expected modules:** `eslint.config.*` (custom rule), `src/**` (all stubs)
- **Dependencies:** T-ARCH-002
- **Expected behavior:** flags (a) `return { success: true }`-shaped constant success returns in `src/**`; (b) functions whose body is only a constant return in a file marked as a stub; (c) any `throw new Error("Not implemented: …")` that does not contain a valid `T-<MODULE>-<NNN>` that exists in `TASKS.md`; (d) `describe.todo`/`test.todo` titles without a behaviour description.
- **Invariants:** the rule must not fire on legitimate pure helpers (e.g. deterministic formatting functions) — the pattern is "claims an effect happened", not "returns a constant".
- **Security:** prevents a stub from being trusted as a security control.
- **Privacy:** prevents a stub from pretending to filter or delete data.
- **Concurrency:** not applicable.
- **Failure cases:** an unavoidable false positive requires a scoped disable with a reason; aggregate counts are printed so silent growth is visible.
- **Tests:** `tests/unit/lint/no-fake.test.ts` — positive and negative fixtures, including a stub naming a non-existent task ID.
- **Manual QA:** add a fake `return { success: true }` in a scratch branch and confirm the rule reports it.
- **Definition of Done:** rule active, fixtures tested, CI green on the Phase 0 skeleton with zero unexplained exceptions.

---

### T-TEST-001 — Test harness for all four layers

- **Requirement IDs:** NFR-OPS-001, NFR-REL-001 (reproducible verification)
- **Goal:** Deliver the runnable test infrastructure that completes VS-0: Vitest 4 (unit, integration, browser mode) and Playwright (E2E), with real Postgres and S3-compatible containers for integration.
- **ADR:** ADR-0021 (testing stack), ADR-0010 (jobs under test)
- **Product documents:** `TESTING.md` §2/§9, `docs/testing/TEST-DATA.md`
- **Expected modules:** `vitest.config.ts` (+ workspace projects), `playwright.config.ts`, `tests/support/**`, `ops/docker-compose.test.yml`
- **Dependencies:** T-ARCH-002/003 (lint), T-DOCS-001
- **Expected behavior:** `npm run test:unit|test:integration|test:browser|test:e2e|test:a11y` each run their layer; integration suites start containers, apply migrations, seed fixtures and tear down; every layer passes on the skeleton (todos are allowed to be "skipped", never failing).
- **Invariants:** no test may reach the network; fixtures are deterministic with a fixed clock and seeded ids; each integration suite gets an isolated schema.
- **Security:** containers use throwaway credentials; no production configuration is importable in tests.
- **Privacy:** fixtures contain synthetic data only (`docs/testing/TEST-DATA.md`).
- **Concurrency:** the harness must support deterministic interleaving helpers (advisory locks/promise gates) used by C1…C12 tests.
- **Failure cases:** a missing container runtime fails with a clear message rather than a truncated test run; flaky detection reports the test name and seed.
- **Tests:** `tests/unit/harness/selftest.test.ts` — asserts container health checks, migration application, fixture seeding, and that a deliberately flaky pattern is detected.
- **Manual QA:** clone the repository on a clean machine, run all five commands, and confirm each produces a summary without manual setup beyond Docker.
- **Definition of Done:** all five commands work from a clean checkout; VS-0 exit criterion "test commands run" satisfied; no product behaviour implemented.

---

### T-SEC-001 — Tenant isolation (scope enforcement + RLS)

- **Requirement IDs:** FR-ORG-003, NFR-SEC-003, NFR-SEC-001
- **Goal:** Make cross-organization and cross-mosque access structurally impossible rather than merely checked.
- **ADR:** ADR-0017 (TenantScope required parameter, 404 on cross-org)
- **Product documents:** `SECURITY.md` §5, `docs/security/AUTHZ-MATRIX.md`, `docs/product/MOSQUES.md`
- **Expected modules:** `src/shared/contracts/scope.ts`, `src/server/db/**` (query helpers), `src/server/auth/permissions.ts`, `src/features/**/**` repositories
- **Dependencies:** T-SEC-002 (permissions), schema with `organization_id` on tenant tables
- **Expected behavior:** every tenant-scoped query requires a `TenantScope` value; the scope is derived from the principal, never from client input; a request for another organization's object returns **404** with no existence disclosure; Postgres row-level security is enabled as a second layer with the session variable set per transaction.
- **Invariants:** no repository function can be called without a scope (type-level, not convention); RLS policies mirror the application rules; the test suite proves both layers independently.
- **Security:** the primary control against IDOR/BOLA; scope derivation is centralized and unit-tested; failures are logged as authorization events without object data.
- **Privacy:** prevents the most damaging privacy failure (seeing other communities' participants).
- **Concurrency:** scope is transaction-local; no leakage across pooled connections.
- **Failure cases:** missing scope → programming error that fails closed; malformed scope → 400 with no internals; RLS misconfiguration → the isolation suite fails the build.
- **Tests:** `tests/integration/security/isolation.test.ts` — for each tenant-scoped table and each role, attempt cross-org read/write/delete by id, slug and list query; assert 404/empty and zero rows returned; a dedicated test asserts an unscoped repository call is impossible to express.
- **Manual QA:** QA-07 row 1 (contact harvesting attempt) executed against a staging deployment with two organizations.
- **Definition of Done:** isolation suite green across every route and Server Action touching tenant data; RLS enabled with documented policies; audit events emitted for attempted cross-org access.

---

### T-SEC-002 — Permission model and authorization enforcement

- **Requirement IDs:** FR-ORG-002, NFR-SEC-002, NFR-SEC-001
- **Goal:** One centralized authorization function makes every action's permission requirement explicit and auditable.
- **ADR:** ADR-0017, ADR-0006 (token revocation permissions)
- **Product documents:** `docs/security/AUTHZ-MATRIX.md`, `SECURITY.md` §4
- **Expected modules:** `src/server/auth/permissions.ts`, `src/shared/contracts/permissions.ts`, `src/features/**` services
- **Dependencies:** identity/organization model, T-SEC-001
- **Expected behavior:** `requirePermission(permissionKey, scope, actor)` throws a typed `ForbiddenError` (or `NotFoundError` for resource-existence hiding) and writes an authorization audit event; permission keys follow `<resource>.<action>`; scope is one of `PLATFORM|ORG|MOSQUE|EVENT|OWN`; role→permission mapping lives in data, not in scattered `if` statements; reason-required permissions (`✓*` in the matrix) demand a non-empty reason of ≥ 8 characters that is stored in the audit record.
- **Invariants:** no route, Server Action or job performs its own role comparison; separation of duties holds (a reviewer cannot approve their own transcript; moderation decisions are platform-only); no role can grant itself a role.
- **Security:** the single choke point for authorization; least privilege by default; every denial is logged with actor, key and scope but no resource content.
- **Privacy:** permissions govern access to participant contact data, which is exposed in the narrowest possible set of actions.
- **Concurrency:** role changes take effect for subsequent requests; no cached permission granted beyond a request lifetime.
- **Failure cases:** unknown permission key → fail closed and alert; role lookup failure → deny; broken scope chain → deny.
- **Tests:** `tests/integration/security/permissions.test.ts` — a generated matrix test that calls every protected action with every role and asserts the documented outcome (✓ allowed, — denied, ✓* reason required), plus a test that no protected action executes without a `requirePermission` call (static analysis).
- **Manual QA:** attempt a role-escalation flow with a mosque administrator account and confirm refusal plus audit entry.
- **Definition of Done:** the generated test covers 100% of the matrix rows; the static check proves no unprotected action exists; audit records verified.

---

### T-SEC-004 — Ban token values and token fields from logs

- **Requirement IDs:** NFR-PRIV-006, NFR-SEC-004
- **Goal:** Ensure check-in tokens, short codes and invitation codes can never be written to logs, traces or error messages.
- **ADR:** ADR-0006 (opaque tokens), ADR-0019 (telemetry)
- **Product documents:** `docs/security/QR-SECURITY.md`, `OBSERVABILITY.md` §7
- **Expected modules:** `eslint.config.*` (rule), `src/shared/observability/logger.ts`, `src/server/**`
- **Dependencies:** T-OBS-002 (logger), T-ARCH-003
- **Expected behavior:** a lint rule flags logging calls that reference token/code-named fields; the logger's attribute allow-list rejects those names at runtime; error serialization strips them; validation responses never echo the submitted token.
- **Invariants:** the ban list is data-driven and shared with the runtime guard, so the two cannot drift; token values are never interpolated into messages.
- **Security:** prevents credential leakage through observability (T-18).
- **Privacy:** codes are personal credentials; leaking them is a privacy incident.
- **Concurrency:** not applicable.
- **Failure cases:** a rejected attribute increments `telemetry_dropped_attribute_total` and is reported, never silently dropped.
- **Tests:** `tests/unit/observability/token-logging.test.ts` — fixtures logging a token field are reported by the rule and stripped by the logger; a runtime test asserts the error serializer omits token fields.
- **Manual QA:** QA-07 telemetry leak check with a token-shaped string in a request; confirm zero occurrences in logs and a dropped-attribute metric.
- **Definition of Done:** rule + runtime guard active, tests green, the shared ban list exported as the single source of truth.

---

### T-SEC-005 — Upload security validation (shared by audio and materials)

- **Requirement IDs:** NFR-SEC-009, NFR-SEC-008
- **Goal:** Reject malicious, oversized, mismatched or malformed uploads before they touch storage or any processing binary.
- **ADR:** ADR-0013 (private storage, presigned URLs), ADR-0008 (chunked capture)
- **Product documents:** `docs/media/STORAGE.md`, `docs/media/CHUNK-PROTOCOL.md`, `CONTENT.md`
- **Expected modules:** `src/features/media/validation/**`, `src/server/storage/**`, `src/server/processing/**` (media runner)
- **Dependencies:** T-AUDIO-004 (chunk endpoints), storage adapter
- **Expected behavior:** size caps per chunk and per session; magic-byte/content sniffing (a `.webm` extension is not evidence); declared duration corroborated by the recorded sequence count; filename never used as a storage key; container metadata validated before ffmpeg sees the bytes; ffmpeg runs non-root, no network, read-only input, bounded CPU/memory/time.
- **Invariants:** validation happens server-side (client checks are UX only); a rejected upload leaves no object behind; the media runner never has database credentials beyond the job it is handed.
- **Security:** defends T-10; a malicious container must fail safely inside a sandbox that cannot reach the internet.
- **Privacy:** rejects accidental uploads of unrelated files, which reduces the chance of stray personal data entering the system.
- **Concurrency:** concurrent chunk submissions for one session must not bypass the session cap (see C8).
- **Failure cases:** unknown content type, wrong magic bytes, truncated container, oversized, decompression bomb, unsupported codec — each produces a distinct error code and no processing attempt.
- **Tests:** `tests/integration/security/upload-abuse.test.ts` using the `abuse` fixture set; asserts rejection reason, no stored object, no job enqueued; `tests/unit/media/validation.test.ts` for the pure predicates.
- **Manual QA:** QA-07 row 4 (malformed audio upload).
- **Definition of Done:** abuse corpus fully rejected, sandbox verified (no network, non-root), no path where an unvalidated byte reaches ffmpeg.

---

### T-SEC-007 — Append-only, tamper-evident audit trail

- **Requirement IDs:** FR-AUDIT-001, FR-AUDIT-002, NFR-SEC-002, NFR-OPS-002
- **Goal:** Provide a trustworthy record of who did what, sufficient to reconstruct an incident and to prove that nothing was quietly changed.
- **ADR:** ADR-0015 (idempotency), ADR-0017
- **Product documents:** `SECURITY.md` §9, `PRIVACY.md` §7, `RETENTION.md` (audit 7 years)
- **Expected modules:** `src/server/audit/**`, `src/domain/audit/**`, `src/shared/contracts/audit.ts`
- **Dependencies:** T-SEC-002 (permission events), database schema
- **Expected behavior:** audit rows are append-only (no update/delete grants for the application role); each entry stores actor, action key, scope, target identifiers, reason where required, timestamp, request id and a hash chain over the previous entry; verification job detects any break; sensitive values are stored as references, not copies.
- **Invariants:** the chain is verifiable in linear time; a missing or reordered row is detectable; audit writes never block the audited action beyond the transaction it belongs to.
- **Security:** tamper evidence (T-17); the application cannot rewrite history even if fully compromised at the API layer.
- **Privacy:** audit records contain identifiers and metadata, never personal content; retention (7 years) is documented and explained.
- **Concurrency:** chain appends are serialized per organization partition to avoid forks; concurrent writes must not create duplicate chain positions.
- **Failure cases:** chain break → alert + incident procedure; audit write failure → the audited action fails closed when it is security-relevant.
- **Tests:** `tests/integration/audit/chain.test.ts` — verify a chain, tamper with a row directly in the database, assert detection; concurrent-append test asserts no fork; `tests/integration/audit/coverage.test.ts` asserts every reason-required action writes an entry.
- **Manual QA:** export an audit slice for one event and confirm it answers "who approved this transcript and why" without referencing any other system.
- **Definition of Done:** hash chain implemented and verified, append-only grants proven by a test that attempts an update and fails, verification job scheduled.

---

### T-OBS-002 — Logger, tracer and metrics with a privacy allow-list

- **Requirement IDs:** NFR-OBS-002, NFR-OBS-001, NFR-PRIV-006
- **Goal:** One observability interface that makes leaking personal data or secrets structurally difficult.
- **ADR:** ADR-0019 (OTel API-only, JSON logs to stdout)
- **Product documents:** `OBSERVABILITY.md` §3–§7
- **Expected modules:** `src/shared/observability/logger.ts`, `src/shared/observability/metrics.ts`, `src/shared/observability/tracing.ts`, `src/server/bootstrap/instrumentation.*`
- **Dependencies:** none (Phase 0 contracts), T-SEC-004 shares the ban list
- **Expected behavior:** a single `logger` API with typed, allow-listed attributes; unknown attributes are dropped and counted; `console.*` is banned outside bootstrap by lint; metrics expose the catalogue in `OBSERVABILITY.md` §4 with low-cardinality labels; OTel instrumentation is loaded via `--import` before application code so spans exist; trace context propagates into job payloads.
- **Invariants:** attribute names come from an exported constant list; ids are opaque; no free-text fields can be logged except fixed enum values; sampling is configurable per route class.
- **Security:** prevents secret leakage (T-18); dropped-attribute metric makes violations visible rather than silent.
- **Privacy:** the allow-list is the mechanism that makes the telemetry rules enforceable instead of aspirational.
- **Concurrency:** logger is safe under concurrent job execution; trace/span context does not bleed between requests.
- **Failure cases:** exporter unreachable → the app continues (telemetry never breaks the product); malformed payload → dropped and counted; missing config → logged once at boot with a clear message.
- **Tests:** `tests/unit/observability/logger.test.ts` (allow-list, drop counting, no content fields), `tests/integration/observability/tracing.test.ts` (spans exist for a request→job chain), `tests/unit/lint/console-ban.test.ts`.
- **Manual QA:** run one registration and one check-in locally; inspect the log output and confirm every line contains only allow-listed attributes and that a correlation id is present.
- **Definition of Done:** the three APIs exist with tests; the metric catalogue is implemented as typed constants; `telemetry_dropped_attribute_total` is emitted and asserted to be zero in normal flows.

---

### T-PERF-001 — Load-testing approach and harness

- **Requirement IDs:** NFR-PERF-004, NFR-PERF-005, NFR-PERF-001
- **Goal:** Decide and implement the mechanism that measures the performance budgets in `PERFORMANCE.md`, so budgets are verified rather than assumed.
- **ADR:** ADR-0021 (testing stack)
- **Product documents:** `PERFORMANCE.md` P1–P40, `docs/operations/SLO.md`
- **Expected modules:** `tests/e2e/load/**`, `ops/load/**`, `package.json` scripts
- **Dependencies:** T-TEST-001, seeded `event-L`/`event-XL` fixtures
- **Expected behavior:** the harness drives (a) check-in throughput across N devices, (b) registration contention against a fixed capacity, (c) chunk upload concurrency with induced failure, (d) public page load under simulated 3G; each run emits a machine-readable report mapping measured values to budget IDs.
- **Invariants:** load tests never run against production; data is synthetic; results are reproducible given the same seed and hardware class (hardware class is recorded with every run because absolute numbers are meaningless without it).
- **Security:** the harness authenticates with dedicated, short-lived test principals and is excluded from production configuration by a startup assertion.
- **Privacy:** synthetic data only.
- **Concurrency:** the harness is itself concurrency-sensitive — it must report confidence intervals and refuse to report a pass when variance is unexplained.
- **Failure cases:** environment too small → the run is marked "inconclusive (hardware)" rather than passing or failing silently.
- **Tests:** the harness is validated by running it against a deliberately throttled build and confirming it detects the regression.
- **Manual QA:** run the entrance scenario with a real phone alongside the synthetic load and compare perceived latency.
- **Definition of Done:** approach documented (with the chosen tool and why), harness runnable in one command, results recorded in a committed report template, budgets P11–P16 and P24–P31 measurable.

---

### T-PERF-002 — Survive arrival bursts and scanning abuse

- **Requirement IDs:** NFR-PERF-004, NFR-PERF-005, NFR-REL-006
- **Goal:** The entrance must degrade gracefully under a burst of arrivals and under deliberate scan flooding, never failing in a way that creates duplicate or missing attendance.
- **ADR:** ADR-0025 (attendance constraints), ADR-0017
- **Product documents:** `PERFORMANCE.md` P11–P16, `CHECKIN.md` §abuse, `THREAT_MODEL.md` T-21
- **Expected modules:** `src/features/checkin/**`, `src/server/http/rate-limit.*`, `src/server/cache/**`
- **Dependencies:** T-CHECKIN-001, T-PERF-001
- **Expected behavior:** per-device and per-event rate limits protect the database while normal scanning (≥ 20 scans/minute/device, ≥ 200/minute/event) is unaffected; on overload the system sheds load **predictably** (a distinct `SERVER_BUSY` result with retry guidance) instead of timing out ambiguously; duplicate scans remain cheap and rejected locally where possible; the manual path stays available regardless of load.
- **Invariants:** no load condition may produce a success response without a committed attendance record, or vice versa; retries are idempotent.
- **Security:** defends T-21; rate limits are durable (not the in-memory default, `SECURITY.md` §8) and shared across replicas.
- **Privacy:** load handling must not reveal whether a token exists (failures are indistinguishable in timing and wording where feasible).
- **Concurrency:** burst handling must not create duplicate attendance (C2 must hold precisely when load is highest).
- **Failure cases:** database saturation, pool exhaustion, storage outage during a check-in, sustained flooding from one device.
- **Tests:** `tests/e2e/load/entrance-burst.test.ts` (headroom and shed behaviour), `tests/integration/checkin/rate-limit.test.ts` (limits, sharing across replicas, no false positives at target rate), `tests/integration/attendance/duplicate-under-load.test.ts` (C2 at 3× target).
- **Manual QA:** QA-01 executed with three devices at peak arrival time; confirm p95 latency and zero duplicates.
- **Definition of Done:** budgets P11–P16 measured and recorded; shed behaviour documented in `CHECKIN.md`; runbook RB-01 instructions verified against actual messages.

---

### T-OPS-002 — Containerised stack with smoke tests

- **Requirement IDs:** NFR-OPS-001, NFR-OPS-004, NFR-REL-001
- **Goal:** Prove the deployment topology in `DEPLOYMENT.md` works as containers, with a smoke suite that runs against the containerised stack rather than a locally-run app.
- **ADR:** ADR-0020 (deployment topology, no migrations on boot)
- **Product documents:** `DEPLOYMENT.md` §1/§4, `docs/operations/BACKUP-RESTORE.md`
- **Expected modules:** `ops/docker/Dockerfile.app`, `ops/docker/Dockerfile.media`, `ops/docker-compose.yml`, `ops/docker-compose.test.yml`, `ops/smoke/**`
- **Dependencies:** T-TEST-001
- **Expected behavior:** `docker compose up` brings up proxy, app, worker, media, database and storage; the app image contains no ffmpeg and no shell-dependent entrypoint; the media image contains the pinned ffmpeg and no application database credentials; health endpoints exist for each service; the smoke suite checks HTTP readiness, a database round-trip, a storage write/read, a job enqueue+consume, and a public page render.
- **Invariants:** containers run as non-root with read-only root filesystems; no service exposes a port it does not need; secrets come from the environment/secret store, never baked into images.
- **Security:** minimal images reduce attack surface; the media runner is isolated from the internet by default (needed for T-TRANSCRIPT-005 egress control).
- **Privacy:** no personal data in images, fixtures or logs of the smoke run.
- **Concurrency:** worker and app start order independent; the app functions (degraded) when the worker is down, showing queue-backed features as pending.
- **Failure cases:** missing database → app reports unready and serves a clear maintenance page rather than crashing in a loop; storage missing → media features disable themselves with an explicit message.
- **Tests:** `ops/smoke/run.sh` + `tests/integration/ops/smoke.test.ts` — runs against the composed stack and asserts each checklist item, including that the app image does not contain ffmpeg.
- **Manual QA:** deploy the stack on a clean VM using only `DEPLOYMENT.md`; record everything the document failed to mention and fix the document.
- **Definition of Done:** smoke suite passes in CI against the composed stack; topology diagram matches reality; image content assertions automated.

---

### T-OPS-004 — Degraded-mode operations for a live event

- **Requirement IDs:** NFR-REL-006, NFR-PERF-004, NFR-OPS-003
- **Goal:** Define and rehearse the operational states that let a kajian proceed when a subsystem is down, and make the product *say* what mode it is in.
- **ADR:** ADR-0007 (offline deferred; paper + bulk correction), ADR-0026 (scanner port + first-class manual entry)
- **Product documents:** `OPERATIONS.md` §3/§6, `RUNBOOK.md`, `docs/product/EVENTS.md`
- **Expected modules:** `src/features/checkin/**` (state surfaced in UI), `src/features/media/**`, feature flags, `ops/runbooks/**`
- **Dependencies:** T-PERF-002, T-CHECKIN-014, flags infrastructure
- **Expected behavior:** documented modes — MANUAL_ONLY check-in, RECORDING_LOCAL_ONLY (uploads paused, buffer locally), TRANSCRIPTION_PAUSED, NOTIFICATIONS_PAUSED — each reachable by flag, each shown to the actor in plain language, each with an entry/exit procedure in the runbook; paper fallback has a bulk-entry path with reasons (never silent backdating).
- **Invariants:** degraded modes never fabricate success; the transition into and out of a mode is audited; modes are visible on the affected page, not only in an admin console.
- **Security:** degraded modes must not weaken tenancy or permissions to "keep things working".
- **Privacy:** paper fallback collects the minimum (name/identifier), and its data entry is audited.
- **Concurrency:** switching modes during an event must not lose in-flight operations; queued chunks from a paused upload mode drain afterwards.
- **Failure cases:** database down at the entrance; storage down during recording; provider down mid-transcription; worker down while events run.
- **Tests:** `tests/integration/ops/degraded-mode.test.ts` — each flag is toggled and the resulting user-visible states are asserted; a test asserts no degraded mode can return a false success.
- **Manual QA:** QA-06 drills (storage outage, provider outage, worker restart) run in staging and timed against the runbook.
- **Definition of Done:** modes implemented, documented in operator language, drilled at least once, and each drill's findings folded back into `RUNBOOK.md`.

---

### T-OPS-006 — Backup, export and restore confidentiality

- **Requirement IDs:** NFR-OPS-002, NFR-PRIV-002, NFR-PRIV-001
- **Goal:** Backups, exports and restored environments cannot become an uncontrolled copy of participant data.
- **ADR:** ADR-0013 (private storage), ADR-0020, ADR-0017
- **Product documents:** `docs/operations/BACKUP-RESTORE.md`, `RETENTION.md` (exports 7 days, backups 35 days), `PRIVACY.md` §6
- **Expected modules:** `ops/backup-restore.*` (scripts), `src/features/exports/**`, `src/server/storage/**`
- **Dependencies:** T-OPS-002, T-SEC-001
- **Expected behavior:** backups are encrypted at rest with keys held outside the storage account; restore targets a new instance and starts with jobs/notifications/retention disabled; exports are generated on demand, stored in a private bucket, signed with short TTLs, access-controlled by permission and deleted after 7 days; no export path can return another organization's rows; export requests are audited with the requesting actor and filters.
- **Invariants:** export content is limited to the fields the requester can already read in the UI (no "export reveals more" pattern); a restored environment never shares production credentials; deletion of expired exports is verified.
- **Security:** defends T-22 (backup/export exfiltration); the permission for export is narrow and reason-required where the matrix says so.
- **Privacy:** export/backup flows are listed in the privacy notice and in the data inventory; contact fields are excluded from exports unless explicitly selected (and audited).
- **Concurrency:** concurrent export requests are coalesced or queued; partial exports are never distributed.
- **Failure cases:** key unavailable, storage quota exceeded, export generation failure, expired export requested, restore verification mismatch.
- **Tests:** `tests/integration/exports/access.test.ts` (cross-org denial, field minimisation, audit entry), `tests/integration/ops/restore-safety.test.ts` (restored instance has jobs/notifications disabled), plus a script-level test that an expired export is unreachable.
- **Manual QA:** RB-18 drill with two people, including verifying export expiry behaviour.
- **Definition of Done:** scripts and flows implemented, tests green, drill completed and recorded, privacy notice lines for backups/exports verified against reality.

---

## A.2 Registration, check-in, attendance

---

### T-CHECKIN-014 — Record QR Check-In  ★ canonical template example

- **Requirement IDs:** FR-CHECKIN-004, FR-CHECKIN-009, FR-CHECKIN-013, NFR-REL-003
- **Goal:** Turn a validated token into exactly one durable attendance record, at the entrance, in under a second, without ever producing a duplicate or a false success.
- **ADR:** ADR-0006 (opaque tokens), ADR-0025 (attendance constraints), ADR-0026 (scanner port + manual path first-class)
- **Product documents:** `CHECKIN.md` §3–§6, `ATTENDANCE.md` §2, `docs/design/PAGES.md` (check-in console), `docs/design/UX-FLOWS.md` (entrance flow)
- **Expected modules:** `src/features/checkin/record-check-in.ts`, `src/domain/attendance/*.transitions.ts`, `src/features/checkin/check-in-result.ts`, `src/server/db/repositories/attendance.*`, `src/server/jobs/attendance-reconciliation.*`
- **Dependencies:** T-CHECKIN-001 (validation), T-CHECKIN-006 (event context), T-SEC-001 (scope), schema with the attendance constraints
- **Expected behavior:** the service receives a validated token result plus a bound device context (event, venue, entrance, operator) and: inserts one attendance record with `method = QR`, `checked_in_at` from the injected clock, and the acting operator; on a unique-constraint conflict it returns the **success-shaped** `ALREADY_CHECKED_IN` result carrying the original time and operator (never a validation error); a cancelled registration is refused (no record); a check-in outside the window is refused with the specific window reason; the record is emitted as `ParticipantCheckedIn` / `WalkInRegistered` (per `EVENTS.md`) in the same transaction.
- **Invariants:** at most one attendance row per (event, registration) and per (event, walk-in reference); attendance is append-only (corrections are new rows with reasons, never updates to the fact of arrival); counters are never stored (derived, ADR-0025); the response never echoes the token.
- **Security:** requires `checkin.record` permission in the event's scope; token value is not logged or returned; the operator identity is recorded for accountability; a stolen operator session is bounded by device binding and re-authentication (T-CHECKIN-016).
- **Privacy:** the attendance record stores registration/contact references, not duplicated personal data; the console shows names but never contact details (T-ATTEND-006); no participant history is written.
- **Concurrency:** **C2** — two scanners validating the same token simultaneously must yield exactly one record; the second response must be `ALREADY_CHECKED_IN`; implementation must use `INSERT … ON CONFLICT DO NOTHING RETURNING` (or equivalent) and must not rely on a read-then-write check.
- **Failure cases:** database unavailable → explicit `UNAVAILABLE` result with retry guidance and the manual path offered, **never** a success; event/window changed mid-flight → consistent refusal; token valid for a different event → `WRONG_EVENT`; device clock skewed → the server clock is authoritative; duplicate page submission → idempotent.
- **Tests:** `tests/integration/attendance/record-checkin.test.ts` (happy path, duplicate, cancelled, window-closed, wrong-event, DB-unavailable), `tests/integration/attendance/duplicate-scan.test.ts` (**C2**, N parallel), `tests/unit/checkin/result-mapping.test.ts` (every domain outcome → one result shape, no success on failure), and a contract test asserting the event payload contains ids and enums only.
- **Manual QA:** QA-01 steps 3, 4, 5, 6, 8, 10 — especially the simultaneous double-scan and the network-off case (no false success).
- **Definition of Done:** duplicate-free behaviour proven at the database level under concurrency; `ALREADY_CHECKED_IN` shape matches `API.md`; events emitted in-transaction; QA-01 exit criteria met; runbook RB-03 (duplicates) and RB-01 (failure spike) instructions match the actual UI text.

---

### T-CHECKIN-001 — Validate a check-in token

- **Requirement IDs:** FR-CHECKIN-003, FR-CHECKIN-005, FR-CHECKIN-008, NFR-SEC-004
- **Goal:** Decide, server-side and fast, what a scanned or typed code means, and return one unambiguous outcome with a human-readable reason.
- **ADR:** ADR-0006 (token format, hashing, revocation), ADR-0025, ADR-0026
- **Product documents:** `CHECKIN.md` §3, `docs/security/QR-SECURITY.md`, `API.md` (check-in endpoints)
- **Expected modules:** `src/features/checkin/validate-token.ts`, `src/domain/checkin/token-format.ts`, `src/server/db/repositories/checkin-tokens.*`, `src/server/cache/token-lookup.*`
- **Dependencies:** token issuance (T-REG-004), T-SEC-001, T-SEC-004
- **Expected behavior:** parse the `MAJ-XXXX-XXXX-XXXX-XXXX` format strictly (checksum + alphabet), hash the candidate with SHA-256, look up by hash within the bound event, and return exactly one of: `VALID`, `ALREADY_CHECKED_IN`, `INVALID_FORMAT`, `INVALID_TOKEN`, `WRONG_EVENT`, `EXPIRED`, `REVOKED`, `CANCELLED_REGISTRATION`, `WINDOW_NOT_OPEN`, `WINDOW_CLOSED`, `UNAVAILABLE` — each with a stable code, an Indonesian message, and a suggested action.
- **Invariants:** shape/format is validated before any database access (invalid scans must not reach the server at all in the QR path); results are total (no unhandled case); a token is never returned or logged; validation is side-effect free — **no attendance is written here**.
- **Security:** constant-time comparison for the hash lookup; per-device and per-event rate limits; no distinguishable timing between "unknown" and "wrong event" beyond what the product must communicate to the volunteer.
- **Privacy:** the lookup returns only what the console needs (display name, group size, masked identifier) and never the contact method.
- **Concurrency:** the same token validated concurrently must not create partial state; caching (if used) must be short-lived and invalidated on cancellation/revocation.
- **Failure cases:** unknown token, wrong event, expired, revoked, cancelled, window closed, storage/database unavailable, malformed input, oversized input, repeated invalid attempts.
- **Tests:** `tests/unit/checkin/token-format.test.ts` (accept/reject corpus, checksum, alphabet), `tests/unit/checkin/result-mapping.test.ts`, `tests/integration/checkin/validation.test.ts` (all outcomes against seeded data, including revoked and cancelled), `tests/integration/security/tokens.test.ts` (no PII in payload, no plaintext storage, rate limits).
- **Manual QA:** QA-01 steps 4–6; scan a poster QR, a Wi-Fi QR and another event's QR, verify distinct messages and no server round-trip for malformed codes.
- **Definition of Done:** the full outcome vocabulary is implemented with tests per outcome; the client performs zero authorization decisions; the manual path (short code) yields the same result shapes as the QR path.

---

### T-CHECKIN-003 — Token payload contains no personal data or entity ids

- **Requirement IDs:** FR-CHECKIN-011, FR-CHECKIN-012, NFR-SEC-005
- **Goal:** Guarantee that whatever is inside a QR code — or leaked by a screenshot — is useless without the running system.
- **ADR:** ADR-0006 (opaque 128-bit base32 token, SHA-256 at rest)
- **Product documents:** `docs/security/QR-SECURITY.md`, `PRIVACY.md` §4, `THREAT_MODEL.md` T-01
- **Expected modules:** `src/domain/checkin/token.ts` (generation + parsing), `src/shared/contracts/checkin.ts`, print view component shell
- **Dependencies:** T-CHECKIN-001
- **Expected behavior:** the QR payload is exactly the token string: no URL with query parameters where parsing is ambiguous, no JSON, no name, no phone, no email, no registration UUID, no event id, no database id, no timestamp of birth; generation uses a CSPRNG; at rest only the hash and a short display prefix are stored; the short code is a separate, rotation-capable secret with the same non-PII property.
- **Invariants:** the payload grammar is a strict regex; the payload length is fixed; entropy ≥ 128 bits; the same token is never issued twice (uniqueness enforced at the database level).
- **Security:** defends T-01; payload leakage must not enable enumeration; the token is revocable individually and per event.
- **Privacy:** a photograph of a code reveals nothing about the person except that they registered (and even that only to someone running the system).
- **Concurrency:** generation under concurrency must not duplicate tokens (unique constraint + retry).
- **Failure cases:** hash collision (retry with a new token), parsing ambiguity, accidentally long input, tokens in URLs (forbidden — the print view embeds the code as an image, not a link).
- **Tests:** `tests/unit/checkin/token-payload.test.ts` — asserts the payload has no `@`, no digit run of 8+, no UUID-shaped substring, no entity id, and matches the alphabet; `tests/integration/checkin/token-gen.test.ts` — 1e5 generations, zero collisions, uniform-ish distribution; a schema test asserts `checkin_tokens` has no plaintext column.
- **Manual QA:** export a printed QR page, decode it with an external scanner app, and confirm the decoded string is only the opaque token.
- **Definition of Done:** payload property tests in CI (they guard against future "convenience" changes), decode-and-inspect evidence recorded in QA, no URL-embedded token anywhere in the product.

---

### T-CHECKIN-006 — Guard the operator's event/venue context

- **Requirement IDs:** FR-CHECKIN-002, FR-CHECKIN-005, FR-CHECKIN-015
- **Goal:** Make it practically impossible for a volunteer to check people into the wrong event, and make the mistake visible when it happens.
- **ADR:** ADR-0026 (explicit bound context), ADR-0017
- **Product documents:** `CHECKIN.md` §2/§7, `docs/design/PAGES.md` (context bar), `docs/product/EVENTS.md`
- **Expected modules:** `src/features/checkin/session-context.ts`, check-in console UI shells, `src/features/checkin/validate-token.ts` (wrong-event branch)
- **Dependencies:** T-CHECKIN-001
- **Expected behavior:** the console shows a persistent, high-contrast context bar (event title, venue, entrance, device label, window state, last sync time) that cannot be scrolled away; a scan belonging to another event returns `WRONG_EVENT` with the specific instruction ("This code belongs to another kajian at this mosque"); two events at the same mosque on the same day are visually distinguishable at a glance; switching source events is an explicit, audited action.
- **Invariants:** the context bar's source of truth is the server-side bound session/token, not local storage alone; the wrong-event message never discloses the other event's participant data; changing context mid-session invalidates the previous scan cache.
- **Security:** the bound context is derived from the operator's authorized scope; a modified client cannot widen it (server re-checks on every call).
- **Privacy:** the wrong-event message names the event but never a person.
- **Concurrency:** context switching while scans are in flight must not record against the old context silently — in-flight validations resolve against the context they were validated with, and results state which event they belonged to.
- **Failure cases:** two events at the same venue at the same hour; an event rescheduled during a session; a device re-bound to a different entrance; clock skew vs the window.
- **Tests:** `tests/integration/checkin/context-guard.test.ts` (same-venue double event, reschedule mid-session, wrong-event scan), `tests/unit/checkin/context.test.ts` (context cannot be widened client-side), a UI test asserting the context bar cannot be dismissed.
- **Manual QA:** QA-01 step 5 plus a two-events-same-mosque scenario; verify the volunteer can tell which event is open without asking anyone.
- **Definition of Done:** context bar implemented and reviewed for glance-ability at 1 m; wrong-event outcome tested; operator confusion cases documented in `CHECKIN.md`.

---

### T-CHECKIN-011 — Token forgery resistance and revocation

- **Requirement IDs:** NFR-SEC-004, FR-CHECKIN-005, FR-CHECKIN-016
- **Goal:** Make guessing a code infeasible and make revocation immediate when a code must be cancelled.
- **ADR:** ADR-0006
- **Product documents:** `docs/security/QR-SECURITY.md`, `SECURITY.md` §6, `THREAT_MODEL.md` T-02
- **Expected modules:** `src/domain/checkin/token.ts`, `src/server/auth/rate-limit.*`, `src/features/checkin/revoke-token.ts`
- **Dependencies:** T-CHECKIN-001, T-SEC-005 (rate-limit store in Postgres)
- **Expected behavior:** ≥ 128 bits of entropy; SHA-256 at rest; constant-time comparison; per-device, per-event and per-IP rate limits on all attempt paths (QR, short code, name lookup); revocation by participant, organizer or platform admin takes effect on the next attempt (no long-lived positive cache); revocation reasons are recorded; mass revocation for an event is supported (e.g. suspected leak) with a single audited action.
- **Invariants:** a revoked token never validates, even if it was already scanned (the scan result remains valid — revocation affects future scans only); rate limits cannot lock out a legitimate entrance during an event (documented thresholds tied to P11–P16).
- **Security:** defends T-02; guessing space is infeasible and detectable via metrics; revocation is itself permission-gated.
- **Privacy:** revocation reasons are stored as an enum plus optional note, never a personal narrative.
- **Concurrency:** revocation racing with validation must resolve consistently (a scan either completes before revocation or is refused after; no half state).
- **Failure cases:** rate-limit store unavailable → fail closed for lookups but keep the manual paper path available; revocation on an already-scanned token; revocation during an open window.
- **Tests:** `tests/integration/security/token-entropy.test.ts` (distribution, uniqueness), `tests/integration/security/rate-limits.test.ts` (thresholds, shared across replicas, no false positives at target rate), `tests/integration/checkin/revocation.test.ts` (immediate effect, mass revocation, audit).
- **Manual QA:** attempt 50 wrong guesses with a test device and confirm the throttling message and that the entrance drill remains possible.
- **Definition of Done:** entropy and revocation proven by tests; thresholds documented in `SECURITY.md`; alert for sustained invalid-attempt rates active.

---

### T-CHECKIN-016 — Bound operator sessions at the entrance

- **Requirement IDs:** FR-CHECKIN-014, NFR-SEC-001, NFR-SEC-007
- **Goal:** Limit the damage a stolen or borrowed operator device can do at an entrance, without making volunteering painful.
- **ADR:** ADR-0026 (device binding), ADR-0017
- **Product documents:** `SECURITY.md` §7, `docs/security/AUTHZ-MATRIX.md` (volunteer scope), `THREAT_MODEL.md` T-12
- **Expected modules:** `src/features/checkin/device-binding.ts`, `src/server/auth/session.*`, check-in console shells
- **Dependencies:** T-SEC-002, T-CHECKIN-014
- **Expected behavior:** a check-in session is bound to a device identity minted for that event and entrance; the console shows the operator, device label and last activity; a configurable idle timeout ends the session and requires re-authentication (never a silent extension); a session can be revoked by an organizer, which immediately invalidates the device; check-in sessions cannot access participant lists, exports, or any other module; switching device requires re-binding (and is audited, feeding `checkin_device_switch_total`).
- **Invariants:** the bound session's permissions are a strict subset of the volunteer role's scope for exactly one event; no session is shared between volunteers implicitly; revocation takes effect on the next request.
- **Security:** defends T-12; limits lateral movement from a stolen device; the session token is short-lived and bound to the device fingerprint + event.
- **Privacy:** the operator's own identity is protected from participants (no personal contact shown in the console); the console never displays participant contacts.
- **Concurrency:** two devices claiming the same label must be distinguishable and separately revocable; revocation during in-flight scans must not lose committed records.
- **Failure cases:** lost device mid-event (revoke and continue on another device), device clock/timezone issues, session expired at the busiest moment (re-auth affordance must be one tap and not lose the queue).
- **Tests:** `tests/integration/checkin/device-binding.test.ts` (binding, idle timeout, revocation effect, cross-event refusal), `tests/integration/security/session-scope.test.ts` (a check-in session cannot call any other permission-gated action).
- **Manual QA:** QA-01 step 9 plus a deliberate mid-event revocation test; verify the volunteer can recover without organizer intervention.
- **Definition of Done:** binding, timeout and revocation implemented and tested; the recovery path documented in `CHECKIN.md` and visible in the UI; audit entries verified.

---

### T-CHECKIN-018 — Handle replay and screenshot forwarding

- **Requirement IDs:** FR-CHECKIN-013, NFR-ETH-003, NFR-SEC-005
- **Goal:** When a code image is shared or reused, produce one attendance record and an honest, non-destructive signal — no accusations, no silent second record.
- **ADR:** ADR-0006 (revisit trigger), ADR-0025
- **Product documents:** `CHECKIN.md` §abuse, `THREAT_MODEL.md` T-03, `docs/product/EVENTS.md`
- **Expected modules:** `src/features/checkin/record-check-in.ts`, `src/features/analytics/**` (duplicate metric only), `src/shared/contracts/events.ts`
- **Dependencies:** T-CHECKIN-014, T-CHECKIN-016
- **Expected behavior:** the second scan of the same token yields `ALREADY_CHECKED_IN` with the original time and entrance; duplicate events are counted as a rate metric per event and per device; when duplicates exceed a threshold the organizer sees a **question, not a verdict** ("17 duplicate scans at Pintu Utama — shared codes or a door problem?") with guidance; no participant is flagged, labelled or penalised; no automatic revocation from duplicates alone.
- **Invariants:** duplicates never create records; no participant-level accusation fields exist in the data model; the organizer's controls are limited to asking the volunteer and, if needed, revoking an individual token with a reason.
- **Security:** the signal is aggregate and non-identifying in telemetry; per-participant duplicate history is not exposed as a feature.
- **Privacy:** the design deliberately avoids building a "suspicious participant" record (a privacy and ethics requirement, `NFR-ETH-003`).
- **Concurrency:** high duplicate rates under load must not throttle legitimate first scans (C2 must hold with duplicates present).
- **Failure cases:** screenshot forwarded to someone who then registers separately (correct outcome: separate registration, separate record), a volunteer re-scanning by accident, an entrance whose device re-syncs after being offline.
- **Tests:** `tests/integration/attendance/duplicate-scan.test.ts` (extends **C2** with the metric), `tests/integration/analytics/duplicate-rate.test.ts` (aggregate only, no per-participant field), `tests/unit/checkin/duplicate-messages.test.ts` (wording is neutral).
- **Manual QA:** QA-07 row 3 (QR forwarding) executed on staging; confirm the second person cannot check in with a forwarded code and that no accusation appears anywhere.
- **Definition of Done:** behaviour and wording approved by review; metrics emitted; revisit trigger in ADR-0006 re-checked against measured duplicate rates.

---

### T-REG-009 — Registration abuse protection and rate limiting

- **Requirement IDs:** FR-REG-004, NFR-SEC-010, NFR-SEC-011
- **Goal:** Keep a public registration endpoint usable while preventing mass fake registrations and flattening attempts.
- **ADR:** ADR-0015 (idempotency), ADR-0017
- **Product documents:** `REGISTRATION.md`, `THREAT_MODEL.md` T-06, `SECURITY.md` §8
- **Expected modules:** `src/features/registration/**`, `src/server/http/rate-limit.*`, `src/server/security/challenge.*`
- **Dependencies:** T-REG-001 (registration flow), T-SEC-005
- **Expected behavior:** per-IP and per-contact-hash rate limits; idempotency keys so double-taps and retries never create duplicates; duplicate suppression per (event, contact) with a clear "you are already registered" response carrying the existing code; optional lightweight proof-of-work/bot check that is accessible (no third-party CAPTCHA dependency in MVP); capacity is never consumed by an abuser faster than the organizer can respond; organizers can close registration and pause new registrations for an event instantly.
- **Invariants:** limits are durable and shared across replicas; a legitimate participant on a mosque's shared Wi-Fi is not blocked (limits are per contact and per event, not only per IP); no personal data is stored to enforce limits beyond a hash with a rotating salt.
- **Security:** defends T-06; registration abuse metrics are alertable; the response to a blocked attempt does not confirm whether the contact already exists.
- **Privacy:** abuse protection must not become covert individual tracking; IP is hashed with a rotating salt and never stored raw; retention for abuse data is documented and short.
- **Concurrency:** parallel submissions from the same contact must converge (C1); capacity accounting must stay exact under contention.
- **Failure cases:** rate-limit store down (fail open for reading, fail closed for writes?), a burst from one mosque's network, coordinated abuse during a popular event, idempotency key reuse with different payloads (reject with conflict).
- **Tests:** `tests/integration/registration/abuse.test.ts` (limits, shared Wi-Fi false-positive check, duplicate convergence), `tests/integration/registration/capacity-race.test.ts` (**C1**), `tests/unit/registration/idempotency.test.ts`.
- **Manual QA:** QA-07-related abuse scenario: submit 30 registrations rapidly from one network and confirm the organizer-facing state stays honest (capacity not silently consumed).
- **Definition of Done:** limits configured with documented thresholds; tests green including the shared-network case; organizer has an immediate pause control; abuse metrics on the organizer dashboard.

---

### T-REG-011 — Contact data minimisation and protect-contact handling

- **Requirement IDs:** FR-REG-012, FR-REG-014, NFR-PRIV-001, NFR-PRIV-002
- **Goal:** Collect the least contact information the product can work with, protect it, and make sure it never becomes a directory.
- **ADR:** ADR-0016 (feedback anonymity pattern reused for contacts), ADR-0017
- **Product documents:** `PRIVACY.md` §4 (data inventory), `REGISTRATION.md` §4, `docs/product/EVENTS.md`
- **Expected modules:** `src/features/registration/contact.ts`, `src/server/crypto/contact-hash.*`, `src/shared/contracts/registration.ts`
- **Dependencies:** T-REG-001, T-SEC-001
- **Expected behavior:** the registration form asks for name + one contact method + optional count + optional accessibility need; contact values are stored in a separate, narrowly-permissioned table (`registration_contacts`) with the same row-level scoping, and only a keyed hash (`contact_hash`, rotating salt) is stored on the registration itself for dedupe; contact visibility is limited to explicitly permitted roles for a defined purpose (e.g. sending a reminder or contacting about a lost item), each access audited; any list view, export or API response returns the **minimised projection** by default; a participant can withdraw their contact value while keeping an attendance-relevant registration (retention in `RETENTION.md`).
- **Invariants:** no surface ever returns contacts for a whole event to a broad role; contact data is never joined into analytics or exports without explicit selection; the "participant history" concept remains non-existent (DOMAIN.md) — a contact cannot be used to build a cross-event profile by a mosque administrator.
- **Security:** protects against harvesting (T-07); hashes are keyed (not a plain digest) to resist dictionary attacks on phone numbers; decrypt-free storage where possible.
- **Privacy:** directly implements minimisation and purpose limitation; contact withdrawal works without destroying attendance records.
- **Concurrency:** concurrent writes to the contact table for the same registration must produce a single current value; withdrawal racing with a queued notification must result in the notification being skipped, not sent.
- **Failure cases:** contact format invalid (accept E.164 and local formats with a normalisation step, never reject plausible local numbers), duplicate registration with a different contact, contact withdrawal, key rotation with re-hash migration.
- **Tests:** `tests/integration/registration/contact-visibility.test.ts` (projection per role, audit on access), `tests/unit/registration/contact-hash.test.ts` (keyed, salted, rotation-compatible), `tests/integration/registration/contact-withdrawal.test.ts` (notification skipped, registration intact), a facility test asserting no API path returns contacts for a list of registrations.
- **Manual QA:** QA-07 row 1 (harvesting attempt) and a "withdraw contact" walkthrough with a real participant.
- **Definition of Done:** minimised projections are the default everywhere; visibility tests cover every role; withdrawal implemented and verified; privacy notice text matches the actual fields.

---

### T-ATTEND-006 — Never expose contact details in attendance surfaces

- **Requirement IDs:** FR-ATTEND-005, NFR-PRIV-001, NFR-PRIV-004
- **Goal:** The attendance report answers "how many, and who was expected but didn't come" — without turning into a contact list.
- **ADR:** ADR-0025 (attendance model), ADR-0017
- **Product documents:** `ATTENDANCE.md` §4/§5, `PRIVACY.md` §4, `THREAT_MODEL.md` T-07
- **Expected modules:** `src/features/attendance/**` (projections, export), `src/features/checkin/**` (console display), `src/shared/contracts/attendance.ts`
- **Dependencies:** T-ATTEND-001, T-REG-011
- **Expected behavior:** attendance views show name, group size and check-in state; contact methods appear only behind the narrow, audited permission; the no-show list contains names of registrations without a record — and is only available after the window closes (with a note explaining the state); export includes contacts **only** when the requester explicitly selects the field and holds the permission, with the selection recorded in the audit entry; the check-in console never shows contact details at all.
- **Invariants:** the default projection contains no contact field (type-level, so a missing permission cannot accidentally leak a column); each explicit contact access is logged with actor, event and purpose; CSVs/exports carry the same permission checks as the UI.
- **Security:** defends T-07; export is a reason-required action per the authorization matrix.
- **Privacy:** purpose limitation on contacts; the no-show list is a legitimate operational need and is scoped to the event only.
- **Concurrency:** exports generated during active check-in must state their as-of time; concurrent corrections don't produce contradictory exports without a timestamp.
- **Failure cases:** export requested without permission, contact withdrawn between export request and generation, large export timeouts, repeated export spam.
- **Tests:** `tests/integration/attendance/export-fields.test.ts` (default excludes contacts; explicit selection includes and audits), `tests/integration/security/isolation.test.ts` extension for export endpoints, a UI test asserting the console has no contact rendering path.
- **Manual QA:** generate an attendance export as an organizer and confirm contacts are absent by default; repeat with explicit selection and verify the audit entry.
- **Definition of Done:** default projections enforced by types and tests; export audit verified; `ATTENDANCE.md` examples reflect the actual export columns.

---

### T-AUDIO-002 — Recording notice, consent and policy statement

- **Requirement IDs:** FR-AUDIO-013, FR-AUDIO-002, NFR-PRIV-003
- **Goal:** Everybody in the room knows what is being recorded and what will happen to it, before a single byte is captured.
- **ADR:** ADR-0009 (master never deleted), ADR-0013 (private storage)
- **Product documents:** `AUDIO.md` §2, `CONTENT.md` §policies, `PRIVACY.md` §5, `docs/product/CONTENT-INTEGRITY.md`
- **Expected modules:** `src/features/audio/session-policy.ts`, recorder page shells, `src/shared/contracts/audio.ts`, `src/features/notifications/**` (template hooks)
- **Dependencies:** T-EVENT-005 (event policies), T-AUDIO-001
- **Expected behavior:** each event carries a recording policy (`NONE`, `INTERNAL`, `PUBLISH_AUDIO`, `PUBLISH_AUDIO_AND_TRANSCRIPT`) snapshotted at session start; the recorder page states, in plain Indonesian, what will be captured, where it will be stored, who can hear it, and whether it will be published; the announcement text for the room is available to copy/print; starting a session requires the operator to acknowledge the notice (recorded, with actor and time); changing the policy after capture is an explicit, audited action that cannot retroactively widen what is already published without review; `INTERNAL` sessions never expose a player outside the authorized roles.
- **Invariants:** the policy snapshot governs the session even if the event's policy changes later; a recording cannot exist without a recorded acknowledgement; publication requires an explicit action consistent with the policy (`AUDIO.md` §5).
- **Security:** unauthorized access to recordings is refused regardless of URL knowledge (signed, short-lived, permission-checked).
- **Privacy:** implements the transparency duty for audio capture; speakers' and participants' expectations are documented; no capture happens silently.
- **Concurrency:** policy change while a session is in progress must not change the session's snapshot; two operators acknowledging on two devices must not create contradictory states.
- **Failure cases:** policy changed mid-event, speaker objects after the session (withdrawal path, T-AUDIO-008), operator acknowledgement lost due to a refresh (must be re-required rather than assumed), event cancelled after recording.
- **Tests:** `tests/integration/audio/policy-snapshot.test.ts` (policy change does not alter an existing session), `tests/unit/audio/recorder-gate.test.ts` (no session without acknowledgement), `tests/integration/audio/internal-never-public.test.ts` (INTERNAL policy cannot be published).
- **Manual QA:** QA-02 step 1 verified with an actual operator who has never seen the product: can they explain what will be recorded and where it goes, after reading the page only?
- **Definition of Done:** policy model, acknowledgement and UI statement implemented and tested; announcement text reviewed by a mosque administrator for clarity; `AUDIO.md` and `PRIVACY.md` wording match the shipped UI.

---

### T-AUDIO-004 — Chunk upload endpoint with idempotency and limits

- **Requirement IDs:** FR-AUDIO-005, FR-AUDIO-006, FR-AUDIO-007, NFR-SEC-009
- **Goal:** Accept a continuous stream of small chunks over an unreliable venue network without ever duplicating, losing or accepting something unacceptable.
- **ADR:** ADR-0008 (10 s chunks, IndexedDB-first), ADR-0013 (private storage + presigned URLs), ADR-0015 (idempotency)
- **Product documents:** `docs/media/CHUNK-PROTOCOL.md`, `docs/media/STORAGE.md`, `API.md` (API-031)
- **Expected modules:** `src/features/media/upload-chunk.ts`, `src/server/http/routes/media/chunks.*`, `src/server/storage/**`, `src/server/db/repositories/recording-chunks.*`
- **Dependencies:** T-SEC-005 (validation), T-AUDIO-003 (session model), storage adapter
- **Expected behavior:** `POST /api/v1/recordings/{sessionId}/chunks` accepts a binary part with `sequence`, `durationMs`, `hash`, and an idempotency key; identical (sequence, hash) is a no-op success; same sequence with a different hash is `409 CHUNK_SEQUENCE_CONFLICT` (never a silent overwrite); size and count caps enforce the session limit; acceptance writes a row and stores the object before responding success; the response reports server-side `acceptedUpTo` so the client can prune its local queue; a completed upload set triggers assembly eligibility (never assembly-on-every-chunk).
- **Invariants:** the server state is derivable from the client at any time (no hidden server-only window); a success response means the bytes are durable in object storage **and** recorded; sequences are never renumbered; the object key derives from ids and sequence only (never a filename).
- **Security:** defends T-10 with T-SEC-005; the endpoint is permission-scoped to the session's event; uploads cannot overwrite another session's objects (key includes session id + tenant); presigned URLs are short-lived and single-use where supported.
- **Privacy:** chunk metadata contains no personal data; storage is private by default.
- **Concurrency:** **C7/C8** — out-of-order arrival is normal and must be handled by sequence, not arrival order; duplicate submissions are idempotent; concurrent assembly must not start on an incomplete set.
- **Failure cases:** network abort mid-chunk (client retries), storage failure (no row written, error is retryable), size overrun, malformed container, session already assembled, session cancelled, quota exhausted, clock skew in duration metadata.
- **Tests:** `tests/integration/media/chunk-idempotency.test.ts` (**C8**), `tests/integration/media/assembly-out-of-order.test.ts` (**C7**), `tests/integration/security/upload-abuse.test.ts` (with T-SEC-005), `tests/unit/media/chunk-limits.test.ts`.
- **Manual QA:** QA-02 steps 3 and 6 — the outage and the device change — verifying `acceptedUpTo` reconciliation and zero lost acknowledged chunks.
- **Definition of Done:** protocol implemented as documented; idempotency and conflict semantics proven; storage durability asserted (object exists with expected size/hash before success); metrics for accepted/retried/failed emitted.

---

### T-AUDIO-008 — Authorized access, withdrawal and unpublishing of recordings

- **Requirement IDs:** FR-AUDIO-011, FR-AUDIO-016, FR-CONTENT-007
- **Goal:** Only the right people can hear a recording, and a speaker's or organizer's withdrawal request is honoured concretely.
- **ADR:** ADR-0013 (private storage + short presigned URLs), ADR-0014/0024 (no popularity surfaces)
- **Product documents:** `AUDIO.md` §5, `CONTENT.md` §7/§10, `PRIVACY.md` §5, `THREAT_MODEL.md` T-11/T-15
- **Expected modules:** `src/features/audio/access.ts`, `src/features/content/withdrawal.ts`, `src/server/storage/signing.*`
- **Dependencies:** T-AUDIO-002 (policies), T-SEC-001/002, T-CONTENT-003 (moderation)
- **Expected behavior:** playback uses short-lived signed URLs issued only after a permission check; `INTERNAL` policy renders no player anywhere outside the authorized roles; withdrawal (speaker, organizer, platform admin) unpublishes immediately, removes the item from search and public navigation, keeps the master audio (deletion only via retention or a lawful erasure), records the requester, reason and timestamp, and shows a neutral explanation page to anyone following an old link; withdrawal of a published transcript also blocks its audio signing for public listeners.
- **Invariants:** signed URLs are never logged; withdrawal is auditable and reversible only by an explicit new publication decision; no public surface exposes play counts, ratings or rankings (ADR-0014/0024).
- **Security:** defends T-11; the same permission governs direct download and streaming; revocation of access takes effect within the signed URL TTL at most.
- **Privacy:** withdrawal is the practical expression of consent for a speaker; the explanation page states what was removed without exposing reasons that could embarrass a person.
- **Concurrency:** withdrawal racing with an in-flight signed URL (documented as ≤ TTL exposure, accepted residual), withdrawal racing with publication approval (must not resurrect content).
- **Failure cases:** withdrawal during an active event, withdrawal for audio that was never published, multiple withdrawal requests, a withdrawal that cannot delete derived files yet (they are excluded from public access immediately).
- **Tests:** `tests/integration/audio/access-control.test.ts` (per role, per policy, signed TTL bounds), `tests/integration/content/withdrawal.test.ts` (search removal, explanation page, audit, re-publication requires review), `tests/unit/content/explanation-wording.test.ts` (neutral wording).
- **Manual QA:** QA-07 row 5 (published-content withdrawal) plus a speaker-request rehearsal with a mosque administrator.
- **Definition of Done:** access, withdrawal and explanation page implemented and tested; audit records verified; `CONTENT.md` §10 matches the implemented behaviour.

---

## A.3 Transcription, content, feedback, notifications

---

### T-TRANSCRIPT-005 — Provider egress control and data-processing boundary

- **Requirement IDs:** FR-TRANSCRIPT-003, NFR-PRIV-007, NFR-PRIV-008
- **Goal:** No audio ever leaves the deployment for a third-party speech service unless that decision is explicit, documented and switchable off.
- **ADR:** ADR-0011 (TranscriptionProvider port; self-hosted Whisper default), ADR-0009
- **Product documents:** `TRANSCRIPTION.md` §3, `PRIVACY.md` §5 (processors), `docs/transcription/PIPELINE.md`, `THREAT_MODEL.md` T-19
- **Expected modules:** `src/server/transcription/providers/**` (port + adapters), config module, media runner egress policy
- **Dependencies:** T-TRANSCRIPT-001 (job orchestration), T-OPS-002 (network policy per container)
- **Expected behavior:** `TRANSCRIPTION_EGRESS_ENABLED=false` by default; the self-hosted adapter runs inside the deployment and needs no egress; a hosted adapter requires an explicit environment change **and** a decision record naming the processor, the data categories sent, the retention at the provider and the lawful basis; the media container's egress is restricted to the configured provider host only (allow-list), never the open internet; provider requests carry only the audio bytes needed plus a job reference (no participant names, no event attendee data); provider responses are validated before storage.
- **Invariants:** the code cannot construct a hosted request when egress is disabled (assertion at adapter construction, not a comment); the processor list in `PRIVACY.md` and the configured adapters cannot drift (a startup check compares them and warns loudly).
- **Security:** defends T-19; egress allow-list limits exfiltration if the media runner is compromised.
- **Privacy:** this is the single most consequential data-protection decision in the product; it is default-off, documented, and reversible.
- **Concurrency:** concurrent jobs must respect the same egress policy; a configuration change applies to newly created jobs only (in-flight jobs finish under the policy they started with, recorded on the job).
- **Failure cases:** provider unreachable, egress disabled while a hosted adapter is configured (fail with a clear configuration error, never a silent fallback), provider returning partial output, provider retention unknown (blocked until answered), credentials invalid.
- **Tests:** `tests/unit/providers/egress-guard.test.ts` (construction fails when disabled), `tests/integration/providers/adapter-contract.test.ts` (recorded fixtures: success, partial, malformed, empty), `tests/integration/providers/egress-allowlist.test.ts` (connection to a non-allow-listed host fails), a config test asserting `PRIVACY.md`'s processor table and the enabled adapters agree.
- **Manual QA:** capability check in staging: with egress disabled, attempt a hosted transcription and confirm a clear configuration refusal and zero outbound connections (verify at the network layer).
- **Definition of Done:** default-off proven by test; decision record exists for any enabled provider; startup consistency check implemented; media container egress restricted and verified.

---

### T-TRANSCRIPT-012 — Publication gate (no machine text becomes public unreviewed)

- **Requirement IDs:** FR-TRANSCRIPT-006, FR-TRANSCRIPT-010, FR-CONTENT-007
- **Goal:** Make unreviewed machine output structurally incapable of reaching the public archive.
- **ADR:** ADR-0012 (review gate; `published_at ⇒ approved_by`), ADR-0023 (append-only revisions)
- **Product documents:** `TRANSCRIPTION.md` §6/§8, `CONTENT.md` §5, `STATE_MACHINE.md` (transcript machine), `THREAT_MODEL.md` T-13
- **Expected modules:** `src/domain/transcript/*.transitions.ts`, `src/features/transcription/publish.ts`, database CHECK constraints, `src/features/content/**` (public projections)
- **Dependencies:** T-TRANSCRIPT-008 (revisions), T-TRANSCRIPT-010 (review UI), T-CONTENT-002
- **Expected behavior:** the only path to `PUBLISHED` is `APPROVED` by a human whose identity is recorded, on a specific revision (`approved_revision_id`); the public projection reads the approved revision only; a machine draft (revision #1) can never be published directly; publication is refused when the event's policy forbids it or when blocking flags are unresolved (unless explicitly acknowledged with a reason); unpublishing requires a reason and immediately removes the item from search and public navigation.
- **Invariants:** database-level CHECK constraints enforce the pairing (`published_at IS NOT NULL ⇒ approved_by IS NOT NULL AND approved_revision_id IS NOT NULL`); no code path can set `PUBLISHED` without an approval row; editing after publication does **not** change the public output until re-approval; the machine draft remains retrievable for audit.
- **Security:** defends T-13 (leakage of unreviewed text); the gate is enforced in the domain, the service, the API and the database (four independent places, tested separately).
- **Privacy:** unpublished transcripts may contain unverified personal details; keeping them non-public is both an ethics and privacy control.
- **Concurrency:** **C6** — two reviewers editing from the same base version: one succeeds, the other receives a conflict with a diff; approval racing with an edit must not approve a revision that no longer exists (approval binds a revision number).
- **Failure cases:** approval on a stale revision, publication attempt on a failed job, unpublish during an in-flight public request, policy changed to `INTERNAL` after approval, search index lag (must fail closed: unindexed is acceptable, exposing is not).
- **Tests:** `tests/integration/transcription/publish-gate.test.ts` (direct state set fails at domain, service and database layers), `tests/integration/transcription/revision-conflict.test.ts` (**C6**), `tests/integration/content/public-projection.test.ts` (only approved revisions are ever served; unpublish removes from search), `tests/unit/transcript/machine-draft-cannot-publish.test.ts`.
- **Manual QA:** QA-05 — attempt to publish an unreviewed draft as a platform administrator and confirm refusal with an explanation; then complete the review and publish.
- **Definition of Done:** all four enforcement layers implemented and independently tested; CHECK constraints present in the schema; search exclusion verified; `CONTENT.md` and `TRANSCRIPTION.md` describe the shipped behaviour exactly.

---

### T-TRANSCRIPT-014 — Certainty markers, citations and no silent correction

- **Requirement IDs:** FR-TRANSCRIPT-006, FR-TRANSCRIPT-008, FR-TRANSCRIPT-010, NFR-ETH-002
- **Goal:** The product never presents machine text as if a human verified it, and never "fixes" religious text automatically.
- **ADR:** ADR-0023 (append-only revisions; machine draft = revision #1), ADR-0012
- **Product documents:** `docs/transcription/REVIEW-WORKFLOW.md`, `docs/transcription/CODE-SWITCHING.md`, `docs/product/CONTENT-INTEGRITY.md`, `CONTENT.md` §4
- **Expected modules:** `src/domain/transcript/certainty.ts`, `src/features/transcription/**` (editor and public projection), `src/shared/contracts/transcript.ts`
- **Dependencies:** T-TRANSCRIPT-007 (segmentation), T-TRANSCRIPT-012 (gate)
- **Expected behavior:** machine output is stored verbatim and displayed with a provenance header ("Mesin, belum ditinjau"); segments marked `RECITATION` (Qur'anic verses, hadith, Arabic phrases) are never altered by any automation and are rendered with Arabic-aware typography and direction; "hints" (suggested spellings, verse matches) are suggestions only and require an explicit human acceptance that is recorded; uncertainty is representable per segment (`CERTAIN`, `UNCERTAIN`, `UNINTELLIGIBLE`) and remains visible in the published page as a chip; every save appends a revision with author, timestamp and a per-segment diff; the published page always states the reviewer's name, the revision number and the review date.
- **Invariants:** no code path mutates a stored segment except through a human-authored revision; the machine draft (revision #1) is immutable and always retrievable; uncertainty markers cannot be removed by approval (only by an explicit human edit).
- **Security:** not a security control, but it is integrity-critical; the revision chain is tamper-evident (same pattern as audit).
- **Privacy:** reviewer attribution is intentional and limited to name/role (no contact data).
- **Concurrency:** concurrent segment edits follow optimistic concurrency (C6); marker changes are part of the same revision as the text change they belong to.
- **Failure cases:** a hint applied accidentally (must be revertible via a new revision), a verse match that is wrong (must remain a suggestion), untranslatable or unintelligible audio (must be markable), reviewer disagreement across sessions.
- **Tests:** `tests/unit/transcript/no-autocorrect.test.ts` (no automation can write to a `RECITATION` segment), `tests/unit/transcript/certainty.test.ts` (markers persist through lifecycle), `tests/integration/transcription/revision-history.test.ts` (append-only, per-segment diff, rev #1 immutable), `tests/browser/transcript/arabic-rendering.test.ts` (bidi, diacritics, no clipping).
- **Manual QA:** QA-05 — reviewer marks two uncertain passages, flags one attribution, and confirms the published page shows both the uncertainty and the provenance.
- **Definition of Done:** markers, provenance and immutability implemented and tested; the public page wording reviewed by a mosque administrator and a reviewer; no automation path can write to stored segments (enforced by types plus tests).

---

### T-FEEDBACK-004 — Feedback anonymity enforced by constraint

- **Requirement IDs:** FR-FEEDBACK-003, FR-FEEDBACK-004, NFR-PRIV-005
- **Goal:** When a participant chooses to give anonymous feedback, the system must be unable to attribute it — not "should not", unable.
- **ADR:** ADR-0016 (anonymity CHECK + small-sample gate)
- **Product documents:** `FEEDBACK.md` §4, `PRIVACY.md` §4, `docs/product/EVENTS.md`
- **Expected modules:** `src/domain/feedback/anonymity.ts`, database CHECK constraint, `src/features/feedback/submit.ts`, `src/shared/contracts/feedback.ts`
- **Dependencies:** T-FEEDBACK-001 (submission), schema
- **Expected behavior:** an anonymous feedback row has `registration_id IS NULL` and `contact_hash IS NULL` (enforced by a database CHECK, so even a direct insert cannot violate it); stored time is day-granularity for anonymous rows; the submitter receives a receipt code that is not linked to the row (or a non-identifying confirmation only); organisers cannot see any attribution path, and there is no join that could reconstruct it; IP is not stored; the submission form explains plainly what anonymity does and does not protect (e.g. the free text itself may reveal identity — stated honestly).
- **Invariants:** the CHECK constraint exists in the schema, not only in the service; no logging of the submission payload; removal of the submitter's session does not change the row's content; retention applies identically to anonymous and identified feedback.
- **Security:** defends T-15; the anonymity mechanism must not be defeatable by an organizer using the admin UI, exports or the API.
- **Privacy:** the core privacy promise of the feedback module; also honesty: anonymity is scoped to attribution, not to the content the person chose to write.
- **Concurrency:** concurrent submissions still produce the one-request-per-person rule without creating a link; a database failure must not store a partial row that includes a contact.
- **Failure cases:** attempted insert with both fields, attempted update to clear anonymity (forbidden), export containing an anonymous row (must show no attribution fields at all), an organizer attempting to correlate by timing (day granularity plus small-sample rules make it uninformative).
- **Tests:** `tests/integration/feedback/anonymity.test.ts` (constraint proof by direct insert, service-level refusal, export projection), `tests/unit/feedback/anonymity.test.ts` (domain rule), a test asserting the anonymous projection has no attribution columns at the type level.
- **Manual QA:** QA-07 row 2 (de-anonymisation attempt) including an export attempt.
- **Definition of Done:** constraint in the schema, refusal tests green, projection types carry no attribution fields, the privacy statement on the form reviewed.

---

### T-FEEDBACK-006 — Feedback moderation and small-sample reporting

- **Requirement IDs:** FR-FEEDBACK-006, FR-FEEDBACK-007, NFR-ETH-004
- **Goal:** Feedback must help organizers improve, must never become harassment of a speaker, and must never be reported with fake precision.
- **ADR:** ADR-0016 (n < 5 suppression), ADR-0014/0024 (no ranking)
- **Product documents:** `FEEDBACK.md` §5/§6, `docs/product/CONTENT-INTEGRITY.md`, `THREAT_MODEL.md` T-16
- **Expected modules:** `src/features/feedback/reporting.ts`, `src/features/moderation/**`, `src/domain/feedback/aggregate.ts`
- **Dependencies:** T-FEEDBACK-003 (aggregates), T-MOD-001 (moderation)
- **Expected behavior:** dimensions reported to a speaker are limited to organizational/venue/audio/topic relevance and are shown as aggregates **only** when n ≥ 5; free-text comments shared with a speaker are only those explicitly permitted by the organizer and contain no attribution for anonymous submissions; abusive or off-topic content can be hidden from reports with a recorded reason (the content itself is not deleted without a retention decision); no speaker comparison, ranking or public visibility exists in any form; response rates are reported with their denominator ("18 of 300 registered").
- **Invariants:** aggregate output is a function of the raw rows and is recomputable; small-sample suppression is applied at the projection layer, so no API can bypass it; moderation actions are audited and reversible; nothing about feedback is public.
- **Security:** defends T-16 (harassment vector) and prevents data leakage of comments to unauthorized roles.
- **Privacy:** suppression and minimal disclosure protect small groups from inference; retention converts raw feedback to aggregates after 12 months (`RETENTION.md` R-class).
- **Concurrency:** aggregation during active submissions must state its as-of time; hiding a comment while an aggregate is being computed must not produce a partially updated report.
- **Failure cases:** a submission that is abusive, a small event where suppression hides everything (the UI must explain why, not show an empty chart without a reason), a speaker requesting raw comments (refused with an explanation), feedback arriving after the window closed.
- **Tests:** `tests/unit/feedback/aggregate.test.ts` (suppression boundary at n = 5, denominators, no ranking output), `tests/integration/feedback/reporting.test.ts` (projection cannot be bypassed, moderation audit, aggregate-as-of), a facility test asserting no surface exposes speaker comparison.
- **Manual QA:** with a seeded event of 4 responses, confirm the report explains suppression; then with 8, confirm aggregates appear with the denominator.
- **Definition of Done:** reporting and suppression implemented and tested; moderation flow audited; wording reviewed for respectfulness (no blame framing toward speakers).

---

### T-NOTIF-004 — Channel rules: no tokens in uncontrolled channels

- **Requirement IDs:** FR-NOTIF-010, FR-NOTIF-004, NFR-PRIV-006
- **Goal:** A check-in token never lands in a channel where it can be read by the wrong person, and if it would, the product sends a short redemption code instead.
- **ADR:** ADR-0006 (tokens), ADR-0013
- **Product documents:** `NOTIFICATIONS.md` §4/§6, `SECURITY.md` §6, `THREAT_MODEL.md` T-20, `PRIVACY.md` §4
- **Expected modules:** `src/features/notifications/channel-policy.ts`, `src/domain/notifications/redaction.ts`, `src/shared/contracts/notifications.ts`
- **Dependencies:** T-NOTIF-003 (channel adapters), T-REG-005 (participant code page)
- **Expected behavior:** channels are classified as access-controlled (in-app, the participant's authenticated code page) or not (email, and any future SMS/WhatsApp); a check-in QR/token value may only be sent through access-controlled channels; other channels receive a **redemption link** to the authenticated code page plus a short code only when the recipient is verified; templates are typed so a token-shaped value cannot be interpolated into a non-controlled template (validation at intent creation); reminder messages use neutral wording that does not reveal attendance status.
- **Invariants:** the classification is data, not scattered logic; a template/intent mismatch is rejected before dispatch (and cannot be forced by an organizer); a redemption link is single-use and short-lived; nothing in notifications includes contact details of a third party.
- **Security:** defends T-20; prevents a forwarded email from becoming an attendance credential.
- **Privacy:** keeps personal content minimal in messages; no attendance history, no no-show wording.
- **Concurrency:** dedupe keys prevent duplicate sends for the same fact (`notification_intents` unique); a redemption link issued twice must not create two valid secrets for the same purpose.
- **Failure cases:** email forwarded to a group, recipient without a phone (link only), link expired (re-request path), template edited to include a token by mistake (blocked, alerted), quiet hours deferral of an essential reminder (allowed only for the documented essential class).
- **Tests:** `tests/integration/notifications/channel-policy.test.ts` (token impossible in a non-controlled channel; redemption link lifecycle), `tests/unit/notifications/template-guard.test.ts` (intent creation rejects token-shaped values), `tests/integration/notifications/dedupe.test.ts` (**C10**).
- **Manual QA:** send a reminder to a test participant and inspect the email: verify it contains no code value, that the link requires authentication, and that the wording does not reveal check-in status.
- **Definition of Done:** classification, guard and redemption flow implemented and tested; `NOTIFICATIONS.md` catalogue table updated with the class per template; alert active on rejected intents.

---

### T-CONTENT-003 — Link and material safety, and moderation of published content

- **Requirement IDs:** FR-CONTENT-003, FR-MOD-001, FR-MOD-002
- **Goal:** Materials and links attached to an event cannot deliver malware or unwanted tracking, and published content can be moderated without destroying the audit trail.
- **ADR:** ADR-0013 (private storage), ADR-0014/0024 (no ranking), ADR-0023 (immutability principles)
- **Product documents:** `CONTENT.md` §6, `docs/product/CONTENT-INTEGRITY.md`, `THREAT_MODEL.md` T-23, `docs/design/PAGES.md` (event detail)
- **Expected modules:** `src/features/content/materials.ts`, `src/features/moderation/**`, `src/server/storage/**` (upload validation reuse)
- **Dependencies:** T-SEC-005 (upload validation), T-TRANSCRIPT-012 (publication gate)
- **Expected behavior:** uploaded materials go through the same validation as audio (magic bytes, size, type allow-list) and are served from private storage with `Content-Disposition: attachment` and a non-sniffable content type; outbound links are display-only (no open redirect, no `target=_blank` without `rel="noopener noreferrer"`, no link shorteners, no tracking pixels, no remote images); moderation can hide a material, comment or published item with a reason, retains the record, and is limited to platform moderators for final decisions (separation of duties); hidden items disappear from public surfaces immediately.
- **Invariants:** no user-supplied HTML is ever rendered; images are re-encoded/served from our own storage rather than hot-linked; a moderation decision cannot delete the underlying audit trail; publishers cannot moderate their own content's reported items (SoD).
- **Security:** defends T-23; prevents the app from becoming a distribution or tracking vector.
- **Privacy:** blocks third-party tracking via remote resources, which is also an analytics-prohibition (`FR-ANALYTICS-004`).
- **Concurrency:** hiding an item while it is being served (acceptable ≤ cache TTL, documented) and while a moderation report is open (idempotent decisions).
- **Failure cases:** material upload with a disguised type, link to a hostile domain, a moderator and publisher being the same person (refused by SoD), appeals/republish requests (require a new decision, recorded).
- **Tests:** `tests/integration/content/material-safety.test.ts` (validation, headers, no hot-linking), `tests/integration/moderation/decisions.test.ts` (reason required, SoD enforced, hidden disappears from search, audit retained), `tests/unit/content/link-policy.test.ts` (no open redirect, no shorteners).
- **Manual QA:** publish an event with a hostile-looking link and a disguised file; verify both are neutralised, and that hide-then-restore retains history.
- **Definition of Done:** policies implemented and tested; moderation reasons required and audited; `CONTENT.md` §6 matches behaviour.

---

# PART B — PLANNED TASK INVENTORY (compact)

These tasks complete the roadmap. They use the same sixteen fields when they are picked up (expand them
from this table into a full block before implementation). Status legend: **P0** = Phase 0 skeleton
exists · **Planned** = not started · slice = the roadmap slice that delivers it.

## B.1 Foundation and platform

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-ARCH-001 | Contract registry: types, DTOs, validation schemas, event payload types | NFR-OPS-001 | P0 |
| T-ARCH-004 | Error taxonomy and typed results (`AppError` codes → HTTP shapes) | NFR-OBS-004 | P0 |
| T-ARCH-005 | Job framework wiring (pg-boss adapters, idempotency keys, dead letter) | ADR-0010 | Planned / VS-2 |
| T-ARCH-006 | Outbox emission in the same transaction + dispatcher | ADR-0010, ADR-0015 | Planned / VS-2 |
| T-TEST-002 | Fixture sets and seed generator (`tiny`, `event-L`, `multitenant`, …) | NFR-OPS-001 | P0 |
| T-TEST-003 | Deterministic concurrency harness (C1…C12 helpers) | NFR-REL-003 | Planned / VS-3 |
| T-DOCS-002 | Traceability maintenance (requirement → doc → task → test) | NFR-OPS-001 | P0 |
| T-OPS-001 | Local development stack (compose, fixtures, seeds) | NFR-OPS-001 | P0 |
| T-OPS-003 | CI pipeline (verify/integration/browser/build/release/nightly) | NFR-OPS-001 | P0 |
| T-OPS-005 | Migration rehearsal on a production-shaped copy | NFR-OPS-004 | Planned / VS-15 |
| T-OBS-001 | Dashboards and SLO wiring | NFR-OBS-003 | Planned / VS-14 |
| T-OBS-003 | Alert routing, dedupe, acknowledgement lifecycle | NFR-OBS-005 | Planned / VS-14 |
| T-PERF-003 | Query and index review harness (EXPLAIN budgets on critical queries) | NFR-PERF-003 | Planned / VS-5 |

## B.2 Identity, organizations, mosques, speakers (VS-1)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-ORG-001 | Identity integration (Better Auth) with durable rate limiting | NFR-SEC-001 | Planned / VS-1 |
| T-ORG-002 | Organization + membership model and role assignment | FR-ORG-001, FR-ORG-002 | Planned / VS-1 |
| T-ORG-003 | Role switching, invitation and offboarding flows | FR-ORG-004, FR-ORG-005 | Planned / VS-1 |
| T-MOSQUE-001 | Mosque create/edit with address, coordinates, timezone | FR-MOSQUE-001 | Planned / VS-1 |
| T-MOSQUE-002 | Venue, hall, entrance and facility model (accessibility data) | FR-MOSQUE-003, FR-MOSQUE-004 | Planned / VS-1 |
| T-MOSQUE-003 | Public mosque page and discovery search (name, area, facilities) | FR-MOSQUE-006, FR-MOSQUE-007 | Planned / VS-1 |
| T-MOSQUE-004 | Prayer-time source configuration with "perkiraan" fallback | FR-MOSQUE-008, ADR-0018 | Planned / VS-1 |
| T-MOSQUE-005 | Mosque administrator roster and contact-purpose policy | FR-MOSQUE-009 | Planned / VS-1 |
| T-SPEAKER-001 | Speaker profile create/edit (name, areas of study, languages) | FR-SPEAKER-001, FR-SPEAKER-002 | Planned / VS-1 |
| T-SPEAKER-002 | Speaker verification and profile claim | FR-SPEAKER-003 | Planned / VS-1 |
| T-SPEAKER-003 | Public speaker page (no ranking, no scores anywhere) | FR-SPEAKER-005, ADR-0014 | Planned / VS-1 |
| T-SPEAKER-004 | Anti-ranking regression suite (assert no ordering by popularity exists) | NFR-ETH-001, ADR-0024 | Planned / VS-1 |

## B.3 Programs and events (VS-2)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-PROGRAM-001 | Program create/edit (recurring kajian definition) | FR-PROGRAM-001 | Planned / VS-2 |
| T-PROGRAM-002 | Recurrence engine (weekly, specific weekday, monthly, custom, series) | FR-PROGRAM-002, ADR-0018 | Planned / VS-2 |
| T-PROGRAM-003 | Series generation with idempotent event creation | FR-PROGRAM-003, FR-PROGRAM-004 | Planned / VS-2 |
| T-PROGRAM-004 | Change propagation to future events in a series | FR-PROGRAM-005 | Planned / VS-2 |
| T-PROGRAM-005 | Program pause/resume and exception dates (holidays, Ramadan) | FR-PROGRAM-006, FR-PROGRAM-007 | Planned / VS-2 |
| T-EVENT-001 | Event lifecycle and draft editing | FR-EVENT-001, FR-EVENT-002 | Planned / VS-2 |
| T-EVENT-002 | Publish readiness checklist (venue, speaker, times, registration, notice) | FR-EVENT-003 | Planned / VS-2 |
| T-EVENT-003 | Public discovery list and event detail page | FR-EVENT-004, FR-EVENT-005 | Planned / VS-2 |
| T-EVENT-004 | Reschedule, cancel and notify-intents on change | FR-EVENT-006, FR-EVENT-007 | Planned / VS-2 |
| T-EVENT-005 | Event policy assignment (registration mode, capacity, recording, publication) | FR-EVENT-008, FR-EVENT-009 | Planned / VS-2 |
| T-EVENT-006 | Entrances and check-in window configuration | FR-EVENT-010, FR-EVENT-011 | Planned / VS-2 |
| T-EVENT-007 | Same-venue overlap and duplicate detection | FR-EVENT-012 | Planned / VS-2 |
| T-EVENT-008 | Speaker confirmation workflow | FR-EVENT-013 | Planned / VS-2 |
| T-EVENT-009 | Event series view and archive linkage | FR-EVENT-014, FR-EVENT-015 | Planned / VS-2 |

## B.4 Registration (VS-3)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-REG-001 | Registration flow with minimal fields and result page | FR-REG-001, FR-REG-002 | Planned / VS-3 |
| T-REG-002 | Capacity accounting and waitlist placement | FR-REG-003, FR-REG-005 | Planned / VS-3 |
| T-REG-003 | Waitlist offer, acceptance and expiry | FR-REG-006 | Planned / VS-3 |
| T-REG-004 | Token issuance (QR payload + short code) | FR-REG-007, ADR-0006 | Planned / VS-3 |
| T-REG-005 | Participant code page (offline-capable, print view) | FR-REG-008, NFR-MOB-004 | Planned / VS-3 |
| T-REG-006 | Participant self-service cancellation | FR-REG-009 | Planned / VS-3 |
| T-REG-007 | Invitation mode (invited-only registration) | FR-REG-010, FR-REG-011 | Planned / VS-3 |
| T-REG-008 | Group registration (participant count) | FR-REG-013 | Planned / VS-3 |
| T-REG-010 | Registration confirmation notification intent | FR-REG-007, FR-NOTIF-002 | Planned / VS-12 |
| T-REG-012 | Server-rendered registration page performance (fast on 3G) | NFR-PERF-001, NFR-MOB-001 | Planned / VS-3 |

## B.5 Check-in and attendance (VS-4, VS-5)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-CHECKIN-002 | Scanner UI with capability detection and two tiers | FR-CHECKIN-001, NFR-MOB-005 | Planned / VS-4 |
| T-CHECKIN-004 | Manual short-code entry (large targets, code readable) | FR-CHECKIN-006, NFR-A11Y-002 | Planned / VS-4 |
| T-CHECKIN-005 | Name lookup with confirm-before-commit | FR-CHECKIN-007 | Planned / VS-4 |
| T-CHECKIN-007 | Check-in window management (open, grace, close) | FR-CHECKIN-010 | Planned / VS-4 |
| T-CHECKIN-008 | Walk-in registration at the door (two fields) | FR-CHECKIN-012 | Planned / VS-4 |
| T-CHECKIN-009 | Operator live counters (rates only, no names) | FR-CHECKIN-015 | Planned / VS-4 |
| T-CHECKIN-010 | Operator feedback states and announcements | FR-CHECKIN-016, NFR-A11Y-003 | Planned / VS-4 |
| T-CHECKIN-012 | Paper-fallback bulk entry with reasons | FR-CHECKIN-013, ADR-0007 | Planned / VS-4 |
| T-CHECKIN-013 | Entrance and device roster management | FR-CHECKIN-014 | Planned / VS-4 |
| T-CHECKIN-015 | Participant self-check status view ("sudah check-in") | FR-CHECKIN-016 | Planned / VS-4 |
| T-CHECKIN-017 | Manual verification path for suspected misuse | FR-CHECKIN-013, NFR-ETH-003 | Planned / VS-4 |
| T-ATTEND-001 | Attendance record model with database constraints | FR-ATTEND-001, ADR-0025 | Planned / VS-5 |
| T-ATTEND-002 | Attendance summary with honest definitions | FR-ATTEND-002 | Planned / VS-5 |
| T-ATTEND-003 | Window close and no-show derivation | FR-ATTEND-003, FR-ATTEND-004 | Planned / VS-5 |
| T-ATTEND-004 | Corrections with mandatory reasons and audit | FR-ATTEND-007 | Planned / VS-5 |
| T-ATTEND-005 | Attendance export (field selection, audit) | FR-ATTEND-008 | Planned / VS-5 |
| T-ATTEND-007 | Reconciliation job (drift detection must be zero) | NFR-REL-003 | Planned / VS-5 |
| T-ATTEND-008 | Attendance-quality signals (manual share, corrections) | FR-ANALYTICS-002 | Planned / VS-6 |

## B.6 Audio recording, upload and processing (VS-7, VS-8)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-AUDIO-001 | Recorder UI, session model and elapsed/level display | FR-AUDIO-001, FR-AUDIO-003 | Planned / VS-7 |
| T-AUDIO-003 | Chunk client: 10 s timeslice, IndexedDB queue, ordered upload | FR-AUDIO-004, ADR-0008 | Planned / VS-7 |
| T-AUDIO-005 | Session recovery after refresh/tab loss | FR-AUDIO-008, ADR-0022 | Planned / VS-7 |
| T-AUDIO-006 | Bounded client memory for 2-hour sessions | FR-AUDIO-006, NFR-MOB-002 | Planned / VS-7 |
| T-AUDIO-007 | Pause/resume and device-change handling | FR-AUDIO-009 | Planned / VS-7 |
| T-AUDIO-009 | Server-side assembly into a seekable master | FR-AUDIO-010, ADR-0009 | Planned / VS-8 |
| T-AUDIO-010 | Loudness normalisation and 16 kHz derivative | FR-AUDIO-012, ADR-0009 | Planned / VS-8 |
| T-AUDIO-011 | Asset lifecycle, playback with range requests | FR-AUDIO-014, FR-AUDIO-015 | Planned / VS-8 |
| T-AUDIO-012 | Recording quality warnings (silence, clipping, gaps) | FR-AUDIO-017 | Planned / VS-8 |
| T-AUDIO-013 | Upload backlog UI and retry affordances | FR-AUDIO-007, NFR-MOB-003 | Planned / VS-8 |
| T-AUDIO-014 | Storage key layout and lifecycle policies | NFR-OPS-005, ADR-0013 | Planned / VS-8 |
| T-AUDIO-015 | Audio operator dashboard (sessions across events) | FR-ANALYTICS-001 | Planned / VS-8 |
| T-AUDIO-016 | Recorder accessibility and non-microphone fallback notice | NFR-A11Y-005 | Planned / VS-7 |

## B.7 Transcription and published content (VS-9, VS-10)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-TRANSCRIPT-001 | Provider port and transcription job orchestration | FR-TRANSCRIPT-001, FR-TRANSCRIPT-002 | Planned / VS-9 |
| T-TRANSCRIPT-002 | Job states, retries and failure taxonomy | FR-TRANSCRIPT-004, NFR-REL-004 | Planned / VS-9 |
| T-TRANSCRIPT-003 | Segmentation, timestamps and speaker turns | FR-TRANSCRIPT-005 | Planned / VS-9 |
| T-TRANSCRIPT-004 | Language/code-switch handling and `lang` tagging | FR-TRANSCRIPT-009, NFR-I18N-001 | Planned / VS-9 |
| T-TRANSCRIPT-006 | Review editor (listen + edit, timestamp navigation) | FR-TRANSCRIPT-007 | Planned / VS-10 |
| T-TRANSCRIPT-007 | Certainty and citation markers in the editor | FR-TRANSCRIPT-008 | Planned / VS-10 |
| T-TRANSCRIPT-008 | Append-only revisions with per-segment diff | FR-TRANSCRIPT-011, ADR-0023 | Planned / VS-10 |
| T-TRANSCRIPT-009 | Review assignment, queue and SLA visibility | FR-TRANSCRIPT-012 | Planned / VS-10 |
| T-TRANSCRIPT-010 | Approval action with separation of duties | FR-TRANSCRIPT-013, ADR-0012 | Planned / VS-10 |
| T-TRANSCRIPT-011 | Publication and provenance display | FR-TRANSCRIPT-014, FR-CONTENT-004 | Planned / VS-10 |
| T-TRANSCRIPT-013 | Transcript search indexing (published only) | FR-CONTENT-005, FR-CONTENT-006 | Planned / VS-10 |
| T-TRANSCRIPT-015 | Chapter/topic marking from the transcript | FR-CONTENT-002, FR-TRANSCRIPT-015 | Planned / VS-10 |
| T-TRANSCRIPT-016 | Reviewer permissions and conflict-of-interest rules | FR-TRANSCRIPT-016, NFR-SEC-002 | Planned / VS-10 |
| T-CONTENT-001 | Kajian archive browse (by mosque, speaker, topic, date) | FR-CONTENT-001, FR-CONTENT-002 | Planned / VS-10 |
| T-CONTENT-002 | Event media page (audio + transcript + provenance) | FR-CONTENT-004 | Planned / VS-10 |
| T-CONTENT-004 | Topic taxonomy and assignment | FR-CONTENT-002 | Planned / VS-10 |
| T-CONTENT-005 | Citation display for Qur'an/hadith references | FR-CONTENT-005, NFR-ETH-002 | Planned / VS-10 |
| T-CONTENT-006 | Archive search excludes anything unpublished | FR-CONTENT-006, NFR-PRIV-004 | Planned / VS-10 |
| T-CONTENT-007 | Public page accessibility (readers, print, large text) | FR-CONTENT-005, NFR-A11Y-004 | Planned / VS-10 |

## B.8 Feedback and notifications (VS-11, VS-12)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-FEEDBACK-001 | Feedback submission form (identified and anonymous) | FR-FEEDBACK-001, FR-FEEDBACK-002 | Planned / VS-11 |
| T-FEEDBACK-002 | Feedback window and one-request-per-person rule | FR-FEEDBACK-005, FR-NOTIF-007 | Planned / VS-11 |
| T-FEEDBACK-003 | Aggregates with denominators and suppression | FR-FEEDBACK-007 | Planned / VS-11 |
| T-FEEDBACK-005 | Follow-up flags and organizer actions | FR-FEEDBACK-008 | Planned / VS-11 |
| T-FEEDBACK-007 | Dimensions and required overall score (no speaker-quality dimension) | FR-FEEDBACK-002, NFR-ETH-001 | Planned / VS-11 |
| T-FEEDBACK-008 | Retention: raw to aggregate conversion job | NFR-PRIV-009 | Planned / VS-13 |
| T-NOTIF-001 | Outbox, intent creation and dispatcher | FR-NOTIF-001, ADR-0010 | Planned / VS-12 |
| T-NOTIF-002 | Template catalogue and rendering (no token in uncontrolled channels) | FR-NOTIF-002, FR-NOTIF-003 | Planned / VS-12 |
| T-NOTIF-003 | Channel port, in-app and email adapters | FR-NOTIF-005 | Planned / VS-12 |
| T-NOTIF-005 | Preferences, quiet hours and essential classes | FR-NOTIF-006, FR-NOTIF-008 | Planned / VS-12 |
| T-NOTIF-006 | Dedupe keys and idempotent dispatch | FR-NOTIF-009, ADR-0015 | Planned / VS-12 |
| T-NOTIF-007 | In-app notification centre | FR-NOTIF-003 | Planned / VS-12 |
| T-NOTIF-008 | Dead-letter visibility, replay with relevance check | NFR-REL-005 | Planned / VS-12 |
| T-NOTIF-009 | Reminder scheduling relative to event time (venue timezone) | FR-NOTIF-002, ADR-0018 | Planned / VS-12 |

## B.9 Dashboards, moderation, audit, hardening (VS-6, VS-13…VS-15)

| ID | Task | Requirements | Slice |
|---|---|---|---|
| T-ANALYTICS-001 | Organizer dashboard cards (definitions on tap) | FR-ANALYTICS-001 | Planned / VS-6 |
| T-ANALYTICS-002 | Needs-action list and alert acknowledgement | FR-ANALYTICS-002 | Planned / VS-6 |
| T-ANALYTICS-003 | Aggregate-only guardrails (no participant-level analytics) | FR-ANALYTICS-003, NFR-PRIV-004 | Planned / VS-6 |
| T-ANALYTICS-004 | Usage and cost estimate with stated assumptions | FR-ANALYTICS-004 | Planned / VS-15 |
| T-MOD-001 | Moderation queue for published content | FR-MOD-001 | Planned / VS-10 |
| T-MOD-002 | Report/flag handling with reasons | FR-MOD-002 | Planned / VS-10 |
| T-MOD-003 | Platform-only moderation decisions (SoD) | FR-MOD-003, NFR-SEC-006 | Planned / VS-10 |
| T-MOD-004 | Safety scanning of uploaded materials and links | FR-MOD-004 | Planned / VS-13 |
| T-AUDIT-001 | Audit read UI and filtered export | FR-AUDIT-003, FR-AUDIT-004 | Planned / VS-13 |
| T-AUDIT-002 | Audit integrity verification job and reporting | FR-AUDIT-005 | Planned / VS-13 |
| T-SEC-003 | Row-level security enablement and policy tests | NFR-SEC-003 | Planned / VS-13 |
| T-SEC-006 | CSP nonce, security headers and frame protections | NFR-SEC-008 | Planned / VS-13 |
| T-SEC-008 | Secret scanning in CI and logs | NFR-SEC-011 | Planned / VS-13 |
| T-SEC-009 | Passkeys/2FA for administrative roles | NFR-SEC-007 | Planned / VS-13 |
| T-SEC-010 | Durable rate limiting across replicas | NFR-SEC-010 | Planned / VS-13 |
| T-SEC-011 | Incident response tooling (containment actions, evidence export) | NFR-SEC-012 | Planned / VS-14 |
| T-PRIV-001 | Data subject access and erasure workflows | NFR-PRIV-004 | Planned / VS-13 |
| T-PRIV-002 | Privacy notice and consent text surfaced in the product | NFR-PRIV-002 | Planned / VS-13 |
| T-PRIV-003 | Retention job enablement with dry-run and evidence | NFR-PRIV-009 | Planned / VS-13 |

---

## 3. Task status summary (Phase 0)

Every task in this file is **specified only**. Nothing here is implemented, and nothing may be until the
Phase 0 freeze is lifted (`ROADMAP.md` VS-0 exit criteria).

| Section | Part A — full sixteen-field blocks | Part B — planned inventory rows |
|---|---|---|
| A.1 / B.1 Foundation, architecture, testing | 4 | 7 |
| A.1 / B.1 Security, observability, operations | 12 | 6 |
| A.2 / B.4 Registration | 2 | 10 |
| A.2 / B.5 Check-in and attendance | 8 | 18 |
| A.2 / B.6 Audio | 3 | 13 |
| A.3 / B.7 Transcription and content | 4 | 19 |
| A.3 / B.8 Feedback and notifications | 3 | 14 |
| B.2 / B.3 Identity, organizations, mosques, speakers, programs, events | 0 | 26 |
| B.9 Dashboards, moderation, audit, hardening | 0 | 19 |
| **Total** | **35** | **132** |

Part A tasks are the ones other documents already point at by ID (see the "Task ownership" lines in the
skeleton files, `THREAT_MODEL.md` mitigations, and the ADRs). Part B rows are the remaining inventory;
each one must be expanded into a full sixteen-field block **before** its slice begins, using
`T-CHECKIN-014` above as the template.

Counts by module, for cross-checking against other documents:

| Module | Tasks (Part A + Part B) | Module | Tasks (Part A + Part B) |
|---|---|---|---|
| CHECKIN | 18 | AUDIO | 16 |
| REG | 12 | TRANSCRIPT | 16 |
| ATTEND | 8 | CONTENT | 7 |
| EVENT | 9 | FEEDBACK | 8 |
| PROGRAM | 5 | NOTIF | 9 |
| MOSQUE | 5 | ANALYTICS | 4 |
| SPEAKER | 4 | MOD | 4 |
| ORG | 3 | AUDIT | 2 |
| SEC | 11 | PRIV | 3 |
| OBS | 3 | PERF | 3 |
| OPS | 6 | ARCH | 6 |
| TEST | 3 | DOCS | 2 |

## 4. Change rules for this file

1. Task IDs are permanent. Never renumber, never reuse a retired ID.
2. Adding a task requires: a requirement ID, a slice, and an ADR reference if it changes a decision.
3. Splitting a task keeps the original ID for the primary part and allocates a new ID for the rest.
4. When a task is implemented, record the delivering PR/commit and the date in the task block (a single
   `Delivered:` line) — the block itself is never deleted, because later readers need the reasoning.
5. If a task's requirements change, update the requirement in `PRD.md` first (with a version note), then
   the task. Never the reverse.
6. Rules that other documents enforce by name (`AGENTS.md` §9) must keep their IDs: remove one and the
   documentation becomes unenforceable.

## 5. First implementation task

When the Phase 0 freeze is lifted, the first task to execute is **VS-1 · T-ORG-001** (identity
integration with a durable rate limiter) followed immediately by **T-SEC-001** (tenant isolation) — see
`docs/architecture/FINAL-REVIEW.md` and the VS-0 exit criteria in `ROADMAP.md`. Everything else depends
on those two being correct, because every later slice adds rows that must never be visible across
organizations.
