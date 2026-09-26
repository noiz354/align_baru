# SiomayOps

Operations platform for a distributed Siomay street-food stall network (Jakarta first, then other
Indonesian cities). Hierarchy: **HQ → Regional/Area Ops → Stall Operators → Selling Locations → Customers**.

The product answers one question first: **who was selling, where, with what stock, for how much cash,
and does the money add up** — on cheap Android phones, on bad networks, for people who are busy
serving customers.

---

## ⚠️ PHASE 0 — SPECIFICATION, ARCHITECTURE, DOCUMENTATION, SKELETON CODE ONLY

This repository currently contains **no working product**. It contains the design that the product
will be built from, plus skeleton interfaces whose functions throw:

```ts
throw new Error("Not implemented: T-SHIFT-031");
```

There is deliberately **no** payment integration, no database query against real data, no
authentication implementation, no GPS tracking, no loyalty maths, no settlement maths, no accounting,
no stock deduction, no notification delivery, no dashboard implementation and no deployment.
The first future implementation task is **`T-SHIFT-001`** (`TASKS.md`) and it is *not* started here.

---

## What this system is

| Layer | Who | What they do in SiomayOps |
| --- | --- | --- |
| HQ | Owner, Operations, Finance, Menu/Pricing, Analyst | Configure catalog and prices, watch coverage and money, review variances and field expenses, support operators |
| Regional / Area Ops | Area Supervisor | Assign operators to stalls, follow up incidents, coach, approve within limits |
| Stall Operators | Penjual | Start a shift, report location, sell, record cash and digital payments, record expenses, count stock, close the day |
| Selling Locations | *(place)* | Named selling points with windows, status and history (mangkal spots, not legal claims) |
| Customers | Pelanggan | Pay by cash or QRIS; optionally join the loyalty programme |

## Read in this order

1. `README.md` (this file) — scope, phase rules, non-negotiables.
2. `PRD.md` — goals, personas, requirements (`FR-*`, `NFR-*`), acceptance criteria.
3. `DESIGN.md` — surfaces, tap budgets, wording, ethics in UI.
4. `ARCHITECTURE.md` — modules, layers, invariants, deployment shape.
5. `DOMAIN.md` + `GLOSSARY.md` + `DATA_MODEL.md` — language and data.
6. `STATE_MACHINE.md` + `EVENTS.md` + `API.md` — behaviour contracts.
7. `docs/adr/` — 38 accepted decisions (start with `docs/adr/INDEX.md`).
8. Domain documents by area (`OPERATORS.md`, `STALLS.md`, `LOCATIONS.md`, `PRICING.md`, `SALES.md`,
   `PAYMENTS.md`, `SETTLEMENT.md`, `EXPENSES.md`, `INVENTORY.md`, `LOYALTY.md`, `PERFORMANCE.md`,
   `INCIDENTS.md`, `COMMUNICATION.md`, `NOTIFICATIONS.md`, `OFFLINE.md`, `HQ.md`).
9. Governance and quality (`SECURITY.md`, `PRIVACY.md`, `RETENTION.md`, `TESTING.md`, `QA.md`,
   `ROADMAP.md`, `TASKS.md`, `docs/TRACEABILITY.md`).

## Repository map

```text
README.md  PRD.md  DESIGN.md  ARCHITECTURE.md  ADR.md  AGENTS.md  SKILLS.md
DOMAIN.md  GLOSSARY.md  DATA_MODEL.md  STATE_MACHINE.md  EVENTS.md  API.md
OPERATORS.md  STALLS.md  LOCATIONS.md  PRICING.md  MENU.md  HQ.md
SALES.md  PAYMENTS.md  SETTLEMENT.md  EXPENSES.md  INVENTORY.md  LOYALTY.md
PERFORMANCE.md  COMMUNICATION.md  INCIDENTS.md  NOTIFICATIONS.md  OFFLINE.md
SECURITY.md  THREAT_MODEL.md  PRIVACY.md  RETENTION.md  ACCESSIBILITY.md  OBSERVABILITY.md
TESTING.md  QA.md  ROADMAP.md  TASKS.md  DEPLOYMENT.md  OPERATIONS.md  RUNBOOK.md  CONTRIBUTING.md

docs/adr/         38 decision records + INDEX.md
docs/architecture/  context, modules, dataflow, final review
docs/design/       design system, page inventory
docs/product/      HQ dashboard, shifts, operator recognition
docs/domain/ docs/finance/ docs/payments/ docs/locations/ docs/loyalty/
docs/security/     permissions matrix
docs/testing/      test strategy and fixtures
docs/operations/   API read models
docs/research/     STACK-2026.md (technology validation, September 2026)

src/app/           route shells (pages + /api/v1 route handlers)
src/features/      use-case ports and DTOs per capability
src/domain/        pure domain types, state types, event types
src/server/        adapters: auth, db, payments, jobs, notifications, telemetry
src/shared/        contracts, types, validation, money, time, ui primitives
tests/             unit · integration · browser · e2e (TODO tests only)
tools/             scripts (release checklist, id/requirement census)
```

## Repository root files (Phase 0)

| File | Meaning |
| --- | --- |
| `package.json` | Declarative manifest with the SELECTED stack pinned (ADR-0002, ADR-0035). **Nothing is installed**; PLANNED dependencies are listed but absent. |
| `tsconfig.json` | Strict TypeScript incl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; branded `Money` so a `number` cannot hold money. |
| `next.config.mjs`, `eslint.config.mjs` | Shells: bundler defaults and the module-boundary rules that VS-0 enforces (ADR-0035). |
| `drizzle.config.ts` | Migrations are reviewed SQL; `db push` is permanently forbidden on shared environments (ADR-0004). |
| `vitest.config.ts`, `playwright.config.ts` | Vitest 4 (+ Browser Mode) and Playwright (ADR-0023). Every suite is TODO-only. |
| `docker-compose.yml`, `Dockerfile`, `.env.example` | Local PostgreSQL 18 (+ optional MinIO) and a non-functional image shell; placeholders only. |
| `.github/workflows/ci.yml` | Runs the three integrity tools below. Install/lint/test steps activate at VS-0. |
| `tools/check-stubs.mjs` | Fails if a stub names a non-existent task, a PLANNED/REJECTED dependency is imported, geolocation APIs appear, or an exported function contains logic. |
| `tools/check-docs.mjs` | Fails on dangling document references or an ADR that is missing from / unlisted in the index. |
| `tools/census.mjs` | Counts requirement ids, tasks, ADRs and stubs; fails if any cited requirement id is absent from `PRD.md` or any **P0** requirement lacks task coverage. |
| `tools/gen-traceability.py` | Regenerates `docs/TRACEABILITY.md` from `PRD.md` + `TASKS.md`. |

Run all three checks locally with:

```bash
node tools/check-stubs.mjs && node tools/check-docs.mjs && node tools/census.mjs
```

## Non-negotiables (short list — full list in `AGENTS.md` and `PRD.md` §2)

1. **No fake success.** A digital payment is never `PAID` because a browser or customer said so.
   Unverified amounts are `PENDING_VERIFICATION` and HQ Finance verifies them with evidence.
2. **No offline success for digital payments.** The offline queue never carries a `PAID` transition.
3. **No floats in money.** Integer minor units (`Money`), price snapshots on every sale line.
4. **No silent history rewrites.** Prices, sales and closings are never recalculated retroactively.
5. **No continuous location tracking.** Location is an explicit, shift-bounded operator report.
6. **No auto-accusation.** Stock variance is recorded neutrally with a reason, including `UNKNOWN`.
7. **No facilitation of improper payments.** Field expenses are recorded neutrally as
   `UNVERIFIED_FIELD_EXPENSE` with no assumption about who was paid or why; HQ reviews patterns.
8. **No revenue-only leaderboards** and no hidden scoring of people.
9. **No silent data accumulation.** Retention and deletion are specified (`RETENTION.md`) and consented.

## Local setup (planned baseline, not implemented)

```bash
pnpm install
docker compose up -d      # PostgreSQL 18 (+ MinIO when storage work is in scope)
pnpm lint && pnpm typecheck
pnpm test                 # unit + browser (TODO suites in Phase 0)
pnpm dev                  # Next.js dev server
```

## Contributing

Read `CONTRIBUTING.md` and `AGENTS.md` first. In Phase 0, the only acceptable changes are design
documents, requirement/decision records, skeleton interfaces and TODO tests. Business logic is out
of scope until the corresponding task in `TASKS.md` starts.

## Final Phase 0 gate

`docs/architecture/FINAL-REVIEW.md` records the pre-implementation review. `docs/TRACEABILITY.md`
maps every requirement to the tasks that will satisfy it. Nothing in this repository is production
ready and nothing here may be deployed as a product.
