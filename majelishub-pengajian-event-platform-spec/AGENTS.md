# AGENTS.md — WORKING IN THIS REPOSITORY

This repository is written **for coding agents**. The documentation is authoritative; the code is a
skeleton that must agree with it. Read this file before touching anything.

Current phase: **VS-1 (Phase 0 freeze lifted 2026-09-27).** The documentation set and the skeleton are
still the authority. Two tasks are implemented — `T-ORG-001` (identity + durable rate limiting) and
`T-SEC-001` (tenant isolation) — and both carry a `Delivered:` line in `TASKS.md` stating exactly what
was and was not built. Any other change that adds real business logic is still out of scope until the
roadmap slice that owns it is activated (`ROADMAP.md`) and its task block exists in `TASKS.md`.

---

## 1. The mandatory workflow

Every change follows this chain. Do not skip steps; if a step has no answer, that is a signal to stop
and ask, not to invent.

```
   TASK                 find the task in TASKS.md (or create one — §9)
     ↓
   PRD REQUIREMENT      which stable requirement ID(s) does this satisfy?
     ↓
   PRODUCT SPEC         read the product doc for that area (docs/product/*, root module docs)
     ↓
   DESIGN               read DESIGN.md / docs/design/* for the UX and interaction rules
     ↓
   ADR                  read every ADR the task lists; they are binding decisions
     ↓
   SECURITY / PRIVACY   read SECURITY.md, THREAT_MODEL.md, PRIVACY.md, AUTHZ-MATRIX.md
     ↓
   CURRENT CODE         read the module you are about to change, and its contracts and tests
     ↓
   IMPLEMENT            smallest coherent change; skeleton rules apply (§5)
     ↓
   TEST                 unit + integration (+ browser/E2E where the task says so)
     ↓
   MANUAL QA            execute the listed QA scenario section; record the result
```

**Documentation hierarchy when things disagree:**

1. `PRD.md` (what the product must do)
2. Product specifications (`docs/product/*`, `PROGRAM`, module docs)
3. `DESIGN.md` + `docs/design/*` (how it must feel)
4. ADRs (decisions that constrain implementation)
5. `ARCHITECTURE.md`, then `DOMAIN.md` / `DATA_MODEL.md` / `API.md` / `EVENTS.md` / `STATE_MACHINE.md`
6. `TASKS.md` (the work contract)
7. Skeleton code

If code contradicts 1–6: **the code is wrong**. Fix the code, or (if the document is genuinely
outdated) update the document in the same PR and explain why. Never silently diverge.

## 2. Pre-change checklist (all ten steps, every time)

1. **Read the TASKS.md entry** for the task (Goal, Invariants, Concurrency, Failure cases).
2. **Read the requirement IDs** it cites in `PRD.md` (and any NFR that constrains it).
3. **Read the related product document** for the area (e.g. `CONTENT.md`, `docs/product/EVENTS.md`).
4. **Read the relevant ADRs** — including the ones the task lists explicitly. They are binding.
5. **Inspect the impacted module** (`ARCHITECTURE.md` §module boundaries) and every file you will edit
   plus its neighbours.
6. **Inspect the contracts** (`src/shared/contracts/**`): types, validation schemas, event payloads,
   DTOs. Changes here ripple; change them deliberately.
7. **Identify security and privacy implications** — permissions required, data collected, telemetry
   emitted, retention class, tenant scope.
8. **Identify race conditions** — check `docs/testing/CONCURRENCY-TESTS.md`; name the case (C1…C12) if
   the path is concurrency-sensitive.
9. **Inspect the relevant tests** — read the existing `describe.todo()` blocks; they are the
   acceptance checklist for implementing this area.
10. **Implement the smallest coherent change.** One task, one concern. If you find yourself touching
    five modules, you are either doing two tasks or misreading the design.

## 3. Before you write any code

- [ ] Does the task exist in `TASKS.md` with the required fields? If not, write it first (§9).
- [ ] Can you state in one sentence what becomes possible for which user type?
- [ ] Which requirement IDs does it satisfy? (must be at least one)
- [ ] Which ADRs constrain it?
- [ ] Does it collect, display or transmit personal data? → privacy review, minimal collection
- [ ] Does it change retention? → `RETENTION.md` + possibly the notice
- [ ] Does it add a dependency? → `docs/research/STACK-2026.md` classification + ADR if it is a
      platform-level choice. **Do not add dependencies casually.**
- [ ] Does it add a notification? → `NOTIFICATIONS.md` catalogue + dedupe key + quiet hours
- [ ] Does it change the state of an entity? → `STATE_MACHINE.md`
- [ ] Does it emit an event? → `EVENTS.md` payload rules (ids, counts, enums — never content)
- [ ] Does it add a route? → `API.md` (form/Action/route, permissions, idempotency, error shape)
- [ ] Does it affect check-in, attendance, recording or publication? → extra scrutiny, explicit
      failure paths, and manual QA

## 4. Hard rules (violating these is a bug, not a style issue)

1. **Never fake an implementation.** `return { success: true }` is forbidden. Unimplemented behaviour
   throws `new Error("Not implemented: T-XXX")` with the owning task ID.
2. **Never implement beyond the activated task.** A slice activates specific tasks; everything outside
   them stays a skeleton. As of VS-1 the activated surface is identity, tenancy and rate limiting
   (`T-ORG-001`, `T-SEC-001`). Still forbidden everywhere: QR generation, recording, upload,
   transcription, notifications, payments, and any product UI (see the phase boundary in `README.md`).
3. **Never publish machine text.** Automated transcription is not authoritative. The review gate
   (ADR-0012) is not bypassable: machine draft → human review → approval → publication.
4. **Never "fix" religious text automatically.** No silent correction of Qur'anic verses, hadith,
   Arabic phrases or attributions. Preserve the original machine output, expose uncertainty, let a
   human correct it, and keep the revision history (ADR-0023).
5. **Never rank people.** No speaker popularity, rating, authority score, leaderboard, or public
   ranking — anywhere, including analytics (`ADR-0014`, `ADR-0024`).
6. **Never invent numbers.** Attendance must distinguish registered / checked-in / walk-in / no-show
   and must not state fake precision. Small-sample feedback is suppressed (`n < 5`).
7. **Never break tenancy.** Every data access goes through the tenant scope; cross-organization access
   returns **404**, not 403 (`ADR-0017`).
8. **Never put personal data in telemetry.** No tokens, contacts, names, transcript or feedback text in
   logs, traces or metrics (`OBSERVABILITY.md` §7).
9. **Never let a token leak into an uncontrolled channel.** Codes/links only through reviewed channels
   (`NOTIFICATIONS.md`).
10. **Never trust the client for integrity.** Check-in, attendance, capacity and publication decisions
    are made server-side and are backed by database constraints.
11. **Never change the schema on boot.** Migrations are an explicit deploy step (`ADR-0020`).
12. **Never skip the failure path.** Every skeleton function that does I/O must document what happens
    when that I/O fails, and the failure must be a state the user can understand.

## 5. Skeleton rules

1. **Types and contracts are real; behaviour is not.** A DTO, Zod schema, port interface or state
   machine table may be fully written (it *is* the specification), but implementations throw.
2. **Every stub is traceable and self-documenting.** The pattern:

```ts
/**
 * Validate a scanned check-in token and produce a check-in result.
 *
 * Where this belongs: application layer (src/features/checkin/), called by the scanner UI and the
 *   /api/v1 check-in route. Repository access goes through AttendanceRepository.
 * Why it is not implemented yet: it is the core of roadmap slice VS-4 (T-CHECKIN-001…).
 * Invariants: a token never yields two attendance records (C2); a duplicate is a success-shaped
 *   ALREADY_CHECKED_IN result, never an error; failures never render as success.
 * Security: token hashing + constant-time comparison (SECURITY.md §6); no PII in logs.
 * Privacy: no participant history is written; only the attendance record.
 * Failure cases: invalid format, unknown token, wrong event, expired, revoked, cancelled
 *   registration, window closed, storage/DB unavailable.
 *
 * @throws Error("Not implemented: T-CHECKIN-001") until that task is delivered
 */
export async function validateCheckInToken(
  input: ValidateCheckInInput,
): Promise<CheckInResult> {
  throw new Error("Not implemented: T-CHECKIN-001");
}
```

3. **Route shells return `null`** and contain a `TODO(T-XXX)` comment (Phase 0 rule from `DESIGN.md`).
   They must not render placeholder UI that could be mistaken for the product.
4. **Test skeletons use `describe.todo` / `test.todo`** with the required behaviour in the title, e.g.
   `test.todo("returns ALREADY_CHECKED_IN with the original time without creating a second record")`.
   In the Playwright layers (E2E/a11y/load) the equivalent placeholder is
   `test.fixme("title", async () => {})` — Playwright has no `todo`, and its `fixme` requires a body
   (`TESTING.md` §1.4). Implementing a slice means replacing todos with real tests.
5. **No unused abstractions.** Do not invent a port "for later" unless the docs name it.
6. **Comments explain *where and why* the future code belongs**, never *how* the algorithm works
   (there is no algorithm yet).

## 6. Reading order for a new agent (first hour)

1. `README.md` — the 14 product questions, user types, phase statement.
2. `PRD.md` — skim requirements; note IDs.
3. `ARCHITECTURE.md` — module boundaries and the import rule.
4. `DOMAIN.md` + `DATA_MODEL.md` — what the entities are and what must be true of them.
5. `STATE_MACHINE.md` — the ten machines.
6. `DESIGN.md` + `docs/design/PAGES.md` — the three experiences and their pages.
7. `TASKS.md` — the work contract and the DoD template.
8. The module doc for whatever you are touching (`CHECKIN.md`, `AUDIO.md`, `TRANSCRIPTION.md`, …).

## 7. Module boundaries and imports

`app → features → domain → shared/server` (enforced by lint; `ARCHITECTURE.md` §imports).

- `domain/**` — pure rules, no I/O, no framework, no clock (use the injected `Clock`).
- `features/**` — application services and UI composition; may use domain and shared.
- `server/**` — infrastructure adapters (database, storage, jobs, providers) behind ports.
- `shared/**` — contracts, errors, time, ids, telemetry-free utilities.
- `app/**` — routes and Server Actions only; no business rules.

If you need a rule in two places, it belongs in `domain/**` (single definition, no duplication).

## 8. Definition of done (from TASKS.md)

A task is done when **every** line of its Definition of Done is satisfied, including: real
implementation replacing the stubs, the listed tests implemented and passing, manual QA executed and
recorded, security/privacy implications verified, telemetry added within the allow-list, documentation
updated if behaviour differs, and no `Not implemented:` string left for that task ID.

## 9. How to add a new task

1. Confirm no existing task covers it (search `TASKS.md` and the requirement IDs).
2. Find or create the requirement it satisfies (requirement IDs are stable; do not renumber).
3. Write the task with **all** fields: Task ID, Requirement IDs, Goal, ADR, Product Documents,
   Expected Modules, Dependencies, Expected Behavior, Invariants, Security, Privacy, Concurrency,
   Failure Cases, Tests, Manual QA, Definition of Done. Use `T-CHECKIN-014` as the format model.
4. Keep the ID convention: `T-<MODULE>-<NNN>`, three digits, grouped by module.
5. If the task changes a decision, write the ADR **first** and reference it.

## 10. Output expectations for agents

- **Small, reviewable diffs.** One task per PR; the PR description cites task ID + requirement IDs +
  ADR(s) and states what was explicitly *not* done.
- **No drive-by refactors** outside the task's module. Note them as follow-up tasks instead.
- **No new dependency** without classification and, if platform-level, an ADR.
- **Report honestly.** If tests were not run, say so. If a piece is still a stub, say which task ID owns
  it. Never describe a skeleton as working.
- **Update the docs you invalidated** in the same change.
- **Protect the humans involved.** When in doubt, choose the option that does not touch participant
  data, does not send a message, and does not make an irreversible change.

## 11. Asking for help (escalation triggers)

Stop and ask a human when:

1. A requirement is ambiguous or conflicts with another document.
2. A change would need real personal data to test.
3. A change would touch authentication, tenancy, publication, attendance integrity, or retention in a
   way the docs do not describe.
4. You believe an ADR is wrong (write the proposed superseding ADR and ask before implementing).
5. The task cannot be completed without implementing a listed hard limit (e.g. real transcription).
6. You find a security or privacy issue not covered by the threat model.

## 12. Quick reference: where things live

| I need… | Read |
|---|---|
| Requirements and metrics | `PRD.md` |
| Feel and interaction rules | `DESIGN.md`, `docs/design/*` |
| Module boundaries, data flow | `ARCHITECTURE.md` |
| Binding decisions | `ADR.md` + `docs/adr/*` |
| Entities, invariants, constraints | `DOMAIN.md`, `DATA_MODEL.md` |
| Endpoints, errors, idempotency | `API.md` |
| Events and payload rules | `EVENTS.md` |
| Transitions | `STATE_MACHINE.md` |
| The work contract | `TASKS.md` |
| Tests to write | `TESTING.md`, `QA.md`, `docs/testing/*` |
| Security rules | `SECURITY.md`, `THREAT_MODEL.md`, `docs/security/*` |
| Data protection | `PRIVACY.md`, `RETENTION.md` |
| Running it | `DEPLOYMENT.md`, `OPERATIONS.md`, `RUNBOOK.md` |
| Product questions per area | `docs/product/*`, root module docs |
