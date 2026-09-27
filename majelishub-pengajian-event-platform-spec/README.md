# MajelisHub

**Coordination platform for Pengajian / Kajian / Islamic learning events.**

MajelisHub manages the full lifecycle of a religious learning event: from discovering a
kajian, registering, checking in at the mosque entrance, recording attendance, capturing
and publishing audio, producing a human-reviewed transcript, through to participant
feedback and follow-up.

It is designed for **many mosques, communities and organizers** — not one mosque.

---

## ⚠️ Repository status: VS-1 IN PROGRESS (Phase 0 specification + skeleton, ten tasks delivered)

**The Phase 0 freeze was lifted on 2026-09-27.** The documentation set below is still the authority,
the skeleton is still the shape of the product, and exactly ten tasks are implemented
(`T-ARCH-002`, `T-ARCH-003`, `T-DOCS-001`, `T-DOCS-003`, `T-OBS-002`, `T-ORG-001`, `T-SEC-001`,
`T-SEC-002`, `T-SEC-004`, `T-SEC-007`).

What is here (updated 2026-09-27):

| Area | Contents |
|---|---|
| Requirements | `PRD.md` — 229 stable IDs (156 functional across 16 families, 73 non-functional) |
| Documents | 36 root documents + 57 under `docs/` (research, product, design, media, transcription, security, architecture, attendance, testing, operations, 27 ADRs, traceability) |
| Contracts and skeletons | `src/`: domain transitions for 10 state machines, 14 shared contracts, feature service stubs, server ports and repositories, 49 page shells + 26 API route shells (+ not-found/error shells) |
| **Implemented (VS-1)** | `T-OBS-002`/`T-SEC-004` — one logging interface with a privacy allow-list, the OBSERVABILITY.md §4 metric catalogue as typed constants, and a token/code ban list enforced twice (runtime drop + `majelishub/no-token-logging`) from one data file (`src/shared/observability/**`, `ops/eslint/no-token-logging.mjs`) · `T-SEC-007` — append-only, tamper-evident audit: hash-chained `audit_events` with SELECT/INSERT-only grants, an anti-mutation trigger, a linear-time verifier and a per-request buffer wired into `requirePermission` (`src/server/audit/**`, `drizzle/0002_audit_events.sql`, `ops/db-migrate.mjs`) · `T-ORG-001` — Better Auth identity with sessions in our PostgreSQL and a **durable, Postgres-backed rate limiter**, plus the sign-up → cookie → `getSession()` round trip (`src/server/auth/*`, `src/server/http/rate-limit.ts`, `src/server/http/auth-response.ts`, `src/server/config.ts`, `src/app/api/auth/[...all]/route.ts`) · `T-SEC-001` — tenant isolation: `TenantScope` guards, `deriveScope`, scope-first repositories, per-transaction RLS session variables and policies (`src/shared/contracts/scope.ts`, `src/server/db/**`, `drizzle/0001_row_level_security.sql`) · `T-SEC-002` — the authorization matrix as data and the single `requirePermission` choke point, with a public-route allow-list (`src/server/auth/permissions.ts`, `src/server/auth/public-routes.ts`) · `T-DOCS-001` — the documentation consistency gate (`ops/docs-lint.mjs`) · `T-ARCH-002`/`T-ARCH-003` — the module-boundary and no-fake-implementation lint rules (`ops/eslint/**`, `eslint.config.mjs`) · app shell so the project builds (`src/app/layout.tsx`, `next.config.ts`) |
| Schema + migrations | `src/server/db/schema/**` (identity, tenancy, audit) and four reviewed SQL migrations in `drizzle/` — applied by `npm run db:migrate` (`ops/db-migrate.mjs`: filename order, `schema_migrations` bookkeeping, refuses a changed checksum), never at boot (ADR-0020) |
| Tests | **125 passing** (10 integration suites on a real PostgreSQL 18 + 10 unit suites) and 281 remaining placeholders in 77 files — the acceptance checklists for the tasks not yet built |
| Operations | `ops/`: compose stack, two Dockerfiles, smoke suite, the working docs lint gate (`ops/docs-lint.mjs`, `T-DOCS-001`), the project's own ESLint rules (`ops/eslint/**`), the VS-0 exit gate (`ops/verify-vs0.mjs`, `T-DOCS-003`), backup/restore, load harness notes |
| Task plan | `TASKS.md` — 37 fully specified tasks + 133 task rows for later slices |

Every function that is not part of those ten tasks still throws `Error("Not implemented: <TASK-ID>")`,
where the task ID exists in `TASKS.md` — the `majelishub/no-fake-implementation` lint rule checks all 53 of
them on every run. Still prohibited everywhere: fake implementations, production UI,
QR generation/scanning, audio capture, transcription calls, notification delivery, payments.

**Gates that run on every change:** `npm run typecheck` · `npm run lint` (including the project's own
`majelishub/*` rules) · `npm run test` · `npm run docs:lint` (`T-DOCS-001`) · `npm run verify:vs0`
(`T-DOCS-003`, which re-checks the seven VS-0 exit criteria read-only — 6 pass / 1 warn / 0 fail, with
criterion 7 attested by a human rather than faked as a PASS). The findings that verification raised, and
how each was resolved, are recorded in `ROADMAP.md` §Phase 0 state.

```bash
# These commands run (verified 2026-09-27, Node.js v24.21.0 / npm 11.20.0):
npm run typecheck        # tsc --noEmit → exit 0
npm run lint             # eslint 9 flat config + the project's own rules → exit 0
npm run test:unit        # 8 real suites + placeholder suites
npm run test:integration # 8 real suites against a real PostgreSQL (PGlite by default)
npm run docs:lint        # ops/docs-lint.mjs → 0 findings
npm run db:generate      # drizzle-kit generate → reviewed SQL in drizzle/
npm run db:migrate       # ops/db-migrate.mjs → applies drizzle/*.sql in order (needs DATABASE_URL)
npm run db:migrate:status # what is applied and what is pending
npm run build            # next build → compiled, 49 pages + 26 API routes (all dynamic)
```

Next step: `TASKS.md` §5 — `T-ORG-002` (organizations + memberships), then `T-MOSQUE-001` (mosque
create/edit) and `T-ORG-003` (role switching, invitation, offboarding).

---

## The fourteen questions this product answers

| # | Question | Where answered |
|---|---|---|
| 1 | Kajian apa yang tersedia? | `docs/product/EVENTS.md`, `/kajian` |
| 2 | Siapa ustadz/pematerinya? | `docs/product/SPEAKERS.md`, `/ustadz/[slug]` |
| 3 | Di masjid mana? | `docs/product/MOSQUES.md`, `/masjid/[slug]` |
| 4 | Kapan berlangsung? | `docs/product/EVENTS.md` §Scheduling |
| 5 | Bagaimana saya mendaftar? | `REGISTRATION.md` |
| 6 | Apakah saya sudah check-in? | `CHECKIN.md` |
| 7 | Berapa jamaah hadir? | `ATTENDANCE.md` |
| 8 | Apakah rekaman tersedia? | `AUDIO.md` |
| 9 | Apakah transkrip tersedia? | `TRANSCRIPTION.md` |
| 10 | Apa pokok pembahasannya? | `CONTENT.md` |
| 11 | Bagaimana peserta memberi feedback? | `FEEDBACK.md` |
| 12 | Apa tindak lanjut dari kajian ini? | `NOTIFICATIONS.md`, `ROADMAP.md` |
| 13 | Apakah kontennya dapat dipercaya? | `docs/product/CONTENT-INTEGRITY.md` |
| 14 | Apakah data saya aman? | `PRIVACY.md`, `RETENTION.md`, `SECURITY.md` |

---

## Documentation authority hierarchy

When documents disagree, the higher document wins. Skeleton code must never contradict
documentation; if it does, the code is wrong or the document needs an ADR.

```
PRD.md                     ← why the product exists, what must be true (FR-/NFR- IDs)
   ↓
docs/product/*.md          ← detailed specifications per capability
   ↓
DESIGN.md + docs/design/*  ← UX principles, flows, design system
   ↓
docs/adr/*                 ← the decisions that constrain everything below
   ↓
ARCHITECTURE.md            ← module boundaries, dependency rules, topology
   ↓
DOMAIN.md / DATA_MODEL.md / API.md / EVENTS.md / STATE_MACHINE.md
   ↓
TASKS.md                   ← executable, testable work units
   ↓
src/**, tests/**           ← skeleton contracts + NotImplemented placeholders
```

---

## Repository map

```
README.md  PRD.md  DESIGN.md  ARCHITECTURE.md  ADR.md  AGENTS.md  SKILLS.md
DOMAIN.md  DATA_MODEL.md  API.md  EVENTS.md  STATE_MACHINE.md
REGISTRATION.md  CHECKIN.md  ATTENDANCE.md
AUDIO.md  TRANSCRIPTION.md  CONTENT.md  FEEDBACK.md  NOTIFICATIONS.md
SECURITY.md  THREAT_MODEL.md  PRIVACY.md  RETENTION.md
ACCESSIBILITY.md  PERFORMANCE.md  OBSERVABILITY.md
TESTING.md  QA.md  ROADMAP.md  TASKS.md
DEPLOYMENT.md  OPERATIONS.md  RUNBOOK.md  GLOSSARY.md  CONTRIBUTING.md

docs/
├── adr/            25+ individual decisions + index
├── architecture/   concurrency model, failure model, final architecture review
├── product/        MOSQUES, SPEAKERS, PROGRAMS, EVENTS, CONTENT-INTEGRITY
├── design/         DESIGN-SYSTEM.md, PAGES.md, UX-FLOWS.md
├── attendance/     offline check-in evaluation (ADR-0007)
├── media/          audio pipeline, chunk protocol, quality, storage
├── transcription/  pipeline, code-switching handling, review workflow
├── security/       AUTHZ-MATRIX, QR-SECURITY, INCIDENT-RESPONSE
├── testing/        strategy, concurrency tests, test data
├── operations/     SLOs, backup/restore
├── research/       STACK-2026.md
└── TRACEABILITY.md every requirement → spec → ADR → module → task → skeleton → test

src/                app/, features/*, domain/*, server/*, shared/*
tests/              unit/, integration/, browser/, e2e/
ops/                compose stack, Dockerfiles, smoke suite, docs lint, backup/restore, load harness
```

---

## Core product principle

> **Information first, low friction, calm.** A mosque entrance must work at speed, on a
> cheap phone, on a bad network, for a 70-year-old participant who has never used the app
> before — and it must never publish a machine-generated religious text as if it were
> authoritative.

Three primary experiences, detailed in `DESIGN.md`:

1. **Participant** — discover → register → receive QR → arrive → scan → attend → listen/read → feedback
2. **Organizer** — create → publish → registration → check-in → attendance → record → transcribe → review → publish
3. **Ustadz / Speaker** — profile, upcoming and past kajian, recordings and reviewed transcripts

Deliberately **absent**: speaker ranking, popularity scores, authority scores, streaks,
feeds, follower counts, algorithmic amplification.

---

## How to work in this repository

- **Coding agents / contributors:** start with `AGENTS.md` (workflow, guardrails) and
  `SKILLS.md` (available capabilities and when to load them).
- **Reviewers:** `QA.md` for manual scenarios, `docs/architecture/FINAL-REVIEW.md` for the
  standing architectural challenges.
- **Operators:** `DEPLOYMENT.md`, `OPERATIONS.md`, `RUNBOOK.md`.

```bash
# Phase 0: there is nothing to run yet. These are the planned commands (pinned in package.json).
npm run typecheck   # tsc --noEmit  (skeleton types must stay valid)
npm run lint        # eslint 9 flat config
npm test            # vitest (all suites are describe.todo → 0 assertions executed)
npm run build       # next build (routes render empty shells)
```

**Nothing in this repository performs network, database, media or AI operations.**
If a command in this README starts doing real work, the phase boundary has been violated.

---

## Licence, consent and ethics

- Audio recordings contain **voices** and may contain Qur'anic recitation and hadith.
  Recording and publication policy is modelled per event (`docs/product/CONTENT-INTEGRITY.md`,
  `PRIVACY.md` §Consent) — *attending a kajian is not consent to arbitrary publication*.
- Automated transcription is treated as a **drafting aid**, never as an authority on
  religious text. Machine output and human-reviewed text are always distinguishable in the
  data model, the API and the UI.
- Personal data handling targets Indonesian **UU PDP** (Law 27/2022) requirements:
  data minimisation, explicit purposes, retention limits, 72-hour breach notification.
