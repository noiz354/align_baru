# TEST STRATEGY — EXTENDED NOTES

Companion to `TESTING.md` (the authoritative strategy). This file holds the detail that would make
`TESTING.md` too long to read: heuristics, trade-offs, and the reasoning behind what we do **not** test.

---

## 1. Testing philosophy, made concrete

| Principle | What it forbids | What it requires |
|---|---|---|
| Test the risk, not the ratio | A 100% coverage badge on a form while attendance concurrency is untested | A named test for every C-case and every state machine |
| Lowest expressive layer | Testing a database constraint through the UI | Constraint tests against Postgres directly |
| No lying tests | Mocking the thing under test | Real Postgres for integrity; recorded fixtures for providers |
| Determinism | `sleep()`, ordering assumptions, shared mutable fixtures | Injected clock, seeded ids, isolated schemas |
| Failure is a feature | Testing only happy paths | Every documented failure case has a test or an explicit, reasoned exclusion |

## 2. What we deliberately do not test (with reasons)

| Not tested | Reason | Residual risk handling |
|---|---|---|
| Vendors' internal behaviour | Not ours to test | Adapter contract tests + failure fixtures + runbook |
| Every device/browser combination | Combinatorial explosion | Documented support matrix + real-device manual QA (QA-01/02) |
| Pixel-perfect layout everywhere | Nobody is harmed by 4 px drift | Visual baselines only for safety-critical layouts (check-in results, recorder states, Arabic rendering) |
| Load beyond 3× the largest supported deployment | Premature scale work is an anti-goal | Documented capacity assumptions + a growth trigger list (`OPERATIONS.md` §8) |
| LLM/ASR output quality | It is not a correctness property we control | Human review gate (ADR-0012) + uncertainty markers |
| Generated migration SQL correctness beyond applying it | Human review + rehearsing on a production-shaped copy is stronger | Migration rehearsal task (T-OPS-005) |
| Offline synchronisation | Deferred by ADR-0007 | Paper fallback specified and drilled |
| Cryptography implementations | We use platform primitives | Prefer standard libraries (SHA-256, CSPRNG); no custom crypto |

## 3. Test data principles (see `docs/testing/TEST-DATA.md` for the catalogue)

1. Synthetic identities only, with a clearly fake domain/prefix.
2. Arabic/code-switching fixtures are first-class — testing transcripts without them is theatre.
3. Fixtures live in the repository and are reviewed like code; large media is generated, not committed.
4. Time is fixed and timezones are exercised deliberately (including a DST locale).
5. No production data, ever — not "anonymised", not "just the names".

## 4. Test quality rules

1. A test name states the **behaviour**, not the implementation: `returns ALREADY_CHECKED_IN with the
   original time without creating a second record`, not `calls insert twice`.
2. Failure-mode tests assert the *user-visible* outcome (a specific error code and message shape), not
   just the absence of an exception.
3. No test depends on another test's side effects; every suite can run alone.
4. Flaky tests are quarantined with an issue link and fixed within a sprint; a flaky
   security/attendance test blocks the release until fixed (it is a symptom of a real race).
5. Assertions cover the invariant (row counts, single effect), not internal call sequences.
6. Where a rule is enforced in several layers (domain + service + API + database), each layer gets its
   own test — that redundancy is intentional for the publication gate and attendance constraints.

## 5. Mapping risk to coverage intensity

| Area | Intensity | Rationale |
|---|---|---|
| Attendance integrity | Exhaustive (including load) | Rank-1 consequence |
| Audio capture/upload | High (E2E with induced failures) | Rank-2: irreplaceable content |
| Publication gate | Exhaustive at four layers | Rank-3: misquotation is unfixable |
| Tenancy/permissions | Exhaustive, generated from the matrix | Rank-4 + broad blast radius |
| Check-in UX latency | Measured, with budgets | Visible failure in a crowd |
| Registration | High (concurrency C1 + abuse) | Fairness and capacity honesty |
| Notifications | Moderate (dedupe, tokens, quiet hours) | Recoverable, but token leakage is not |
| Feedback | Moderate (anonymity constraints are high) | Privacy promise |
| Dashboards/archive | Light | Recoverable |
| Docs/lint gates | Automated, cheap | Prevent drift that misleads future agents |

## 6. TDD note and ordering

For concurrency-sensitive paths, write the failing constraint test first (it defines the invariant). For
UI work, start from the accessibility expectations (`ACCESSIBILITY.md`) because retrofitting them is
expensive. For everything else, normal order is fine.

## 7. Release-blocking test outcomes (no exceptions)

1. Any duplicate attendance record.
2. Any path where a success state can be shown without a committed write.
3. Any machine draft reachable publicly without an approval row.
4. Any cross-organization data exposure.
5. Any token value present in logs, traces or metrics.
6. Any published item still reachable after an unpublish (search or direct link).
7. Any encrypted-at-rest or signed-URL regression beyond the documented TTL.

## 8. Continuous improvement loop

After every incident or QA drill: add the test that would have caught it, or record why a test is
impossible and add a **detection** instead (metric/alert). Post-mortems feed `TESTING.md` §3 minimums —
if a whole class of bug keeps slipping through, the mapping, not the individual test, is what changes.
