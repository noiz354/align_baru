# ADR-0025 — Attendance integrity enforced by database constraints and idempotency

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, Security, QA
- Requirements affected: FR-ATTEND-001/002, FR-CHECKIN-004/008/009, NFR-REL-002/003
- Related: ADR-0003, ADR-0006, `docs/architecture/CONCURRENCY.md`, `ATTENDANCE.md`

## Context

Attendance is the number an organizer reports and plans with, and the record that answers "was
this person here?". Failure modes observed in comparable systems:

- A double-tap or a retried request creates two attendance records.
- Two scanners at two entrances both insert for the same person and both "succeed".
- A walk-in is registered twice because two volunteers act simultaneously.
- A cancelled registration is quietly checked in, or a checked-in one is quietly cancelled.
- A "count" column drifts from the rows it counts and nobody can reconcile it.

The path is high-frequency (hundreds of scans in minutes), concurrent (multiple devices), and
sometimes retried by mobile networks (duplicate POSTs are normal, not exceptional).

## Decision

Make attendance integrity a **database** property, not an application convention:

1. **`attendance_records` uniqueness:**
   - `UNIQUE (event_id, registration_id)` — one attendance per registration
   - A second partial unique constraint for walk-ins: `UNIQUE (event_id, walk_in_ref)` where
     `walk_in_ref` is a deterministic identity created at the entrance
     (e.g. `walkin:{eventId}:{clientGeneratedUuid}` or phone-normalised hash when the volunteer
     supplies a contact, so two volunteers entering the same phone number converge).
2. **Insert semantics:** `INSERT … ON CONFLICT DO NOTHING RETURNING id`. If the insert returns
   no row, the operation is a **duplicate**: the service loads the existing record and returns
   `ALREADY_CHECKED_IN` with `checked_in_at` — and **no error**, because the entrance must keep
   moving (`DESIGN.md` §Scanner UI "Already" state).
3. **Idempotency:** every check-in request carries an `Idempotency-Key` and a client-generated
   `event_checkin_id` (UUIDv7). A replay of the same key returns the original result without
   re-evaluating side effects (no duplicate outbox events, no duplicate notifications).
4. **State coupling:** check-in is only permitted from `REGISTERED`; a cancelled registration
   yields `REGISTRATION_CANCELLED` (with the manual path offered). Cancelling after check-in is
   **forbidden** (the attendance fact is durable; correction is a separate, audited operation
   with a reason — `FR-ATTEND-004`).
5. **No stored counters.** Attendance totals are derived by query (`COUNT` by status) or by a
   materialised summary that is recomputable. A denormalised counter, if ever added for
   dashboard speed, must be rebuildable from the rows and reconciled by a scheduled job.
6. **Event and window guards:** check-in requires the event to be in a permitted state
   (`SCHEDULED`/`REGISTRATION_OPEN`/`IN_PROGRESS`, or within an explicit grace window) and the
   registration to belong to that event — verified in the same transaction as the insert.
7. **Two-phase honesty:** the API returns `COMMITTED` only after a successful database
   transaction. `PENDING` states exist only on the client's own request lifecycle
   (`NFR-REL-002`).
8. **Walk-in convergence:** a walk-in insert with the same `walk_in_ref` collides and returns
   the existing record (`CONCURRENCY` C5).
9. **Audit:** the check-in is recorded with `actor_id` (operator), `device_label`, `entrance_id`,
   and `checked_in_at`; manual corrections carry a reason (`FR-AUDIT-003`).

## Alternatives considered

- **Application-level "check if exists, then insert".** *Costs:* a race window between the check
  and the insert that duplicates under exactly the conditions we must survive (two scanners,
  retrying networks). *Rejected.*
- **Advisory locks per registration.** *Gains:* serialisation. *Costs:* coordination overhead on
  the hottest path, and it does not help across connections/instances as cleanly as a unique
  constraint; also more code to get wrong. *Rejected* in favour of the constraint.
- **Serialisable transactions for the entrance.** *Costs:* retries and latency on the path with
  the tightest budget (`NFR-PERF-004`); unnecessary when a unique index gives correctness in one
  statement. *Rejected.*
- **Store attendance as a count per event (with a list only for registered participants).**
  *Costs:* loses per-person facts (needed for corrections, disputes, `NO_SHOW` derivation), and
  walk-ins vanish into a number. *Rejected.*
- **Soft-delete duplicates instead of preventing them.** *Costs:* the entrance would show success
  for a record later removed; the number becomes unreliable. *Rejected:* prevent, do not clean up.
- **Treat a duplicate scan as an error for the operator.** *Costs:* it is common, benign, and
  blocking; an error state trains operators to ignore errors. *Rejected:* it is a distinct
  non-blocking state.

## Consequences

**Positive:** duplicate attendance is structurally impossible; the entrance stays fast under
concurrency; retries are safe; totals are always reconcilable to rows; audit tells the whole
story of who recorded what.

**Negative:** a constraint violation must be handled as a *normal* outcome in code (a small
discipline cost); the walk-in identity rule requires the client to generate stable ids
(documented in the API contract); correcting a genuine mistake requires the correction path
rather than deleting a row.

**Neutral:** the `attendance_records` table is the source of truth for `NO_SHOW` derivation
(`ATTENDANCE.md` §Derivation) and for exports; it carries `organization_id` for scoping (ADR-0017).

## Enforcement

- Migration includes the unique constraints; a test asserts a raw duplicate insert fails.
- A concurrency test issues N parallel check-ins for the same registration from simulated
  devices and asserts exactly one record and N-1 `ALREADY_CHECKED_IN` results
  (`docs/testing/CONCURRENCY-TESTS.md` C2).
- A test asserts that a repeated request with the same `Idempotency-Key` produces no second
  domain event in the outbox.
- A test asserts cancelling a checked-in registration is rejected with a specific error code.
- A reconciliation job (VS-5) asserts derived counts equal row counts and alerts on mismatch.

## Revisit trigger

Reopen only if the constraint becomes a demonstrated performance bottleneck at the entrance
(measured p95 above budget with index present) — in which case the answer is partitioning or a
dedicated index strategy, **never** removing the uniqueness guarantee.
