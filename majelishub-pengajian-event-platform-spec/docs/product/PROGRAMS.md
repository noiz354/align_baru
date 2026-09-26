# PRODUCT SPECIFICATION — PROGRAMS AND RECURRENCE

Requirements: FR-PROGRAM-001…007 · ADR: ADR-0018 · Related: `STATE_MACHINE.md`, `docs/product/EVENTS.md`

---

## 1. Program vs Event (the distinction the whole model rests on)

| | Kajian **Program** | Kajian **Event** |
|---|---|---|
| Definition | A recurring commitment: topic, place, rhythm | One occasion with a date, a speaker and a registration |
| Example | "Kajian Ba'da Subuh" — every Sunday after Subuh, Masjid Al-Hikmah, Aula Utama | "Kajian Ba'da Subuh, Sunday 11 Oct 2026, Ustadz Abdurrahman, tema *Adab Menuntut Ilmu*" |
| Lifetime | Months to decades | One day (or a short series) |
| Participants register for | **Events**, never programs | The event |
| Attendance exists for | **Events** | The event |
| Audio/transcripts belong to | **Events** (program is metadata) | The event |
| Cancel meaning | "This week is cancelled" (exception) | The event is cancelled (state) |

Everything that a participant does — find, register, get a code, check in, listen, review, give
feedback — is per event. The program is how organizers manage a rhythm without re-typing it every week.

## 2. Program fields

| Field | Notes |
|---|---|
| Title | "Kajian Ba'da Subuh" |
| Mosque + venue | Default place; an event may override the venue (e.g. moved to Aula for a big night) |
| Recurrence | weekly (with weekday), monthly (nth weekday), daily-series, custom interval, or manual |
| Time basis | Fixed clock time **or** prayer-relative ("ba'da Subuh", "ba'da Maghrib") with a configured offset |
| Default speaker | Optional; requires per-occurrence confirmation |
| Topic themes | Optional rotation ("tafsir", "fiqih", "sirah") used to prefill event titles |
| Registration defaults | Mode, capacity, collection window |
| Recording/publishing defaults | Policy template (audio only, audio+transcript, internal only) |
| Visible-from | How far ahead events are published (e.g. 30 days) |
| Exception dates | Holidays, Ramadan adjustments, mosque events, exam weeks |
| Active state | ACTIVE / PAUSED / ENDED (with reason) |

## 3. Recurrence rules

1. **Stored as a rule, not as generated rows.** The rule is the source of truth; generated events are
   materialised a configurable window ahead (default 60 days, max 120) by a job, and the job is
   idempotent (running twice creates nothing new).
2. **Times are computed in the venue's timezone** (ADR-0018) and stored as instants; the display side
   re-renders in the venue's timezone with the local weekday name.
3. **Prayer-relative times** resolve against the configured prayer-time source for that mosque, with an
   explicit "perkiraan" state when the source is unavailable (never a silent guess), and the resolution
   is stored on the event so history stays truthful.
4. **DST and calendar oddities** are handled even though Indonesian timezones do not use DST, because
   deployments may be shared or mirrored elsewhere; the rule engine is tested against a DST locale.
5. **Exceptions win over the rule.** A specific date can be skipped, moved or replaced with a special
   event ("Kajian Akbar") without touching the rule.
6. **Changing the rule never rewrites history.** Already published or completed events keep their own
   data; the change applies to *future, unpublished* occurrences. If a published future event must
   change, it goes through the event reschedule flow with notifications.
7. **Pausing is normal.** A paused program (Ramadan schedule, renovation, illness) stops generating
   events; participants see the program state and the last/next planned date, never a silent gap.

## 4. Materialisation and the "next occurrence" computation

| Operation | Rule |
|---|---|
| Materialise | Jobs create events up to the visible-from window; each event is created in `DRAFT` unless the program is set to auto-publish, in which case the readiness checklist must still pass |
| Next occurrence | Computed from the rule, exceptions, prayer times and the venue timezone; shown to organizers with the reason ("karena 12 Okt dikecualikan") |
| Backfill | Explicit organizer action, audited; older occurrences are never auto-published |
| Duplicate protection | One event per (program, occurrence instant); enforced by a unique constraint so a retry cannot double-create |
| Conflict detection | If the venue is already booked at that instant, the generated event is marked `needs_review` rather than published |

## 5. Organizer experience rules

1. Creating a program feels like describing a habit, not filling a form: "Setiap Ahad ba'da Subuh".
2. The program page shows a **timeline preview** of the next ~8 occurrences (with exceptions applied)
   before saving, so mistakes are visible immediately.
3. Bulk edits across a program's future events are possible for: speaker, venue, registration mode,
   recording policy — each with a diff preview and notification implications stated ("48 peserta akan
   diberi tahu").
4. Warnings, not silent fixes: if a program produces zero occurrences in the next 30 days, the UI says
   so plainly.
5. Speakers attached to a program are asked per occurrence; a long series never commits a person
   silently.

## 6. Failure and edge cases

| Case | Behaviour |
|---|---|
| Prayer-time source unavailable | Event time stored as announced time with a "perkiraan" flag; participants see the flag; reminders use the announced time, not a guess |
| Two programs in one mosque overlap by 15 minutes | Organizers are warned with both events shown; they decide (this happens legitimately, e.g. different rooms) |
| Program rule edited mid-window | Future unpublished events regenerate; published ones keep their data and are flagged for review if their inputs changed |
| Mosque timezone changed | Existing events keep their instants (true history); new events use the new timezone; participants are notified of affected upcoming events |
| Program ended but events remain | Program is read-only; events remain valid and manageable |
| A weekly program falls on a public holiday | Only skipped if the exception exists; otherwise it stays, and organizers may add the exception in bulk |

## 7. Anti-requirements

1. No "series streak" gamification, no attendee streaks for participants, no "faithfulness" metrics of
   any kind.
2. No automatic cancellation of low-registration events.
3. No public leaderboards of programs or mosques by attendance.
