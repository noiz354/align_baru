# MajelisHub

**Coordination platform for Pengajian / Kajian / Islamic learning events.**

MajelisHub manages the full lifecycle of a religious learning event: from discovering a
kajian, registering, checking in at the mosque entrance, recording attendance, capturing
and publishing audio, producing a human-reviewed transcript, through to participant
feedback and follow-up.

It is designed for **many mosques, communities and organizers** — not one mosque.

---

## ⚠️ Repository status: PHASE 0 — SPECIFICATION + SKELETON

**Nothing in this repository runs. There is no feature implementation, by design.**

What is here (2026-09-26):

| Area | Contents |
|---|---|
| Requirements | `PRD.md` — 229 stable IDs (156 functional across 16 families, 73 non-functional) |
| Documents | 36 root documents + 57 under `docs/` (research, product, design, media, transcription, security, architecture, attendance, testing, operations, 27 ADRs, traceability) |
| Contracts and skeletons | 165 files under `src/`: domain transitions for 10 state machines, 14 shared contracts, feature service stubs, server ports and repositories, 49 page shells + 25 API route shells (+ not-found/error shells) |
| Tests | 98 placeholder test files (338 `test.todo(...)` in Vitest layers, 42 `test.fixme(...)` in Playwright layers) — the acceptance checklists for future tasks |
| Operations skeleton | `ops/`: compose stack, two Dockerfiles, smoke suite, docs lint gate, backup/restore, load harness notes |
| Task plan | `TASKS.md` — 35 fully specified tasks (16 mandatory fields each) + 132 task rows for later slices |

Every unimplemented function throws `Error("Not implemented: <TASK-ID>")`, where the task ID exists in
`TASKS.md`. Prohibited in this phase: fake implementations, production UI, persistence, real
authentication, QR generation/scanning, audio capture, transcription calls, notification delivery,
payments, deployment. Route shells render `null`.

Next step (not started): `ROADMAP.md` VS-0 exit verification, then VS-1 · `T-ORG-001` + `T-SEC-001`.

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
