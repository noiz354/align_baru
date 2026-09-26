# Test Data Strategy

> Companion to TESTING.md (layers, risk map, naming), QA.md (manual scenarios), PRIVACY.md §2 (data inventory).
> Rule zero: **test and seed data is synthetic.** Real household data — even the author's own — never enters a test fixture, a seed script, a screenshot, or an error report.

## 1. Why this file exists

HomeOps has three properties that make test data a design problem rather than an afterthought:

1. **Time matters** (recurrence, DST, quiet hours, lead times) — fixtures must control the clock, never wait for it.
2. **Isolation matters** (every query is household-scoped) — a second household in the fixture set is not decoration; it is the control group that proves isolation.
3. **Privacy matters** — fixtures become screenshots, failure artifacts, and CI logs; they must contain nothing worth protecting.

## 2. Fixture households

| Fixture | Purpose | Composition |
| --- | --- | --- |
| `HH_MAIN` | The default household for feature tests | Timezone `Asia/Jakarta`; OWNER Sari, ADMIN Budi, MEMBER Dita, HELPER Andi |
| `HH_CONTROL` | Isolation control group | Different timezone (`America/New_York`), different names, *similar-looking* data (same chore titles, same container names) so a leak is detectable by content too |
| `HH_WIDTH` | Timezone/DST suite | Timezone `Europe/Berlin` (DST both directions), plus a variant `Pacific/Auckland` for the southern hemisphere in the same test file |
| `HH_EMPTY` | Empty-state and onboarding tests | Household created, no rooms, chores, resources, or activity |
| `HH_BUSY` | Alert-fatigue and pagination stress | ~200 open occurrences, 50 low resources, 25 containers, 3 years of activity |

Composition rules: 3–5 members per fixture (enough for role fallback and away-skipping, small enough to reason about) · exactly one OWNER, at least one ADMIN, one HELPER where permissions matter · one member marked away during the relevant window in notification suites · no member is named after a real person known to the team.

## 3. Deterministic time

| Concern | Approach |
| --- | --- |
| Clock | Injected `Clock` port everywhere (I-XA-005). Tests pass a fixed `Now` in the household's zone; **no test may call `new Date()` or sleep** |
| Timers | No real timers: the scheduler is invoked explicitly (`runJob(job, ctx, now)`), never scheduled in tests |
| DST fixtures | Named instants, e.g. `BERLIN_DST_FORWARD_02_30`, `BERLIN_DST_BACK_01_30`, `AUCKLAND_DST_BACK`, `JAKARTA_NO_DST` — each documented with the expected wall-clock meaning |
| "Today" | Always derived through the household-day helper, so a fixture states a *local* day and the test asserts on local semantics |
| Time advance | Tests advance the clock explicitly (`clock.set('2026-10-04T00:30:00+07:00')`), never by sleeping |

## 4. Factories

Small, composable, and *explicit about defaults* — a factory that hides its defaults produces tests nobody can read.

```ts
// tests/factories/index.ts (contract sketch — implemented in T-PLAT-016's orbit)
household({ name?, timezone? })         // defaults: HH_MAIN, Asia/Jakarta
member({ role?, awayUntil?, displayName? })
room({ name?, statusOverride? })
choreDefinition({ recurrence?, room?, assignee?, priority? })
choreOccurrence({ status?, dueAt?, definition? })
trashContainer({ state?, schedule?, assignee? })
resource({ mode?, level?, target? })
maintenancePlan({ frequency?, leadTime?, lastRecordAt? })
issue({ severity?, status?, assignee? })
alert({ type?, priority?, state?, dedupeKey?, recipient? })
activityEvent({ type?, actorId?, entityRef? })
attachment({ mimeType?, sizeBytes?, exif?: true })
```

Rules: factories return **valid** entities by default and take overrides only for what a test cares about · factories never write to a database directly (they build domain objects; persistence is the integration layer's job) · a factory default that a test relies on must be asserted at least once (otherwise the default silently changes behaviour across the suite) · no factory inlines expectations (no "expectedStatus" fields).

## 5. Fixtures by layer

| Layer | Data approach |
| --- | --- |
| Unit (domain, policy, recurrence) | Plain objects from factories; in-memory repositories for ports; no database, no filesystem, no clock |
| Integration (repositories, transactions, jobs) | A **scratch database per worker** with migrations applied once and truncation between tests; a single transaction rollback per test where the operation permits it (job tests need real commits) |
| Component (React) | Factory-built DTOs; fixtures for all four display states (normal, empty, loading, stale) |
| E2E (Playwright) | The full seed dataset (`scripts/seed.ts`, T-PLAT-018) applied to a fresh database before the run; tests then create their own entities with unique names |
| Manual QA (QA.md) | The same seed dataset on a staging instance so the scenarios in QA.md are reproducible by anyone |

## 6. In-memory test doubles

Every repository port has one in-memory implementation used by unit tests. Properties that make them trustworthy rather than convenient:

- They enforce household scoping (a `findById` with a foreign household returns `null`) so isolation bugs are visible at the unit layer too.
- They enforce the same uniqueness rules as the database (dedupe keys, one open occurrence) — a double that is more permissive than production teaches the wrong lesson.
- They record their calls, so tests can assert "no write happened" (the key assertion for alert dedupe and idempotency).
- They are **not** a substitute for the database: every repository also has a real integration test against Postgres. A behaviour only tested against the double is a behaviour that is not tested.

## 7. Isolation fixtures (negative tests are only as good as their data)

| Fixture | Purpose |
| --- | --- |
| Same titles/names in `HH_MAIN` and `HH_CONTROL` | Proves a leaked query returns wrong *content*, not just a wrong id |
| A child entity in `HH_CONTROL` whose id is passed as a foreign child of a `HH_MAIN` parent | Proves nested scoping (comments, records, attachments, occurrences) |
| A removed member with historical activity in `HH_MAIN` | Proves history survives removal and access does not (T-MEM-004) |
| An attachment owned by `HH_CONTROL` | Proves the serving route scopes by the owning entity |
| A job run with both households present | Proves jobs never leak across households (T-SEC-002) |

The isolation sweep (T-SEC-002) is written as a table over every repository port × these fixtures; a new port must add rows or the sweep fails by construction.

## 8. Photos and attachments

| Fixture | Notes |
| --- | --- |
| `photo-with-gps-exif.jpg` | 1×1 px JPEG containing EXIF GPS tags — the EXIF-stripping assertion |
| `photo-plain.png` | Valid PNG for happy paths |
| `photo-huge.jpg` | > 5 MB, generated at test setup (never committed) |
| `file-renamed.jpg` | A text file renamed to `.jpg` — must be rejected by content sniffing |
| `script.svg` | SVG with an inline script — must be rejected (not on the allow-list) |

Committed fixtures are tiny and synthetic. Large fixtures are generated in the test, so the repository stays small and no binary blob is ever "the reason" a test passes.

## 9. Prohibited in test data

| Prohibited | Why |
| --- | --- |
| Real names, emails, phone numbers, addresses | Privacy; fixtures end up in CI logs and screenshots |
| Real photos, even of empty rooms | Same reason, plus the EXIF trap |
| Real household data pasted into a bug report | PRIVACY.md §5 — bug reports carry ids and codes, not content |
| Production database dumps | Never. A sanitised dump is still a dump |
| Third-party personal data (a landlord, a neighbour) | Same |
| Secrets in fixtures (tokens, keys) | Use obviously fake values (`test-session-secret-not-a-secret`) |
| Test data referencing a real vendor/technician | Vendor notes in fixtures are fictional ("Pak Andi" style invented names are fine; a real business is not) |

## 10. Lifecycle and hygiene

| Concern | Rule |
| --- | --- |
| Scratch databases | Created per CI worker (`homeops_test_<worker>`), dropped at the end of the run |
| Truncation | Between tests, truncate (or roll back) in dependency order; never rely on "the next test will overwrite it" |
| Parallelism | Tests must not share entities unless the fixture is read-only; unique names come from a per-test prefix |
| Flakiness | A test that depends on wall-clock timing or ordering is a defect; fix the test, not the timeout |
| Seeds | `scripts/seed.ts` is idempotent and refuses to run against a database whose name does not contain `dev` or `test` |
| Screenshots/videos from E2E | Retained for failures only, and only with fixture data on screen (never a real household instance) |

## 11. Seed dataset (development & manual QA)

The seed creates `HH_MAIN` with a week of realistic, deliberately varied data: two rooms dirty, one clean, one unknown; a recurring chore overdue and one due today; a bin full and one almost full; three resources low; a maintenance plan due in 4 days; one SAFETY issue; a snoozed alert and an acknowledged alert. The point is that a developer can see *every state the product can be in* within one screen of scrolling — an empty app teaches nothing, and a perfectly clean app hides the interesting paths (T-PLAT-018).

## 12. What to do when a fixture is missing

1. Add it as a factory override in the test that needs it, not as a new global fixture.
2. If two tests need the same override, promote it to the factories file with a comment naming both tests.
3. If a fixture needs a real database row in a specific order, that ordering belongs in the integration test — not in the global seed.
