# CONTRIBUTING

MajelisHub is built for volunteer-run mosques. Contributions are judged first on whether
they make the system **easier to operate**, then on elegance.

## Before you write code

1. Read `AGENTS.md` — it defines the mandatory 10-step workflow for any change.
2. Find the `TASKS.md` entry you are implementing. **If there is no task, write one first**
   (with requirement IDs, invariants, race conditions, tests, DoD).
3. Read the requirement IDs in that task (`PRD.md`), then the product doc, then the
   relevant ADR(s), then `SECURITY.md`/`PRIVACY.md` implications.
4. Inspect the existing port/DTO you are going to implement. Extend the contract **before**
   the implementation.
5. If you discover a rule that no document states, **stop**: add it to the correct document
   or ADR first, then implement.

## Branch, commit and PR rules

- Branch: `vs<slice>-<task-id>-<slug>` e.g. `vs4-t-checkin-014-record-check-in`.
- One task per PR. Skeleton/contract changes may accompany their implementation.
- Commits are conventional, task-referenced:
  `feat(checkin): T-CHECKIN-014 record attendance [FR-CHECKIN-004, FR-ATTEND-001]`
- PR description must state: task ID, requirement IDs, ADRs touched, **invariants
  preserved**, failure modes considered, race conditions considered, privacy/security
  impact, and the manual QA section of `QA.md` you executed.
- A PR that adds a dependency must justify it against §19 of `docs/research/STACK-2026.md`
  ("removes more code than it adds, or removes an operational risk").

## Hard rules (violating these blocks a PR, no discussion needed)

1. **No PII in QR payloads.** Only an opaque check-in token may be encoded.
2. **No machine transcript can be published.** Publication requires a human `APPROVED`
   revision and a recorded reviewer identity.
3. **No silent correction of religious text.** Qur'anic verses, hadith and Arabic phrases
   are preserved verbatim, may be flagged uncertain, and are never rewritten by automation.
4. **No audio/transcript content in logs, traces, metrics or error messages.**
5. **No cross-organization data access.** Every scoped query filters by `organization_id`
   and the check is enforced server-side, not in the UI.
6. **No fake implementations.** Unimplemented behaviour throws
   `Not implemented: <TASK-ID>`. A function that returns a plausible fake object is a bug of
   the worst kind: it makes tests pass for behaviour that does not exist.
7. **No ranking, popularity or authority scoring of speakers.** (`ADR-0024`)
8. **No new stateful service** without an ADR (`ARCHITECTURE.md` §Dependency rules).

## Language and tone

- Code, identifiers, comments, commits and documentation: **English**.
- User-facing copy: **Bahasa Indonesia** by default, structured for i18n
  (`NFR-I18N-*`). Never hard-code user-visible English strings in components.
- Tone in user-facing copy follows `DESIGN.md` §Voice: respect, brevity, no exclamation
  marks, no gamification, no marketing superlatives.

## Accessibility and mobile are not "later"

- WCAG 2.2 AA is the target (`ACCESSIBILITY.md`). Interactive targets ≥ 44×44 px.
- Every screen must be usable one-handed on a 360 px-wide viewport, on 3G, with the
  government-issued phone the volunteer actually owns.
- Every feature that uses a camera or microphone must have a **non-camera/non-microphone
  fallback** documented in its task.

## Testing expectations

- New behaviour ships with unit + integration tests; participant- and entrance-facing flows
  also need a Playwright test (`TESTING.md`).
- Concurrency-sensitive behaviour (check-in, attendance, chunk assembly, transcript edits)
  needs a documented concurrency test from `docs/testing/CONCURRENCY-TESTS.md`.
- Tests must be deterministic: no wall-clock dependence, no network, no ordering assumptions.
  Time is injected (`src/shared/time/clock.ts`).

## Documentation expectations

- Changing behaviour changes `PRD.md` (if a requirement moved), the product doc, and
  `docs/TRACEABILITY.md`.
- Adding/altering a decision requires an ADR (new file for new decisions, amendment
  section for changed ones). ADRs are immutable in substance: supersede, do not rewrite.
- Keep `TASKS.md` status current — it is the shared board.

## Reviewing

Reviewers check, in order: invariants, failure modes, races, privacy, accessibility,
operability, then style. A reviewer must be able to answer "what happens at 500 people in
the queue and the venue Wi-Fi dies?" from the PR text alone.
