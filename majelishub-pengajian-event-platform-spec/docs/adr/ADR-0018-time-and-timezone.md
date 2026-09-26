# ADR-0018 — UTC storage, venue-timezone display, prayer-relative times as a distinct type

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, Domain, UX
- Requirements affected: FR-EVENT-003, FR-MOSQUE-008, NFR-I18N-002/004, FR-PROGRAM-007
- Related: `GLOSSARY.md` §Time, `docs/product/PROGRAMS.md`

## Context

Kajian happen at prayer-relative times: "ba'da Subuh", "ba'da Maghrib", "setelah Isya". Prayer
times shift daily by minutes and seasonally by ~45 minutes. Indonesia spans three time zones
(WIB/WITA/WIT) — the user is in West Sumatra (WIB, `Asia/Jakarta`). Attendees may move between
zones; speakers travel; diaspora deployments exist.

Bugs in this area are user-visible and trust-destroying: a participant arriving an hour late
because the app converted a time wrongly will not return.

## Decision

1. **Storage:** all instants are `timestamptz` in **UTC**.
2. **Every event carries the venue's IANA timezone** (`Asia/Jakarta`, `Asia/Makassar`,
   `Asia/Jayapura`, …). Display always renders in the **venue** timezone with a timezone label
   (`WIB`/`WITA`/`WIT`), not the viewer's — because the event happens at the mosque.
   A viewer in another timezone sees a secondary line only when their zone differs.
3. **Prayer-relative times are a first-class value type**, not a string:
   `{ anchorPrayer: PrayerName, offsetMinutes: number, direction: 'AFTER' | 'BEFORE' }`.
   Stored on events/programs as `startTimeMode: 'ABSOLUTE' | 'PRAYER_RELATIVE'` with the
   corresponding payload.
4. **Conversion is optional and never fabricated.** A prayer-relative event displays as
   "Ba'da Subuh (± 05.15)" **only** when a prayer-time source is configured for that mosque
   (deployment setting, per-locality table). Without a source, the app displays the
   prayer-relative label and an explicit "perkiraan" marker, or an organizer-provided absolute
   estimate that is marked as an estimate. **The system never invents a prayer time.**
5. **Reminders** for prayer-relative events are sent relative to the resolved absolute time
   when available; otherwise they are sent as a fixed offset from the *estimated* time with the
   estimate shown in the message (`"sekitar 05.15"`).
6. **Recurrence** is computed in the venue timezone, so a weekly 06:00 WIB kajian stays 06:00
   WIB across DST-free Indonesia and across any future DST locale correctly
   (`docs/product/PROGRAMS.md` §Recurrence).
7. **Date boundaries** for "today/this week" lists are computed in the venue timezone; the UI
   can say "Hari ini" unambiguously.

## Alternatives considered

- **Store local time as a naive timestamp.** *Costs:* breaks the moment the timezone database
  updates or events cross zones; makes correct reminders impossible. *Rejected.*
- **Store only UTC and display in viewer's timezone.** *Costs:* a participant travelling sees a
  misleading time; the venue is the ground truth. *Rejected* as the primary display rule.
- **Store prayer names only ("ba'da Subuh").** *Costs:* cannot sort, remind or calendar-export;
  cannot show the kajian in a list by time. *Rejected as the only representation.*
- **Hard-code prayer times by city.** *Costs:* maintenance burden, drift, and religious
  sensitivity (calculation methods vary by community). *Rejected:* a configured source or an
  organizer-provided estimate only.
- **Use a third-party prayer-time API at runtime for every render.** *Costs:* an external
  dependency in a core display path, latency, and correctness questions. *OPTIONAL as a cached
  data source behind a port* (`PrayerTimeProvider`), never called inline in render.

## Consequences

**Positive:** unambiguous scheduling; reminder correctness; calendar export works; the
"approx." marker preserves honesty about uncertainty (`FR-ATTEND-006` philosophy applied to
time).

**Negative:** two display modes to test; a deployment without a prayer-time source has a
slightly degraded (but honest) experience; storing both modes adds a discriminator that every
consumer must handle (mitigated by a single `resolveEventTime(event, prayerTimeSource)` domain
function).

**Neutral:** the timezone catalogue is derived from the IANA tz database in the runtime image,
which must be kept current (image update task).

## Enforcement

- `timestamptz` (never `timestamp`) in the schema; a schema lint test asserts no naive
  time columns exist.
- A test asserts that a resolved prayer-relative time without a source yields an estimate marked
  `isEstimate: true` and never a bare clock time.
- A test asserts display uses the venue timezone when the viewer's timezone differs.
- All time reads go through an injected `Clock` (no `new Date()` in domain code) so tests are
  deterministic.

## Revisit trigger

Reopen if: a deployment requires per-mosque prayer calculation *methods* (madhab-specific
angles) — then extend `PrayerTimeProvider` configuration rather than changing storage.
