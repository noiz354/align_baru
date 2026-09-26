# ADR-0007 — Offline check-in deferred; constraints fixed now

- Status: Accepted · Date: 2026-09-26 · Deciders: SRE, Principal Architect, UX
- Requirements affected: FR-CHECKIN-016 · Related: `docs/attendance/OFFLINE-EVALUATION.md`, ADR-0025

## Context

Mosque entrances sometimes have poor connectivity: basements, large concrete halls, crowded
cells. An obvious idea is offline check-in — cache the participant list in the browser and
record attendance locally, syncing later.

The requirement (`FR-CHECKIN-016`) mandates *graceful degradation*: never claim success when
nothing committed. It does **not** mandate offline capture.

Full evaluation: `docs/attendance/OFFLINE-EVALUATION.md`.

## Decision

**Do not implement offline check-in in the MVP or any Phase 0–13 slice.** Design constraints
that make it addable later without redesign:

1. Every check-in request carries a client-generated **`event_checkin_id` (UUIDv7)** and an
   idempotency key, so a late-delivered offline batch can be deduplicated server-side.
2. Attendance is keyed by `(event_id, registration_id)` uniqueness (ADR-0025) — the *database*
   is the conflict resolver, not the client.
3. The scanner already exposes "not yet confirmed" as a distinct state from "failed" and
   "succeeded" (`DESIGN.md` §Scanner UI) — the state machine has room for `PENDING_SYNC`.
4. Manual attendance correction with a reason exists (`FR-ATTEND-004`), which is the current,
   supported answer for offline periods.

When offline support is implemented (evidence-gated, see Revisit trigger), the client will
sync **records of attendance events**, never "the list of attendees", and the server will
resolve conflicts by first-write-wins on `checked_in_at` with a duplicate flag.

## Alternatives considered

- **Cache the whole registration list in the browser.** *Costs:* PII on an untrusted shared
  device; stale list; a volunteer's phone becoming a database; deletion requests impossible to
  honour. *Rejected outright.*
- **Queue scans locally and sync later (no list cache).** *Gains:* works for participants who
  brought their QR. *Costs:* duplicates if two offline devices scan the same person and the
  event allows duplicates; tokens cannot be validated offline (the hash is server-side); a
  stolen device could forge attendance; and capacity enforcement is impossible offline.
  *Deferred:* this is the recommended shape **if** implemented, with server-side conflict
  resolution and an explicit "pending sync" attestation on the attendance record.
- **Paper fallback + post-event entry.** *Costs:* manual data entry, transcription errors.
  *Kept as the current operational answer* — documented in `CHECKIN.md` §Manual fallback as the
  supported degraded mode, requiring no software work.
- **LAN-local server at the mosque.** *Costs:* a second deployment topology, sync protocol,
  and on-site tech support. *Rejected* for this product's operators.

## Consequences

**Positive:** no false-attendance risk; no PII cached on volunteer devices; no conflict
resolution complexity in v1; the degraded path (manual correction) is auditable.

**Negative:** a genuine 45-minute connectivity outage means attendees are not scanned in real
time — the operator must use paper or name search, and attendance is reconciled afterwards.

**Neutral:** the design constraints above are cheap now and preserve the option.

## Enforcement

- `event_checkin_id` and idempotency keys are required fields in the check-in API contract from
  day one (`src/shared/contracts/checkin.ts`).
- The scanner UI must never render a success state without a server-confirmed response
  (`NFR-REL-002`), asserted by a Playwright test with a forced offline condition.
- No caching of the registration list in browser storage is permitted; a review checklist item
  and a security test assert that no participant list is written to `localStorage`/IndexedDB.

## Revisit trigger

Reopen when a real deployment reports **repeated, documented** connectivity failures at the
entrance (≥ 3 events affected, ≥ 10 minutes each, affecting ≥ 20% of arrivals). Then build the
queue-and-sync shape with server-side dedupe, starting with a pilot on one mosque.
