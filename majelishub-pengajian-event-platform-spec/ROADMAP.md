# ROADMAP

Delivery is organised as **vertical slices**: each slice ends with something a mosque can actually
use, plus tests and operations. No slice is "90% done".

**Current status: VS-0 (Phase 0) — specification and skeleton only. No slice has been executed.**
The VS-0 deliverables are in place (36 root documents, 27 ADRs, 57 files under `docs/`, 165 skeleton
files under `src/`, 98 placeholder test files, 9 ops skeleton files, a 167-task plan). See the Phase 0
state table under VS-0 below.

---

## Slice overview

| Slice | Name | User-visible outcome | Depends on | Requirements (primary) |
|---|---|---|---|---|
| VS-0 | Foundation | The repository is a truthful specification with contracts and skeletons; nothing runs | — | NFR-OPS-001, TESTING.md |
| VS-1 | Mosques + Speakers | A mosque and a ustadz exist and are publicly viewable | VS-0 | FR-MOSQUE-*, FR-SPEAKER-* |
| VS-2 | Kajian Events | An organizer can create, publish and list a kajian | VS-1 | FR-EVENT-*, FR-PROGRAM-* |
| VS-3 | Registration | A participant registers and receives a QR/short code | VS-2 | FR-REG-* |
| VS-4 | QR Check-In | A volunteer scans people in at the entrance | VS-3 | FR-CHECKIN-001…014 |
| VS-5 | Attendance | The organizer sees an honest attendance report and can correct it | VS-4 | FR-ATTEND-* |
| VS-6 | Organizer Dashboard | Operations are visible in one place, with alerts | VS-5 | FR-ANALYTICS-001/002 |
| VS-7 | Audio Recording | A 2-hour recording is captured with live health | VS-5 | FR-AUDIO-001…008, 013…015 |
| VS-8 | Reliable Audio Upload | Chunked upload survives outages; assembly + normalization produce a playable asset | VS-7 | FR-AUDIO-005…012, 016/017 |
| VS-9 | Transcription | Audio becomes a machine draft, asynchronously | VS-8 | FR-TRANSCRIPT-001…005 |
| VS-10 | Transcript Review + Publication | A human-reviewed transcript is published with provenance | VS-9 | FR-TRANSCRIPT-006…016, FR-CONTENT-* |
| VS-11 | Feedback | Participants tell organizers what to fix | VS-5, VS-10 | FR-FEEDBACK-* |
| VS-12 | Notifications | Reminders, confirmations and availability notices flow | VS-3, VS-10 | FR-NOTIF-* |
| VS-13 | Security + Privacy Hardening | Isolation, RLS, rate limits, threat mitigations verified | VS-12 | NFR-SEC-*, NFR-PRIV-* |
| VS-14 | Observability | SLOs, dashboards, alerts, operator surfaces | VS-13 | NFR-OBS-* |
| VS-15 | Production | A deployment can be operated by one volunteer | VS-14 | NFR-OPS-*, DEPLOYMENT.md |

Dependency shape (why this order): the **event/attendance lifecycle must be stable before media**.
Recording and transcription multiply the number of things that can be wrong; if attendance is still
changing, debugging a 2-hour upload problem becomes archaeology.

---

## VS-0 · Foundation (current)

**Deliverable:** this documentation set, the ADR set, and a skeleton repository whose contracts are
consistent with the docs.

Contents: research (`docs/research/STACK-2026.md`), PRD, design, architecture, security/privacy,
testing/QA, roadmap, tasks, skeleton types/ports/routes/tests.

Exit criteria (all must hold):

- [x] Every P0/P1 requirement appears in `docs/TRACEABILITY.md`.
- [x] `npm run typecheck` passes on the skeleton (types are valid; nothing is implemented).
- [x] Every unimplemented function throws `Not implemented: <TASK-ID>`; no fake returns exist.
- [x] All test files contain only `describe.todo`/`test.todo` (Vitest) or `test.fixme` (Playwright).
- [x] `docs/architecture/FINAL-REVIEW.md` answers every challenge question with a concrete mechanism.
- [x] No provider SDK, ORM, auth library or test runner is declared as a product dependency
      (`package.json` reflects SELECTED-only Phase 0 dependencies; see the caveat below).
- [x] A reviewer who has never seen the project can explain the check-in path and the transcript gate
      after reading `README.md` + `ARCHITECTURE.md` + two ADRs.

All seven are verified by `npm run verify:vs0` (`ops/verify-vs0.mjs`, task `T-DOCS-003`), which is
read-only and exits non-zero on any failure. Criterion 7 is reported as `ATTEST`: a script cannot prove
comprehension, so the gate prints the reading list for a human to confirm.

### Phase 0 state (verified 2026-09-27)

| Criterion | How it was verified | Result |
|---|---|---|
| Every requirement appears in `docs/TRACEABILITY.md` | Gate criterion 1: every P0/P1 ID in `PRD.md` resolved against `docs/TRACEABILITY.md` | **Met** — 211 P0/P1 IDs traced, of 229 total (156 FR / 73 NFR across 26 families) |
| `npm run typecheck` passes | `tsc --noEmit` over `src/**` + `tests/**` | **Met** — 0 errors (see finding F1 below) |
| Every unimplemented function throws `Not implemented: <TASK-ID>`; no fake returns | Gate criterion 3: 161 source files scanned for stub task IDs and constant-success returns | **Met** — 57 distinct task IDs, all defined in `TASKS.md`; 0 constant-success returns |
| Test files contain only placeholders | Gate criterion 4: zero `expect(` anywhere under `tests/` | **Met** — 98 files, 338 `test.todo` + 80 `describe.todo` + 42 `test.fixme`, 0 assertions |
| `docs/architecture/FINAL-REVIEW.md` answers every challenge question | Gate criterion 5: every `### 2.x` body ≥ 200 chars and citing a document/ADR/task/path | **Met** — 10 challenges (see finding F2) |
| No provider SDK, ORM, auth library or runner declared as a product dependency | Gate criterion 6: every declared dependency classified in `docs/research/STACK-2026.md` | **Met with a caveat** (see finding F3) |
| A new reviewer can explain the check-in path and the transcript gate | Reading list present and non-empty | **Attested** — `README.md` + `ARCHITECTURE.md` + ADR-0006/0007/0026 and ADR-0012/0023 |

#### Findings raised by the verification, and what was done about them

| # | Finding | Resolution |
|---|---|---|
| F1 | 98 type errors, all in `tests/**`: the skeleton imports `vitest` and `@playwright/test` with no type declarations available. `src/**` was already clean. | Declared `typescript`, `@types/node`, `vitest` and `@playwright/test` as devDependencies (toolchain only). |
| F2a | Nine Playwright files used `test.todo(title)` — **not a Playwright API** — and 33 used `test.fixme(title)`, which needs a body. The file headers documented the invalid form. | All 42 placeholders are now `test.fixme("<behaviour>", () => { /* Not implemented: T-XXX */ })`; headers corrected. `playwright test --list` reports 42 tests in 9 files. |
| F2b | `docs/architecture/FINAL-REVIEW.md` §2.7 answered "is it simpler?" without citing anything. | Rewritten as a table naming the decision that records each cut (ADR-0005/0006, ADR-0007, ADR-0010/0015). |
| F3 | `typescript`, `@types/node` and `@playwright/test` were not named in `docs/research/STACK-2026.md`, so they were unclassified dependencies. | Added package names and Phase 0 notes to `STACK-2026.md` §2 and §16. |

**Caveat on criterion 6.** Verifying criterion 2 required installing the toolchain, and verifying the
skeleton's test imports required both runners' type declarations. The criterion's parenthetical intent —
"`package.json` reflects SELECTED-only Phase 0 dependencies" — is preserved: at the moment of
verification only four devDependencies were declared, all toolchain, all classified in
`docs/research/STACK-2026.md`, and **no** framework, ORM, auth library, driver or provider SDK.

**The freeze is lifted as of 2026-09-27 for VS-1 · `T-ORG-001` only.** Criterion 6 therefore no longer
holds once `T-ORG-001` declares its product dependencies (`better-auth`, and the Next.js/Drizzle
tooling they need); that is the expected consequence of starting the slice, not a regression. Every
other VS-0 criterion is expected to keep passing, and `npm run verify:vs0` is the check that proves it.
No other slice is started: `T-SEC-001` and the rest of VS-1 remain unstarted.

## VS-1 · Mosques + Speakers

Public pages, registries, facilities/accessibility data, speaker profiles and verification, search by
name/area. **Must ship:** real form validation, tenancy scoping, RLS-ready schema, accessibility pass.

### VS-1 status (2026-09-27)

**Started.** `T-ORG-001` is delivered as the identity *platform*: the identity schema and its reviewed
migration, the pooled database client, a durable (Postgres) auth rate limiter, the session service and
the `/api/auth/*` route. Four deferrals are recorded in its task block rather than glossed over — the
sign-in and session-management UI (`T-ORG-004`), organization membership and roles (`T-ORG-002`), the
audit record for a revocation (`T-SEC-007`) and the scheduled retention sweep (`T-PRIV-003`).

**`T-ORG-002` is the next task, ahead of `T-SEC-001`.** A `TenantScope` is built from membership, so
tenant isolation cannot be implemented — let alone tested — until an organization and its members
exist. The original ordering (`T-ORG-001` → `T-SEC-001`) assumed membership came with identity; it does
not, so the order is corrected here.

Nothing in VS-1 is user-visible yet: no page renders identity state, and there is no deployment to
exercise sign-in against.

## VS-2 · Kajian Events

Programs and recurrence, event creation with policies, publish checklist, public discovery list and
detail page, reschedule/cancel with notifications queued (delivery arrives in VS-12; intents are
recorded from now on so nothing is lost).

## VS-3 · Registration

Capacity, waitlist, invitation mode, minimal-field form, token issuance (opaque, hashed), result page,
offline-capable code page, cancellation. **Must ship:** concurrency test C1, idempotency, isolation
tests for the new endpoints.

## VS-4 · QR Check-In

Scanner (two tiers + manual), device binding, validation with the full result vocabulary, walk-in
registration, duplicate convergence, operator feedback UI. **Must ship:** C2 test, QA-01 drill,
performance budget P11–P16 measured.

## VS-5 · Attendance

Summary with honest definitions, window closing, `NO_SHOW` derivation, corrections with reasons,
export with field selection and retention, reconciliation jobs. **Must ship:** C4/C5 tests, export
audit.

## VS-6 · Organizer Dashboard

Cards and alerts (deduplicated), needs-action list, no vanity metrics. **Must ship:** alert lifecycle
tests, accessibility pass.

## VS-7 · Audio Recording

Recorder UI, capture config, level meter, health warnings, pause/resume, IndexedDB queue, recovery
after refresh. **Must ship:** the client memory bound test; QA-02 partial drill.

## VS-8 · Reliable Audio Upload

Chunk endpoints with idempotency, retry/backoff, server state reconciliation, assembly, ffmpeg
remux/normalise/derive, asset lifecycle, playback with range requests. **Must ship:** C7/C8 tests,
QA-02 full drill, P24–P31 measured.

## VS-9 · Transcription

Provider port, self-hosted default adapter, job orchestration, segmentation, failure taxonomy,
provider contract tests with recorded fixtures. **Must ship:** adapter contract tests, malformed-output
handling, queue-age metrics.

## VS-10 · Transcript Review + Publication

Review editor, certainty markers, flags, revisions with optimistic locking, approval, publication gate,
provenance UI, search indexing, chapters, moderation of published content.

**Must ship:** the publication-gate test suite (API + DB constraint), C6/C9 tests, QA-05 with a real
reviewer, and an explicit demonstration that no machine text can become public unreviewed.

## VS-11 · Feedback

Submission (anonymous/identified), visibility rules, aggregates with small-sample suppression,
reporting of comments, follow-up flags. **Must ship:** anonymity constraints, T-15 test, no public
ratings anywhere.

## VS-12 · Notifications

Outbox dispatch, email channel, in-app list, preferences, dedupe, quiet hours, dead-letter visibility,
QA-06 provider drill. **Must ship:** C10 test, "no token over uncontrolled channels" test.

## VS-13 · Security + Privacy Hardening

RLS enablement, rate limiting (durable), CSP tightening, upload abuse corpus, secret-scan gate,
retention job enablement with dry-runs, audit hash-chaining verification, every `THREAT_MODEL.md`
mitigation marked verified or explicitly accepted. **Must ship:** isolation suite green on every
route; QA-07 executed.

## VS-14 · Observability

OTel SDK wiring, dashboards, SLOs with error budgets, alert runbooks, operator pages, telemetry
content audit. **Must ship:** SLO→metric→alert mapping complete; `TELEMETRY_ATTRIBUTE_DROPPED` = 0.

## VS-15 · Production

Backup/restore rehearsed by two people, migration process, rollback drill, cost model documented,
offboarding procedure, release checklist, support runbook for a non-technical operator. **Must ship:**
a second person deploys from the docs alone.

---

## Beyond VS-15 (candidates, not commitments)

| Candidate | Gate for considering it |
|---|---|
| WhatsApp/SMS channel adapter | A deployment has a funded channel and a consent model |
| Offline check-in | The evidence trigger in `docs/attendance/OFFLINE-EVALUATION.md` |
| AudioWorklet/PCM capture path | The telemetry trigger in ADR-0008 |
| Redis/BullMQ | The throughput trigger in ADR-0010 |
| Password-protected speaker self-service analytics | Never as ranking; only per-event operational data |
| Multi-language transcripts | A real deployment with non-Indonesian speakers |
| Prayer-time provider integration | A deployment with a trusted local source |
| Native recorder for audio operators | The background-recording failure trigger in ADR-0027 |

## Maintenance obligations (from the moment VS-15 ships)

| Obligation | Cadence |
|---|---|
| Dependency and framework patch review (Next.js has had critical advisories twice in the 2026 line) | monthly, criticals ≤ 72 h |
| Backup restore rehearsal | quarterly |
| Retention dry-run review and configuration-vs-notice check | monthly / yearly |
| SLO review and alert pruning | quarterly |
| QA-01 entrance drill at a real mosque | per release touching check-in |
| QA-02 long-recording drill with a real device | per release touching recording |
| Threat model review | per new boundary or incident |
