# AGENTS.md — Operating Contract for Coding Agents

This file tells a coding agent exactly how to work in this repository. Read it fully before the first edit. The specification suite (PRD, ARCHITECTURE, ADRs, TASKS, and the docs/ tree) is authoritative; code that contradicts it is wrong until the docs are amended by process.

## 0. Phase Awareness

This repository was created in **Specification + Architecture + Skeleton mode**. Skeleton files exist to communicate boundaries, contracts, and intent. **A skeleton is not a stub you quietly fill in** — you fill it in only when executing the task that authorizes it, and you preserve the comment contract (requirement IDs, task IDs, invariants) when you do.

## 1. Before Coding

For every task, in this order:

1. **Read the task** in TASKS.md (goal, inputs, edge cases, security, testing, DoD).
2. **Read the requirements** it cites (PRD.md FR-*/NFR-* rows) — the requirement text is the spec, not the task's paraphrase.
3. **Read the related ADRs** (the task's docs references; ADR.md index). An Accepted ADR constrains *how* you may implement.
4. **Inspect existing architecture:** the module you touch + its direct dependents (docs/architecture/module-boundaries.md, dependency-rules.md).
5. **Inspect affected module contracts** in `src/shared/contracts/` and the skeleton files in the target modules.
6. **Inspect tests** (TEST_STRATEGY.md planned IDs for the task + existing test files) — write tests to the planned IDs.
7. **Identify security implications** (THREAT_MODEL.md rows the task touches; SECURITY.md controls). If the task creates a new trust boundary or input surface, stop and note it in the PR.
8. **Identify performance implications** (PERFORMANCE.md budgets; NFR-PERF-014 for any new query — an index must exist or be proposed in the same PR).
9. **Implement the smallest coherent change** that satisfies the task. No drive-by refactors, no unrequested features, no "while I'm here".

## 2. Repository Discovery

Preferred order (cheap → expensive):

1. **Repository index:** this file, README.md, TASKS.md (task → modules mapping), ARCHITECTURE.md §3 (module map).
2. **Symbol search / codegraph:** find the port or type by name (e.g., `ReaderProgressRepository`) — contracts are named to be findable.
3. **`rg` (ripgrep)** with targeted patterns: `rg "T-READER-031"` (task references are in comments by design), `rg "interface .*Repository"`, `rg "FR-READER-012"`.
4. **Targeted file reads** once the location is known.

Avoid:
- Recursively dumping the project (`cat` of directories, whole-tree reads).
- Broad repeated greps (`rg "function"` across the tree) — scope patterns to a module first.
- Guessing paths from memory — the module map is one read away.

## 3. After Coding — Verification Protocol

Run the **narrowest relevant verification first**, then widen. Never "run everything" reflexively; it wastes budget and hides the signal.

1. **Focused:** `npm run test:unit -- <filter for the touched module>` (or the specific test file).
2. **Milestone-level:** `npm run typecheck && npm run lint && npm run test:unit` (always, before declaring done).
3. **Integration** when the task touches persistence or storage: `npm run test:integration` (compose services up; TEST_STRATEGY.md §1).
4. **E2E** when the task is user-visible: `npm run test:e2e -- <spec filter>` — plus the **a11y gate** (axe runs inside E2E; a touched route must be axe-clean).
5. **Build** before pushing: `npm run build` (catches RSC boundary mistakes the unit layer can't).
6. **Browser inspection for any UI change:** desktop + mobile viewports, both themes; capture a screenshot for the PR. No UI ships un-seen.
7. **Documentation update** when behavior/contracts changed (CONTRIBUTING.md §8 trigger table) — including the task's own comment headers if the implementation changed the stated invariants (if it did, the task spec changed — raise it).

Flaky tests: zero tolerance. A flake blocks the milestone; quarantine with a new task, never delete.

## 4. Hard Rules (CI enforces the first four)

1. **Boundary rules:** `features/*` never imports `server/*`; only `server/db` imports drizzle; only `server/storage` imports the S3 SDK; only `server/telemetry` imports OTel SDK packages; RSC/client boundaries per ADR-001.
2. **Traceability:** every new file/function in product code carries requirement + task IDs in comments (skeleton comment standard). Code without IDs is a review failure.
3. **No fake implementations:** no hardcoded product data, no mock auth/DB, no dummy search. Fixtures live only in the seed harness (tests). A function you can't implement yet stays a skeleton (`throw new Error("Not implemented: T-…")`).
4. **No unreviewed dependencies:** new packages require a research-registry row (SELECTED/PLANNED/OPTIONAL) or an ADR note in the same PR (CONTRIBUTING.md §5).
5. **No implementation without a task:** if the work isn't in TASKS.md, the first step is creating the task (with requirement mapping) — then the code.
6. **Secrets:** never in code, logs, tests, PRs. Env-injected only (SECURITY.md §9).
7. **Error handling:** throw typed `AppError` codes from `shared/contracts/errors.ts`; inventing new codes requires the API_CONTRACT §6 table updated in the same PR.

## 5. Definition of Done (normative — per task)

See CONTRIBUTING.md §3 (10 points). Summary: matches task spec + requirements satisfied + planned tests exist and pass + typecheck/lint/unit green + integration (if data) + E2E & axe (if user-visible) + browser-verified + docs updated + no new deps without registry + no secrets/fake-data/ID-less TODOs.

## 6. Working Style

- Small commits, one concern each; message = Conventional Commits + `Task: T-…` in the body (CONTRIBUTING.md §2).
- When stuck on an ambiguity: the PRD/ADRs/docs resolve most; if genuinely unresolved, record an **open question** in the task's PR (tag `spec-question`) — do **not** guess and bury it.
- When you find a spec contradiction (two docs disagree): stop, write the contradiction down (file + line), pick the more recent/authoritative (PRD > ADR > docs), implement that, and open a spec-fix task. Never silently pick.
- Preserve the skeleton comment standard: responsibility, invariants, requirement IDs, task IDs, edge cases, doc references — that documentation is load-bearing for the *next* agent.

## 7. What "Done" Means for a Slice

The slice's exit criteria (ROADMAP.md) are met: tasks green, manual verification performed and recorded, artifacts (reports, drill timings, verification evidence) archived where the slice names them, and no open `spec-question` without an owner.
