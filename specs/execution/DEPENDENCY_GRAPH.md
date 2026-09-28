# DEPENDENCY GRAPH

## Feature register

Every feature in the plan, its state today, and where its spec lives.

| ID | Feature | Project | Priority | Spec |
|---|---|---|---|---|
| F-001 | Real session resolution; remove the inverted production guard | siomayops | P0 | `specs/features/F-001-siomayops-real-session/` |
| F-002 | Tenant context derived from the session | homeops | P0 | `specs/features/F-002-homeops-tenant-context/` |
| F-003 | Row-level security on every tenant table | homeops | P0 | `specs/features/F-003-homeops-row-level-security/` |
| F-004 | Migration journal + boot-time schema check | homeops | P0 | `specs/features/F-004-homeops-migration-journal/` |
| F-005 | Remove the request-header identity | majelishub | P0 | `specs/features/F-005-majelishub-remove-header-identity/` |
| F-006 | Public projection for kajian and masjid pages | majelishub | P0 | `specs/features/F-006-majelishub-scoped-public-reads/` |
| F-007 | Test harness isolation + driver parity | majelishub | P1 (unblocks evidence) | `specs/features/F-007-majelishub-test-harness-isolation/` |
| F-008 | Admin authorization boundary | manga | P0 | `specs/features/F-008-manga-admin-boundary/` |
| F-009 | Idempotency required on money routes | siomayops | P1 | Wave 1 brief below |
| F-010 | Durable store for money and safety state | siomayops | P1 | `decisions/ADR-002` |
| F-011 | Sign-in and session wiring for homeops pages | homeops | P1 | Wave 1 brief below |
| F-012 | Registration capability confidentiality + tests | majelishub | P0/P1 | Wave 1 brief below |
| F-013 | Durable safety records | strangerlink | P1 | Wave 1 brief below |
| F-014 | Operator UI (commit what the evidence describes) | parking | P1 | Wave 1 brief below |
| F-015 | Single test runner; execute the progress suite | manga | P1 | Wave 1 brief below |
| F-016 | Restore CI gates; per-project lint; claim checker | workspace | P1 | Wave 1 brief below |
| F-017 | Durable user, session and progress store | manga | P2 | Wave 2 brief below |
| F-018 | HomeOps design system and lint cleanup | homeops | P2 | Wave 2 brief below |
| F-019 | HomeOps integration harness that provisions a database | homeops | P1 | Wave 1 brief below |
| F-020 | Documentation canonicalisation | workspace | P1 | Wave 1 brief below |

## Graph

```
                        ┌─────────────────────── F-001 siomayops real session ───┐
                        │        (P0, no dependencies)                            │
                        │                          │                               │
                        │                          ▼                               │
                        │                    F-009 idempotency required            │
                        │                          │                               │
                        │                          ▼                               │
                        │                    F-010 durable money store (ADR-002)  │
                        └──────────────────────────────────────────────────────────┘

   ┌──────────────── F-004 homeops migration journal ────┐
   │        (P0, no dependencies — do this FIRST)        │
   │                     │                               │
   │                     ▼                               │
   └──────────► F-002 homeops tenant context ───────────┤
              (P0, depends on nothing)                   │
                          │                               │
                          ▼                               │
                    F-003 homeops RLS ───────────────────┤
              (P0, depends on F-002 for the scope)        │
                                                          │
                    F-011 homeops sign-in wiring          │
                    (P1, depends on F-002)                │
                                                          │
                    F-019 homeops integration harness     │
                    (P1, independent — but must land      │
                     before F-002/F-003 can be *proved*)  │
                                                          │
                    F-018 homeops design system          │
                    (P2, depends on F-002 — do last)     │
                                                          └──────────┘

   ┌──────────────── F-007 majelishub test harness ──┐
   │     (P1, no dependencies — unblocks ALL evidence)│
   └───────────────────────┬───────────────────────────┘
                           │  (gates verification of)
   ┌──────────► F-005 majelishub remove header identity ◄──────┐
   │              (P0, no dependencies)                         │
   │                        │                                   │
   │                        ▼                                   │
   └──────────► F-006 majelishub public projection ◄───────────┘
              (P0, depends on F-005)
                           │
                           ▼
                    F-012 majelishub registration capability
              (P0/P1, depends on F-005 for the test harness;
               the short-code fix itself is independent)

   ┌──────────────► F-008 manga admin boundary (P0, no dependencies)
   │
   └──────────────► F-015 manga one test runner (P1, independent)
                          │
                          ▼
                    F-017 manga durable store (P2, depends on F-015)

   ┌──────────────► F-013 strangerlink durable safety records (P1, no dependencies)
   ┌──────────────► F-014 parking operator UI (P1, no dependencies — the domain is done)
   ┌──────────────► F-016 workspace CI gates (P1, no dependencies)
   ┌──────────────► F-020 workspace documentation (P1, runs *after* F-016 so claims can be checked)
```

## Critical path

The single longest chain is **homeops**:

```
F-004 (90 min)
  → F-002-S1, S2 (2 h)
    → F-003 (2.5 h)
      → F-011 → F-018
```

And **majelishub**:

```
F-005-S1 (45 min, ship alone)
  → F-006 (3 h)
F-007 (3 h, parallel with all of the above)
```

siomayops is `F-001-S1` → ship → `F-001-S2` → `F-009` → `F-010`. The first slice is 30 minutes and
closes the worst defect in the workspace.

## What is parallel-safe

| Can run at the same time | Why |
|---|---|
| F-001, F-002, F-004, F-005, F-008 | different projects, disjoint files |
| F-007 with any of the above | test infrastructure only, touches no `src/` |
| F-013, F-014, F-015 | different projects |
| F-016 with everything except F-020 | one root file; F-020 must follow it |
| F-004 with F-002-S3/S4 | different files (`migrations/` vs `src/app/**`) |

## What must be sequential, and why

| Must be serial | Reason |
|---|---|
| F-001-S1 before anything else in siomayops | the audit-chain `500` in majelishub is a lesson: a fix to a downstream defect can unmask a security defect. Do not touch money paths in siomayops before the identity is real. |
| F-005 before the majelishub audit-chain `500` is fixed | the same unmasking risk, in reverse. Fix the identity, then the 500. |
| F-004 before F-002 or F-003 are *proved* | until the domain tables exist on a migrated database, every homeops fix is unverifiable. |
| F-002 before F-003 | RLS needs a scope to set. Landing RLS first means policies that are never exercised. |
| F-008 before any manga admin write | the guard must exist before the feature that needs it. |
| F-016 before F-020 | documentation should cite gates that run. |
| F-007 before claiming any majelishub result | see ADR-001. |

## Waves

See [`IMPLEMENTATION_ORDER.md`](IMPLEMENTATION_ORDER.md) for the ordered list and
[`OWNERSHIP.md`](OWNERSHIP.md) for file-level boundaries.

## Wave 1 and Wave 2 briefs

These have the same SPEC/ACCEPTANCE/IMPLEMENTATION structure in `specs/features/`, written when the
slice is scheduled. The user problem, scope and non-goals are fixed here so an agent does not have to
re-derive intent.

### F-009 — siomayops: idempotency required on money routes · P1
**Problem.** A retry on a flaky connection double-charges. `_helpers.ts` executes the mutation when
`Idempotency-Key` is absent. **Scope.** Return `400 IDEMPOTENCY_KEY_REQUIRED` when the header is
missing on a mutating route. **Non-goals.** Changing `withIdempotency`'s semantics; it is already
correct. **Acceptance.** A mutating request without the key is `400`; with it, a replay returns the
original result and `X-Idempotent-Replayed: true`; a different payload with the same key is `422`.

### F-010 — siomayops: durable money and safety state · P1
**Problem.** Every shift, sale, payment and audit row is lost on restart. **Scope.** Per
`ADR-002`. **Non-goals.** Schema redesign — it exists. **Acceptance.** Create → read → update →
**restart** → read, for a sale, a payment, a stock movement and an audit entry, against real
PostgreSQL 18. **Depends on** F-001.

### F-011 — homeops: sign-in and session wiring · P1
**Problem.** The sign-in pages work and no data route uses them. **Scope.** Make the existing pages
issue a real session the data routes accept; add the sign-in UI states. **Non-goals.** Password reset
flows beyond what exists; OAuth. **Acceptance.** Sign in → `/today` returns that household's chores →
sign out → the same request is `401`. **Depends on** F-002.

### F-012 — majelishub: registration capability confidentiality · P0/P1
**Problem.** A duplicate registration returns another attendee's `shortCode`, which is an accepted
check-in credential; and the raw token is returned twice. **Scope.** On duplicate, return
`ALREADY_REGISTERED` with no secret; return the token in one field; the attendee retrieves their own
code through an authenticated request. Add rate limiting (the durable limiter already exists and is
simply not applied on this route). Add the first tests for the registration and check-in routes.
**Non-goals.** Device binding (`T-CHECKIN-016`), capacity and waitlist (`T-REG-002`).
**Acceptance.** A stranger submitting a victim's email receives no code; the owner, authenticated,
retrieves their own; neither `registrations` nor `checkin/validate` has an unrate-limited path; both
routes have behavioural tests. **Depends on** F-007 for the harness; the short-code fix is
independent.

### F-013 — strangerlink: durable safety records · P1
**Problem.** A restart un-bans everyone. **Scope.** Persist `banStore`, `reportStore`,
`moderationStore` and `safetyEventStore`; keep queue/session/message buffers in memory, which is
correct. **Non-goals.** Multi-process shared state; that is ADR-003 territory and out of scope.
**Acceptance.** Record a ban → restart → the same identity is still refused; the refusal is audited;
queue state is still ephemeral by design. **No dependencies.**

### F-014 — parking: operator UI · P1
**Problem.** The domain is complete, durable and tested; there is no surface an attendant can use.
**Scope.** Build the operator UI. **The eight existing screenshots already describe it** — treat them
as the acceptance criteria, and this time commit the code. **Non-goals.** On-device OCR (abstract port
today); a QRIS provider adapter. **Acceptance.** Start shift → check in → inspect → checkout → fee →
cash payment → close, end to end in a browser, surviving a restart, with the audit chain intact.
**No dependencies** — this is the most immediately valuable feature in the plan, because the hardest
part is already done.

### F-015 — manga: one test runner · P1
**Problem.** `npm test` runs two files with `node --test`; `progress.test.ts` imports from `vitest` and
never runs. **Scope.** Pick one runner; make the progress suite part of the default command.
**Non-goals.** Writing the missing assertions. **Acceptance.** `npm test` discovers every file under
`tests/`, exit 0, and the progress suite's tests are reported as executed.

### F-016 — workspace: restore the CI gates · P1
**Problem.** Lint runs for one project of five; no project except yomi has a database job; a claim
checker passes while three P0s sit in `main`. **Scope.** Per-project `lint` (so one project's missing
dependency cannot disable another's gate); a PostgreSQL service job for majelishub and homeops;
extend `check-claims.mjs` to status and test-count claims. **Non-goals.** Fixing the violations
themselves — that is F-002, F-005, F-006. **Acceptance.** A deliberate boundary violation in each
project turns its own CI job red.

### F-017 — manga: durable user, session and progress store · P2
**Problem.** Sessions are in memory; progress is a JSON file; resume is single-machine.
**Scope.** The PostgreSQL store `ARCHITECTURE.md` already specifies. **Non-goals.** Upload, image
processing, search. **Acceptance.** Sign in on one browser, read, sign out; sign in on another;
progress is present. **Depends on** F-015.

### F-018 — homeops: design system and lint cleanup · P2
**Problem.** Every page uses inline `style={{}}`; 30 lint errors, 6 from the project's own
`homeops/boundaries` rule, never enforced. **Scope.** Tokens per `src/app/styles/README.md`;
the remaining boundary errors; enable `check-contrast` in CI. **Non-goals.** Redesigning flows.
**Depends on** F-002** — do it last, because it touches every page and must not compete with the
security work for review attention. **Acceptance.** `npm run lint` exits 0; every component colour
resolves to a token; contrast is measured.

### F-019 — homeops: integration harness that provisions a database · P1
**Problem.** `npm run test:integration` exits 0 with 15 tests skipped. A green CI that proves nothing
about persistence. **Scope.** Make the harness provision or locate a real PostgreSQL, the way
majelishub's `F-007` will; fail rather than skip when none is available. **Non-goals.** The tests
themselves. **Acceptance.** `npm run test:integration` runs 15 tests and reports pass or fail, never
skip. **No code dependencies** — but land it before claiming F-002 or F-003 is proved.

### F-020 — workspace: documentation canonicalisation · P1
**Problem.** Seven projects' status documents contradict their code; the root matrix answers
"unknown" while occupying the position of an answer. **Scope.** Exactly the reconciliation in
`AUDIT_2026-09-28/DOCUMENTATION_RECONCILIATION.md` — KEEP / UPDATE / ARCHIVE / DELETE per document.
**Non-goals.** Rewriting the specifications, which are good. **Acceptance.** For every document listed
in that file, the action is taken; the six canonical sources in that file's header are the only
places a reader is sent for status. **Depends on** F-016.
