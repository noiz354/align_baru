# ROADMAP

Delivery is organised as **vertical slices**: each slice ends with something a mosque can actually
use, plus tests and operations. No slice is "90% done".

**Current status: VS-1 in progress.** The Phase 0 freeze was lifted on 2026-09-27 after the VS-0 exit
criteria were verified; `T-ORG-001` (identity + durable rate limiting), `T-SEC-001` (tenant isolation),
`T-SEC-002` (authorization enforcement), `T-DOCS-001` (documentation gate) and `T-ARCH-002`/`T-ARCH-003`
(the module-boundary and no-fake lint rules) are delivered, and `npm run build` runs. The VS-0 deliverables remain in place (36 root documents, 27 ADRs, 57 files
under `docs/`, the skeleton under `src/`, the placeholder test suites, 9 ops skeleton files, a 167-task
plan). See the Phase 0 state table under VS-0 below.
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

Exit criteria (verified 2026-09-27):

- [x] Every P0/P1 requirement appears in `docs/TRACEABILITY.md` (229 IDs mapped).
- [x] `npm run typecheck` passes on the skeleton. Verified: `npx tsc --noEmit` exits 0. Getting there
      required installing the SELECTED toolchain and correcting 42 real defects in the Playwright
      placeholder files — `test.fixme("title")` is not a valid Playwright signature and `test.todo`
      does not exist in Playwright, so the declared-but-not-executed form is now
      `test.fixme("title", async () => {})` (`TESTING.md` §1.4).
- [x] Every unimplemented function throws `Not implemented: <TASK-ID>`; no fake returns exist.
- [x] Test files contained only placeholders at the freeze. The two delivered VS-1 tasks replaced their
      own placeholders with real tests (31 passing); every other suite is still placeholder-only.
- [x] `docs/architecture/FINAL-REVIEW.md` answers every challenge question with a concrete mechanism.
- [x] *Superseded by the freeze lift:* no dependency was installed during Phase 0. Installation of the
      SELECTED stack happened as the first act of VS-1, as `docs/research/STACK-2026.md` prescribes
      ("Installation happens when VS-1 starts"), with every added package classified there.
- [x] A reviewer who has never seen the project can explain the check-in path and the transcript gate
      after reading `README.md` + `ARCHITECTURE.md` + two ADRs.

### Phase 0 state (2026-09-26)

What exists now, in the order the exit criteria are listed above:

| Criterion | State |
|---|---|
| Every requirement appears in `docs/TRACEABILITY.md` | **Met** — all 229 PRD IDs are mapped (156 FR / 73 NFR across 26 families). |
| `npm run typecheck` passes | **Met — verified 2026-09-27.** `npx tsc --noEmit` exits 0 on TypeScript 5.9.3 with the SELECTED toolchain installed. The verification found and fixed 42 genuine skeleton defects in `tests/e2e/**` (invalid `test.fixme(title)` / non-existent `test.todo` in Playwright). `npm run lint` (ESLint 9 flat config with the TypeScript parser wired) and `npm run test:unit` / `npm run test:integration` also run. |
| Every unimplemented function throws `Not implemented: <TASK-ID>`; no fake returns | **Met by inspection** — 95 stubs under `src/` (+2 in `tests/support`), all carrying a task ID that exists in `TASKS.md` (57 distinct IDs); zero `return { success: true }`-style returns; the `T-ARCH-003` lint rule is specified to keep it that way. |
| Test files contain only placeholders | **Met** — 98 test files, 380 placeholders (338 `test.todo` + 42 `test.fixme`), zero executable assertions (`expect(` does not appear in `tests/`). |
| `docs/architecture/FINAL-REVIEW.md` answers every challenge question | **Met** — 10 challenges, 6 accepted risks, 6 falsifiers, plus the 14 product questions. |
| No provider SDK, ORM, auth library or runner installed | **Met during Phase 0; intentionally superseded on 2026-09-27** when the freeze was lifted and the SELECTED stack was installed (`docs/research/STACK-2026.md` §Installation record). No REJECTED or unclassified dependency was added. |
| A new reviewer can explain the check-in path and the transcript gate | **Met** — `README.md` (canonical 14-question list) + `ARCHITECTURE.md` + ADR-0006/0007/0026 (check-in) and ADR-0012/0023 (transcript gate). |

**The freeze was lifted on 2026-09-27.** VS-1 has begun: `T-ORG-001` (identity integration with a
durable, Postgres-backed rate limiter, including the sign-up → `getSession()` round trip), `T-SEC-001`
(tenant isolation — scope enforcement plus row-level security) and `T-SEC-002` (the authorization matrix
and its single `requirePermission` choke point) are delivered with tests against a real PostgreSQL 18,
together with the engineering gates `T-DOCS-001`, `T-ARCH-002` and `T-ARCH-003`. No participant-facing
feature exists yet; the next tasks in VS-1 order are `T-ORG-002`, `T-MOSQUE-001` and `T-ORG-003`
(`TASKS.md` §5).

## VS-1 · Mosques + Speakers (in progress)

Public pages, registries, facilities/accessibility data, speaker profiles and verification, search by
name/area. **Must ship:** real form validation, tenancy scoping, RLS-ready schema, accessibility pass.

Delivered so far (2026-09-27): the identity foundation (`T-ORG-001`), the tenancy/isolation layer
(`T-SEC-001`) and the authorization layer (`T-SEC-002`) — the three tasks every later slice depends on —
plus the gates that keep the rest honest (`T-DOCS-001`, `T-ARCH-002`, `T-ARCH-003`). Remaining in this
slice: `T-ORG-002`, `T-ORG-003`, `T-MOSQUE-001…005`, `T-SPEAKER-001…004`.

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
