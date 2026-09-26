# CONCURRENCY MODEL

Requirements: NFR-REL-003, NFR-PERF-004 · ADRs: ADR-0015 (idempotency), ADR-0025 (attendance
constraints) · Test catalogue: `docs/testing/CONCURRENCY-TESTS.md` (C1…C12)

---

## 1. The four places contention is real

| Place | Contentious resource | Failure if we get it wrong |
|---|---|---|
| Registration | The last seat of a capacity-limited event | Over-capacity, or a participant losing a seat they were promised |
| Check-in | One participant's attendance, two scanners | Duplicate attendance records (corrupted counts) |
| Uploads/processing | One session's chunk set / current asset | Duplicated or missing audio, "two masters" |
| Review/publication | One transcript revision | Lost edits, or machine text published |

Everything else (browsing, dashboards, feedback) is read-mostly and does not need exotic handling.

## 2. Mechanisms we use (and why nothing fancier)

1. **Database constraints are the last line of defence.** Unique indexes, partial unique indexes and
   CHECK constraints exist for every integrity rule (14 invariants in `DATA_MODEL.md` §11). Application
   logic can be wrong; a constraint cannot be bypassed by a code path.
2. **Conditional writes instead of read-then-write.** `INSERT … ON CONFLICT DO NOTHING RETURNING`, or
   `UPDATE … WHERE state = expected` with the row count checked. A "SELECT then decide then INSERT" is
   forbidden on these four paths — it is exactly the pattern that breaks under load.
3. **Short transactions, no human waiting inside them.** Nothing that takes longer than a few tens of
   milliseconds in the normal case (no network calls, no storage I/O inside a transaction that holds a
   counter).
4. **Row locks only where a decision spans several statements** (`SELECT … FOR UPDATE` on the attendance
   row during correction, on the registration during cancellation-vs-offer races).
5. **Advisory locks for singleton work** (assembly per session, retention per policy, aggregation per
   event) so a duplicated job cannot run twice concurrently.
6. **Idempotency keys** on every mutating API and job: the same intent retried produces one effect
   (`Idempotency-Key` header; `UNIQUE (dedupe_key)` for notifications; `(session, sequence)` for
   chunks).
7. **Optimistic concurrency** for documents edited by humans (transcript revisions): a version number
   plus `If-Match`; on conflict, a 409 with a diff — never a silent overwrite.

## 3. Explicitly rejected

| Mechanism | Why not |
|---|---|
| Application-level distributed locks (Redis) | Introduces infrastructure for a problem the database already solves; ADR-0010 keeps Redis out |
| Long-lived pessimistic locks on registrations | Would serialize the whole event's registration and make a busy launch slow for everyone |
| Event-sourced counters | Counts derived from rows are correct by construction; a counter is a cache that can be wrong |
| Queue-based serialization of check-ins | Adds latency exactly where latency is most visible (the entrance) |
| Optimistic retry loops without a constraint | Retries without a uniqueness guarantee can duplicate |
| `sleep()`-based race tests | Non-deterministic and misleading (see test guidance) |

## 4. Per-path concurrency decisions

| Path | Decision | Consequence to accept |
|---|---|---|
| Capacity | Conditional insert inside a transaction; over-capacity impossible; losers get `WAITLISTED` or a clear refusal | A tiny chance a participant sees "waitlist" when a seat frees a millisecond later — resolved by the offer flow |
| Duplicate check-in | Unique constraint + `ON CONFLICT DO NOTHING RETURNING`; second racer returns `ALREADY_CHECKED_IN` with the original time | One of the two scanners "did not really do it" — attributed by device/entrance so the count is honest |
| Walk-in convergence | Unique `(event, walk_in_ref)` plus contact-hash match | A genuinely new person with the same name and no contact could be merged — mitigated by requiring the operator to confirm |
| Chunk upload | Unique `(session, sequence)` + hash comparison | A changed chunk cannot be re-uploaded under the same sequence (409) — deliberate, so a tampered stream cannot overwrite good audio |
| Assembly/processing | Advisory lock per session + `is_current` partial unique | A retry leaves an old attempt row (kept for audit) |
| Notifications | `UNIQUE (dedupe_key)` on intents | Two facts that deserve two messages must have distinct keys — explicitly designed |
| Transcript edits | Optimistic version + `If-Match` | Reviewers must merge conflicts by hand; that is the point |
| Publication | Approval binds a revision; CHECK pairs `published_at` with `approved_by` | Re-approving an edited revision is required before the edit becomes public |
| Retention | Batched deletes with row locks, skips rows under active edit | A user action may fail with `NOT_FOUND` if deletion won (C12) — acceptable and documented |

## 5. Reading the rules as an implementer

When you touch a concurrency-sensitive path:

1. Name the case (C1…C12) in the PR description.
2. Show which mechanism from §2 you are relying on, and prove it at the **database** layer in a test.
3. Assert invariants (row counts, single effect, correct loser outcome), never timing.
4. Ensure the loser receives a **defined, user-comprehensible** result — a 500 is a bug in the design.
5. Re-run the relevant load test if the change affects check-in, registration or upload (`T-PERF-001`).
