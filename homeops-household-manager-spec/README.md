# HomeOps

A small web app that helps one household keep a home clean, organized, supplied, safe, and easy to operate.

**Status: architecture and specification complete — implementation has not started.** The repository contains 27 root documents (~4,700 lines), 44 sub-documents under `docs/` (~4,800 lines), 16 accepted ADRs, 252 tasks across 17 vertical slices, and a skeleton of 175 files (128 under `src/`, 44 under `tests/`, 3 tooling). Every function that would contain real logic throws `Not implemented: T-XXX-NNN`; every page and component shell returns `null`; every test is a declared todo. Nothing here does real work yet, and that is intentional (see `AGENTS.md` §1). The generated `docs/TRACEABILITY.md` maps all 179 P0/P1 requirements to tasks; `docs/architecture/FINAL-REVIEW.md` is the architecture audit.

## What HomeOps is for

Everyday household coordination without a project-management tool bolted onto it:

- **Nothing overflows silently** — trash state, low supplies, and overdue work surface before they become a problem.
- **One screen answers "what needs attention?"** — a fixed dashboard order, not a configurable widget grid.
- **One-tap actions with undo** — mark trash full, "used one", complete a chore, report an issue.
- **Recurring work that survives real life** — skips, snoozes, and late ticks without duplicate or lost occurrences.
- **Alerts, not notifications everywhere** — one alert per problem, deduplicated, addressed to the right person, with quiet hours and caps.
- **Calm by default** — status in words, never numeric "cleanliness scores"; no per-member performance metrics; no surveillance.

Non-goals (PRD §3): accounting/finance, inventory ERP, IoT device control, chat, calorie/health tracking, family social feed, enterprise CMMS.

## Read this first

| If you are… | Start with |
| --- | --- |
| A new agent or contributor picking up work | `AGENTS.md` (mandatory workflow) → `TASKS.md` (the task) → the task's ADR + product doc |
| Curious what is being built and why | `PRD.md` → `DESIGN.md` → `ROADMAP.md` |
| Implementing a feature | `ARCHITECTURE.md` → `DOMAIN.md` → `API.md` → `DATA_MODEL.md` → `EVENTS.md` |
| Reviewing a decision | `ADR.md` (index) → `docs/adr/ADR-*.md` → `DECISIONS.md` |
| Ops-on-call (someday) | `RUNBOOK.md` → `OPERATIONS.md` → `DEPLOYMENT.md` |
| Auditing quality/privacy/a11y | `QA.md`, `TESTING.md`, `PRIVACY.md`, `ACCESSIBILITY.md`, `THREAT_MODEL.md` |

## Documentation map

```text
Root
  README.md            this file — orientation
  PRD.md               goals, personas, FR/NFR requirements (source of truth for traceability)
  DESIGN.md            product & UX doctrine (the "feel"), copy rules, forbidden patterns
  ARCHITECTURE.md      modular monolith, module map (§9 tree), invariants
  ADR.md + docs/adr/   16 accepted ADRs with a fixed section format
  AGENTS.md            how an agent must work in this repo (10 steps, DoD, forbidden actions)
  SKILLS.md            verified inventory of available agent skills (currently: none)
  DOMAIN.md            aggregates, entities, value objects, invariants, boundaries
  DATA_MODEL.md        conceptual schema, indexes, retention, migration policy
  API.md               operation surface: caller, authz, validation, errors, idempotency, rate limits
  EVENTS.md            in-process event catalogue + consumers
  SECURITY.md / THREAT_MODEL.md / PRIVACY.md
  PERFORMANCE.md / ACCESSIBILITY.md / OBSERVABILITY.md
  TESTING.md / QA.md
  ROADMAP.md           17 vertical slices VS-0 … VS-16
  TASKS.md             252 atomic tasks, each with requirement/ADR/module/tests links
  DEPLOYMENT.md / OPERATIONS.md / RUNBOOK.md
  CONTRIBUTING.md / DECISIONS.md / GLOSSARY.md

docs/
  adr/         16 ADR files
  architecture/ module map, final review
  design/       design system, pages, interaction patterns
  product/      per-feature product specs (chores, recurrence, trash, rooms, resources, …)
  domain/       aggregate catalogue, invariant catalogue, error catalogue
  api/          API conventions, error catalogue
  security/     authorization matrix
  testing/      test data strategy
  research/     stack validation (2026)
  operations/   monitoring, backup/restore, incident response
  TRACEABILITY.md  requirement → design → ADR → module → task → skeleton → test
```

## The technology (validated for 2026)

Node 24 · TypeScript 6 · Next.js 16 (App Router, Server Actions, Turbopack) · React 19 · Tailwind v4 · PostgreSQL 18 · Drizzle ORM + postgres.js · Zod 4 · Better Auth · Vitest 4 + Playwright · Docker Compose on one host.
Deliberately **not** present: Redis, a message broker, tRPC, a UI kit, a client state library, Kubernetes, analytics SDKs, ML/LLM features. Rationale and full classification (SELECTED / PLANNED / OPTIONAL / REJECTED) in `docs/research/STACK-2026.md`.

## Running it locally

```bash
# Not available yet — no application code exists.
# Planned (VS-0, T-PLAT-001..005):
#   nvm use            # Node 24 per .nvmrc
#   npm ci             # install the pinned toolchain
#   docker compose up -d postgres
#   npm run db:migrate
#   npm run dev        # http://localhost:3000
#   npm run verify:docs
```

`package.json` is created in T-PLAT-001; `.nvmrc`, `.env.example`, and the migration tooling in VS-0. Until then, `node scripts/verify-docs.mjs` is the only runnable command in this repository.

## How work happens here

1. Pick the next task from `TASKS.md` (status board §20).
2. Follow `AGENTS.md` §2 end to end: read the task → the requirements → the product/design docs → the ADR → the current code → implement → test → manual QA → update docs.
3. Never invent behaviour that no document describes. If a task is ambiguous, fix the document first (or open a proposed ADR) and then implement.
4. A fake implementation (`return true`, `return []`, a hard-coded "done") is worse than no implementation. Leave it throwing with the task id.
5. Update `docs/TRACEABILITY.md` and `DECISIONS.md` in the same PR.

First implementation task when this phase ends: **T-HH-001 — Create household** (VS-1), after the VS-0 platform tasks.

## Honesty notes

- Every root document is written for this project specifically; where a number appears (budgets, thresholds, retention) it is a deliberate default with a stated revisit trigger, not a measured fact.
- `SKILLS.md` records that no agent skills are currently available in this environment — it is not padded with inventions.
- `docs/architecture/FINAL-REVIEW.md` lists the known weak points (approximation levels, no offline writes, single-host ops, no self-service deletion) rather than claiming they were solved.
