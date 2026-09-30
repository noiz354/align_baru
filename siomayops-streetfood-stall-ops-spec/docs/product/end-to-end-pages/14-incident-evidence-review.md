# Incident Evidence Review — End-to-End Implementation Prompt

You are continuing work on **SiomayOps**.

## TARGET PAGE / VERTICAL SLICE

- Route: `/hq/incidents/[id]`
- Page: **Incident Evidence Review**
- Purpose: HQ/supervisor review of incident facts, photos/videos/audio, chronology, status and follow-up, with immutable evidence metadata where supported.

This prompt covers the page **end to end**:

```text
UI
→ authenticated server boundary
→ application/domain service
→ repository/query layer
→ persistence/database
→ analytics/observability
→ tests
→ CI
→ runtime evidence
```

Do not claim completion from UI appearance alone.

---

# 1. GROUND TRUTH FIRST

Before modifying code:

1. Inspect `TASKS.md`, current SDD/spec files, route implementation, API/server actions, domain entities, repositories, persistence, tests and auth/RBAC.
2. Use `rg` and structural/codegraph tooling where available.
3. Identify all existing behavior for this page.
4. Treat runtime/code as implementation truth; treat docs as requirements/context.
5. Do not create duplicate services, repositories, tables or routes when an existing path already exists.

Create or update a concise page-specific audit document:

`docs/integration/14-incident-evidence-review-ground-truth.md`

Classify relevant capabilities:

- `IMPLEMENTED`
- `PARTIAL`
- `MISSING`
- `UNSUPPORTED`
- `UNKNOWN`

Do not mark project tasks done yet.

---

# 2. PAGE DATA CONTRACT

This page needs these real read capabilities:

- incident detail
- evidence metadata
- actor/outlet
- location/time
- review history

And these write capabilities:

- review status
- follow-up note
- resolution state if supported

For every visible field/action identify:

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|

No production-looking mock values may remain once integration is complete.

If a design element has no backend/domain support, either:
- omit it, or
- explicitly mark it unsupported in the gap report.

Do not silently fabricate it.

---

# 3. AUTHENTICATION & AUTHORIZATION

Use the existing authentication/session mechanism.

Server-side authorization is mandatory.

Derive protected scope from the session/server context, such as whichever of these actually exist:

- organization/tenant
- HQ role
- outlet assignment
- operator assignment
- ownership
- role/permission

Never trust client-provided organization, tenant, actor or privileged status fields.

Explicitly test:
- unauthenticated access
- authorized access
- cross-outlet/cross-tenant access
- unauthorized write
- direct URL access to another resource

Client filtering is never authorization.

---

# 4. BACKEND / APPLICATION LAYER

Follow the project’s established architecture.

Prefer:

```text
UI
→ Route Handler / Server Action / Server Component boundary
→ use case / service
→ repository/query
→ persistence
```

Do not put business logic into React components.

Do not duplicate aggregation/state-transition logic in route handlers.

Define:
- input contract
- output contract
- validation
- authorization
- error mapping
- idempotency where relevant
- audit/event behavior where relevant

Use presentation-neutral data:
- numeric amounts, not formatted Rupiah strings
- structured timestamps, not pre-rendered labels
- structured event/status types, not UI prose

---

# 5. DATABASE / PERSISTENCE

Inspect the ACTUAL persistence system first.

It may currently be file-backed, SQL-backed, or another repository implementation.

Do not migrate storage merely because another architecture seems more production-like.

For this slice, determine:

```text
AUTHORITATIVE STORE:
READ PATH:
WRITE PATH:
PRIMARY KEYS:
FOREIGN/DOMAIN RELATIONSHIPS:
INDEX/LOOKUP NEEDS:
RESTART DURABILITY:
```

If schema change is genuinely required:

1. justify it from a missing domain capability,
2. use the project’s migration convention,
3. keep migration backward-safe,
4. define rollback/recovery implications,
5. avoid destructive changes unless canonical requirements demand them.

For money:
- follow existing integer/decimal convention,
- never introduce floating-point accounting errors.

For time:
- respect established business timezone and persisted timestamp semantics.

---

# 6. READ PATH

Implement/reuse server-side query/read model(s).

Requirements:
- deterministic
- scoped
- testable
- no N+1 behavior where avoidable
- no UI formatting
- valid empty state
- explicit unsupported/null values
- bounded list/history queries

Do not let the page independently scan persistence or calculate business aggregates.

---

# 7. WRITE PATH / STATE TRANSITIONS

For every supported mutation:

```text
User action
→ client UX validation
→ server validation
→ authorization
→ use case/domain rule
→ repository
→ persistence
→ audit/event
→ read-model refresh
→ UI confirmation
```

Protect against accidental duplicate writes where the operation matters financially or operationally.

Use existing idempotency/request-key conventions if available.

Never fake success by updating local React state without authoritative persistence.

---

# 8. FRONTEND INTEGRATION

Preserve the established SiomayOps visual language.

The page must handle:

- loading
- empty
- success
- validation errors
- authorization failure
- server failure
- stale/partial data where applicable
- mobile/desktop behavior appropriate to this page

Do not fall back to sample/mock operational records when real data is empty.

Prefer Server Components for initial authenticated reads when consistent with the project. Keep client components only for interactions requiring browser state/APIs.

---

# 9. ANALYTICS

Instrument only useful product/operational events.

Required event families for this page:

- incident_reviewed
- incident_status_changed
- incident_evidence_opened

Rules:
- do not include secrets
- do not include raw audio/video/photo content
- do not include unnecessary PII
- avoid raw free-text notes in analytics payloads
- include stable page/action/status identifiers
- include outlet/org identifiers only if allowed by current telemetry policy
- record success/failure separately where operationally useful

Create/update:

`docs/analytics/14-incident-evidence-review.md`

Document:
- event name
- trigger
- properties
- prohibited properties
- downstream use

If the project already has analytics abstraction, use it. Do not wire multiple competing SDKs.

---

# 10. OBSERVABILITY

Use existing logging/metrics/tracing infrastructure.

At minimum ensure failures can be diagnosed through structured server logs.

Where supported, add:
- request/use-case latency
- error count
- persistence failure count
- job/upload failure count where applicable

Never log:
- passwords
- auth tokens
- raw private recordings
- raw evidence media
- unnecessary sensitive free text

Correlate requests/jobs with safe IDs where architecture supports it.

---

# 11. TESTS

Add the smallest meaningful test pyramid for this slice.

## Domain / service tests
Test business rules and state transitions.

## Repository / persistence tests
Prove reads/writes use the authoritative store.

## Authorization tests
Prove scope isolation.

## Server boundary tests
Prove validation + error contract.

## UI integration tests
Prove real server data renders and mutations refresh correctly.

## Runtime/browser test
Prove the real user flow.

Avoid giant snapshot tests that merely freeze markup.

---

# 12. CI GATE

Update CI only if needed, using the existing pipeline.

This slice must be covered by these relevant checks:

- access-control tests
- audit-history tests
- evidence authorization tests
- UI tests
- build

A suitable PR gate should conceptually be:

```text
install
→ typecheck
→ lint
→ focused/unit tests
→ integration tests
→ production build
```

Add E2E/browser checks only where the existing CI infrastructure supports them reasonably.

Do not build a completely new CI platform for one page.

Do not hide pre-existing failures. Report separately:
- `NEW FAILURE`
- `PRE-EXISTING FAILURE`
- `PASS`

---

# 13. RUNTIME EVIDENCE

Run the application and prove the slice against real persisted state.

Capture exact commands/results.

Minimum proof:

1. authenticate as an authorized user,
2. open `/hq/incidents/[id]`,
3. verify real persisted read data,
4. exercise each supported primary mutation,
5. verify persistence directly through normal repository/runtime inspection,
6. reload,
7. verify state remains,
8. restart server where durability applies,
9. verify state remains,
10. exercise one invalid input,
11. exercise one unauthorized path,
12. inspect browser console and server logs for unexpected errors.

Do not fabricate browser/runtime evidence.

---

# 14. ANALYTICS EVIDENCE

During runtime verification confirm expected analytics events are emitted.

Prove at least:
- page/view event
- one primary action event
- success or failure event where applicable

If analytics is intentionally absent from the project, document that as a gap instead of inventing a telemetry stack.

---

# 15. CI EVIDENCE

Report the exact CI/local-equivalent commands executed and their outputs.

Do not say “CI-ready” merely because code compiles.

If the actual remote CI cannot be triggered from the environment, prove the same commands locally and clearly label that limitation.

---

# 16. REQUIRED DOCUMENTATION

Create:

```text
docs/integration/14-incident-evidence-review-ground-truth.md
docs/integration/14-incident-evidence-review-architecture.md
docs/integration/14-incident-evidence-review-runtime-evidence.md
docs/integration/14-incident-evidence-review-gap-report.md
docs/analytics/14-incident-evidence-review.md
```

Keep documentation factual and tied to code/runtime evidence.

---

# 17. DEFINITION OF DONE

This page is DONE only when applicable requirements form a complete loop:

```text
Real persisted state
→ authorized backend read
→ page renders it

and, for supported mutations:

UI action
→ server validation
→ authorization
→ domain logic
→ persistence
→ refreshed read model
→ visible UI change
→ reload/restart durability proof
```

Additionally:
- analytics events are proven or explicitly documented as unsupported,
- relevant tests pass,
- CI gate covers the changed slice,
- no production-looking hardcoded operational data remains,
- no cross-scope access is possible,
- no unsupported capability is claimed as implemented.

Do not update `TASKS.md` to DONE until canonical acceptance criteria are fully evidenced.

---

# 18. FINAL RESPONSE FORMAT

Return:

## Changed files
Exact files.

## Architecture
Show the final flow.

## Backend
Server boundary/use cases/repositories used.

## Database / persistence
Authoritative store and any schema changes.

## Frontend
What is now real vs still unsupported.

## Authorization
Evidence of scope enforcement.

## Analytics
Events added and evidence.

## Tests
Commands and exact counts.

## CI
Checks added/executed.

## Runtime proof
Before/action/after/reload/restart evidence as applicable.

## Remaining gaps
Only genuine gaps.

## Task status
`DONE` only if canonical criteria are actually proven; otherwise `NOT DONE`.

---

# STRICT CONSTRAINTS

Do NOT:
- redesign unrelated pages
- invent domain entities
- invent backend support
- add fake production data
- create parallel repositories/services unnecessarily
- bypass auth for successful demos
- store protected scope from client input
- claim completion from static UI
- hide test/CI failures
- refactor unrelated code

Implement this page as one **evidence-backed vertical slice** from UI through backend, persistence, analytics and CI.
