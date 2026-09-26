# CONCURRENCY CASES

Every case below is a real-world race that must converge to a defined outcome. Implementations must
address them **intentionally**; tests must assert the invariant, not the timing.

| ID | Case | Invariant | Mechanism | Test |
|---|---|---|---|---|
| C1 | Capacity race: two registrations for the last seat | Exactly one `REGISTERED`; the other is `WAITLISTED` or rejected with an explanation; capacity never exceeded | Conditional insert inside a transaction (count + insert), unique partial index as backstop | `tests/integration/registration/capacity-race.test.ts` — 50 parallel submissions, assert counts |
| C2 | Two scanners scan the same QR concurrently | Exactly one attendance record; the other result is `ALREADY_CHECKED_IN` with the first scan's time | `UNIQUE (event_id, registration_id)` + `INSERT … ON CONFLICT DO NOTHING RETURNING` | `tests/integration/attendance/duplicate-scan.test.ts` — N parallel validations |
| C3 | Participant cancels while a seat offer/check-in is in flight | Either the cancellation wins (offer created for the next person) or the check-in wins (cancellation refused) — never both | Single transaction per operation; state guard on `REGISTERED`; attendance existence check inside the cancellation transaction | `tests/integration/registration/cancel-vs-checkin.test.ts` |
| C4 | Two volunteers register the same walk-in simultaneously | One attendance record; the second receives the existing record | `UNIQUE (event_id, walk_in_ref)` (+ contact-hash convergence) | `tests/integration/attendance/walkin-convergence.test.ts` |
| C5 | Two organizers correct attendance at the same time | Last-writer-wins on the *correction* is not acceptable: the second correction must see the current state (row lock) and record its own justification | `SELECT … FOR UPDATE` on the attendance row; corrections are append-only rows | `tests/integration/attendance/correction-race.test.ts` |
| C6 | Two transcript reviewers edit from the same base version | One save succeeds; the other gets `409 CONFLICT` with a diff; **no silent overwrite, no lost edits** | Optimistic concurrency on `transcripts.version` + `If-Match` | `tests/integration/transcription/revision-conflict.test.ts` |
| C7 | Recording chunks arrive out of order | Assembly is sequence-based; ordering is reconstructed regardless of arrival order | Chunk rows keyed by `(session, sequence)`; assembly sorts by sequence | `tests/integration/media/assembly-out-of-order.test.ts` |
| C8 | The same chunk is uploaded twice | Idempotent: identical hash → success with no change; different hash → `409` | `UNIQUE (session_id, sequence)` + hash comparison | `tests/integration/media/chunk-idempotency.test.ts` |
| C9 | Transcription callback is delivered twice | One draft transcript; the second callback is a no-op returning the existing job state | Idempotency on `(providerJobId, event)`; partial unique on in-flight jobs per asset | `tests/integration/transcription/callback-replay.test.ts` |
| C10 | Notification intent created twice for the same fact | Exactly one delivery per `dedupe_key` | `UNIQUE (dedupe_key)` on `notification_intents` | `tests/integration/notifications/dedupe.test.ts` |
| C11 | Two workers run the same job (worker restart/overlap) | Job side effects are idempotent; assembly/processing produce one current asset | `SKIP LOCKED` claiming + singleton job keys + `is_current` partial unique | `tests/integration/jobs/duplicate-execution.test.ts` |
| C12 | Retention run overlaps with a user action on the same row | The user action either completes first (then retention jumps it) or the row is deleted (then the action fails cleanly with `NOT_FOUND`) | Batched deletion with row locks; no long transactions | `tests/integration/retention/overlap.test.ts` |

## Writing guidance

1. **Do not test timing.** Assert row counts, returned results and state. Timing assertions belong in
   `PERFORMANCE.md` budgets, not here.
2. **Use deterministic interleaving.** Prefer explicit coordination (advisory locks, test hooks,
   promise gates) over `setTimeout`-based races; a flaky race test trains people to ignore failures.
3. **Assert the loser.** For every race, the losing request must have a **defined, user-comprehensible
   outcome** (a specific error code or state), not a generic 500.
4. **Test at the database layer too.** Constraints are the last line of defence; a service-level test
   alone does not prove the invariant survives a code path that bypasses the service.
5. **Reference the case ID in the PR** that touches the related path (checklist item in
   `CONTRIBUTING.md`).
