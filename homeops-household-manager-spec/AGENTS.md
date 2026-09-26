# AGENTS.md — Coding Agent Instructions for HomeOps

> **This is the primary instruction file for any coding agent working in this repository.**
> Version 1.0 · 2026-09-26 · Applies to every agent, every slice, every task.
> If any instruction in another file conflicts with this one, **this file wins** — then raise the conflict in your task notes.

## 0. State of the repository right now

**This repository is in DOCUMENTATION + ARCHITECTURE + SKELETON mode.**

- `docs/**` and root `*.md` files describe intended behaviour. They are the specification.
- `src/**` and `tests/**` contain **contracts only**: interfaces, types, enums, ports, route shells, component shells, and functions that `throw new Error("Not implemented: <TASK-ID>")`.
- **No product feature is implemented.** That is intentional and audited (docs/architecture/FINAL-REVIEW.md#no-feature-implemented).

## 1. Forbidden actions in this phase

Do **not** implement, "just quickly", or "as an example":

| Forbidden | Why |
| --- | --- |
| Real SQL queries or table definitions | ADR-003; DATA_MODEL.md is the design, implementation starts VS-0 |
| Production migrations | ADR-002; migrations are authored per slice |
| Functional authentication | ADR-004; `server/auth/*` is ports only |
| Recurrence algorithms | ADR-007; highest-precision area, needs its own slice (VS-5) |
| Alert evaluation algorithms | ADR-008; VS-9 |
| Notification delivery / push sending | ADR-009; VS-10 |
| Working CRUD flows | Tasks own them; VS-1..VS-12 |
| Working uploads | VS-11 (issues photos); no storage decision yet (proposed ADR-017) |
| Production dashboard logic/queries | VS-4 |
| Real API persistence | API.md is a design |
| Background scheduling | ADR-013; VS-9 |
| Production UI / Tailwind implementations | DESIGN.md is a design; components are shells |
| Service worker / PWA sync | ADR-014; VS-13 |
| External service integrations | None are selected yet |
| Filling in a `throw new Error("Not implemented: …")` body | This phase forbids it |
| Replacing a `throw` with `return []`, `return true`, `return null`, or a fake object | Fake implementation is worse than no implementation |

If a task appears to require implementation, **stop and report** that the task belongs to a later phase.

## 2. The workflow every agent must follow

```text
TASK → REQUIREMENTS → DESIGN → ADR → CURRENT CODE → IMPLEMENT → TEST → MANUAL QA
```

Before writing a single line of code, complete these ten steps **in order** and record them in the task's notes/PR description:

1. **Read the TASKS.md entry.** Find the exact task ID (e.g. `T-CHORE-021`). If you cannot find it, stop — do not invent tasks. Do not merge tasks.
2. **Read the referenced requirement(s).** PRD.md section, exact `FR-*`/`NFR-*` IDs. Restate them in one sentence each.
3. **Read the related design documents.** `docs/product/*` for behaviour, `docs/design/*` for UI, `DESIGN.md` for principles, `DATA_MODEL.md` for persistence shape, `API.md` for operation contracts, `EVENTS.md` for domain events.
4. **Read the relevant ADR(s).** If the task contradicts an ADR, stop: either the task is wrong or an ADR supersedes it. Never silently deviate.
5. **Inspect the current module.** Read the existing types, ports, services and errors in that module — including the neighbour modules the task depends on.
6. **Inspect the current tests.** Read the `describe.todo` skeletons for the module (`tests/**`). They are the acceptance list. Convert them, do not delete them silently.
7. **Identify edge cases** explicitly. Every module has a list in docs/domain/INVARIANTS.md and its `docs/product/*` page. Timezone boundaries, month clamping, duplicate taps, concurrent completion, and empty states are the recurring ones.
8. **Identify security and privacy impact.** Which boundary is crossed? Which role is required (docs/security/AUTHZ-MATRIX.md)? Does the change touch PII, logs, or uploads (PRIVACY.md, NFR-PRIV-003)? Does it add a threat scenario (THREAT_MODEL.md)?
9. **Implement the smallest coherent change.** One task, one concern. No opportunistic refactors, no new abstractions without a requirement, no dependency additions without a STACK-2026 update and DECISIONS.md entry.
10. **Run focused verification.** Typecheck, lint, the module's unit tests, its integration tests, and — for UI tasks — the relevant E2E spec and a keyboard/screen-reader pass. Report exactly what you ran and what you did not.

## 3. Definition of done (per task)

A task is done only when **all** of the following hold:

| # | Requirement |
| --- | --- |
| 1 | The requirement ID(s) are referenced in code comments and in the PR/commit message. |
| 2 | Domain invariants from docs/domain/INVARIANTS.md for that module are enforced and tested. |
| 3 | Authorization is enforced **server-side**, with the required role per docs/security/AUTHZ-MATRIX.md. |
| 4 | Household scoping is structural: the repository port used requires a `HouseholdContext`. |
| 5 | Activity is recorded where FR-ACT-001 requires it. |
| 6 | Alert effects are considered: does this create, refresh, or auto-resolve an alert (ADR-008)? |
| 7 | Notification effects are considered, but never implemented inside the domain transaction (ADR-009). |
| 8 | Idempotency holds for the mutation (double-tap, retry, scheduler re-run). |
| 9 | Tests exist: unit for rules, integration for boundaries, E2E for the user journey where applicable. |
| 10 | UI states are covered: empty (DESIGN §9), loading (§10), error (§11), and a11y (§13 / ACCESSIBILITY.md). |
| 11 | Observability hooks are named: which event/metric/span (OBSERVABILITY.md). |
| 12 | Documentation is updated if behaviour diverges from the docs — or the divergence is raised explicitly. |
| 13 | No forbidden action from §1 was taken. |

## 4. Coding standards

| Area | Rule |
| --- | --- |
| Language | TypeScript strict (`strict: true`, TypeScript 6.0 defaults). No `any`; use `unknown` + narrowing. `as` only at I/O boundaries with a comment. |
| Modules | No barrel `index.ts` re-exports across modules. Explicit import paths. |
| Layering | Respect ARCHITECTURE.md §4: `app → features → domain`, adapters in `server`, leaves in `shared`. Never import upward. |
| Domain purity | `src/domain/**` imports nothing from `next`, `react`, `drizzle-orm`, or `server/**`. |
| Errors | Use the typed error catalogue (docs/api/ERROR-CATALOG.md). Never throw raw strings. Never leak internal errors to users (DESIGN §11). |
| Naming | `camelCase` for values, `PascalCase` for types, `SCREAMING_SNAKE_CASE` for enum members, `kebab-case` filenames, `use-case` verbs for services. |
| Comments | Explain **why** and cite requirement/ADR/task. Do not narrate code. |
| Time | Never call `new Date()` in domain code — take an injected `Clock`. Store instants as UTC, schedule anchors as civil dates (ADR-007). |
| Randomness/ids | Never generate ids in domain code without an injected generator; use `uuidv7()` semantics via the adapter (ADR-002). |
| Data | All queries go through repository ports with a household context (ADR-005). No ad-hoc Drizzle imports outside `src/server/db`. |
| UI | Presentational components only; no fetching in components; client components opt-in with a reason (ARCHITECTURE.md §4, CP-6). |
| Copy | Sentence case, second person, no blame, no exclamation marks (DESIGN §17). |
| Tests | Vitest for unit/integration, Playwright for E2E. Test names include the task ID (see TESTING.md). |

## 5. Security, privacy and tenancy checklist (run before every commit)

- [ ] Does every new read/write path require a `HouseholdContext`?
- [ ] Is the required role checked server-side, not just in the UI?
- [ ] Is user input validated with Zod at the boundary?
- [ ] Is any new log line free of names, emails, titles, notes, or free text?
- [ ] Are new error messages safe for users (no stack traces, no internal ids beyond a correlation id)?
- [ ] If a new endpoint/action exists: is it rate limited where it is abusable (auth, invites, uploads, mutations)?
- [ ] If a new file/upload path exists: is type/size validation and safe serving in place?
- [ ] Does the change add or remove a threat scenario in THREAT_MODEL.md?

## 6. Working with the documentation set

| Need to know… | Read |
| --- | --- |
| Why this stack | docs/research/STACK-2026.md |
| What the product must do | PRD.md |
| How it should feel and look | DESIGN.md, docs/design/DESIGN-SYSTEM.md, docs/design/PAGES.md |
| How the system is structured | ARCHITECTURE.md, docs/architecture/MODULE-MAP.md |
| What the domain rules are | DOMAIN.md, docs/domain/INVARIANTS.md |
| How data is stored | DATA_MODEL.md |
| What operations exist | API.md, docs/api/CONVENTIONS.md |
| What events exist | EVENTS.md |
| What must never happen (security) | SECURITY.md, THREAT_MODEL.md |
| What must never happen (privacy) | PRIVACY.md |
| Performance budgets | PERFORMANCE.md |
| Accessibility bar | ACCESSIBILITY.md |
| Telemetry contract | OBSERVABILITY.md |
| Test strategy | TESTING.md |
| Manual QA scripts | QA.md |
| Order of work | ROADMAP.md, TASKS.md |
| Deploy/operate/fix | DEPLOYMENT.md, OPERATIONS.md, RUNBOOK.md |
| Requirement → everything mapping | docs/TRACEABILITY.md |
| Project vocabulary | GLOSSARY.md |

## 7. Rules for evolving these documents

- **Requirements**: add a new `FR-*` ID; never renumber. Mark removed requirements as `REMOVED` with a date.
- **ADRs**: never edit the substance of an accepted ADR. Write a new one and mark the old `Superseded by ADR-NNN`. Update ADR.md.
- **Decisions**: record every non-obvious choice in DECISIONS.md with date, context, and consequence.
- **Skeletons**: a `throw new Error("Not implemented: T-…")` may only be replaced when implementing **that exact task**. When you do, keep the doc comment and add the test.
- **Traceability**: after changing a requirement or task, update docs/TRACEABILITY.md and run `node scripts/verify-docs.mjs` (this phase: run it after any docs change; CI runs it in VS-0).

## 8. Anti-patterns observed in similar projects (do not repeat)

| Anti-pattern | Consequence | Instead |
| --- | --- | --- |
| Notifying everyone for everything | Alert fatigue kills the product (DP-4) | Resolve recipients explicitly (FR-NOTIF-010) |
| Storing a status flag instead of an event | No history, cannot answer "who did it" | Completion/state records (ADR-006, FR-TRASH-006) |
| Computing "cleanliness" scores | Fake precision, distrust | Derived states with reasons (ADR-010) |
| Putting business logic in route handlers | Untestable, duplicated, unauthorised paths | Feature service + domain rules |
| Adding Redis "for later" | Operational burden with no requirement | ARCHITECTURE.md §3 |
| Catching errors to keep the feel smooth | Silent data loss, invisible failures | Honest failure states (DESIGN §11) |
| Writing UI that hides authorization failures | Users think the app is broken; real bug masked | Explain the rule (DESIGN §11 E-2) |
| Broad `any`-typed service boundaries | Drift between docs and code | Explicit DTOs (API.md) |

## 9. When you are unsure

Prefer in this order: (1) the nearest ADR, (2) the product page, (3) DESIGN.md principles, (4) ask via a written question in the task notes rather than guessing. **Guessing silently is the only unrecoverable mistake.** A change that is small, reversible, and documented beats a change that is clever and undocumented.

## 10. Phase status footer (do not remove)

```text
PHASE: architecture + skeleton (no features implemented)
NEXT PHASE: VS-0 Foundation — see ROADMAP.md
FIRST IMPLEMENTATION TASK: T-HH-001 (see TASKS.md and docs/architecture/FINAL-REVIEW.md)
```
