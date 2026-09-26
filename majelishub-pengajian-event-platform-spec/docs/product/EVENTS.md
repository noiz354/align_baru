# PRODUCT SPECIFICATION — KAJIAN EVENTS

Requirements: FR-EVENT-001…017 · Lifecycle: `STATE_MACHINE.md` · Registration: `REGISTRATION.md` ·
Check-in: `CHECKIN.md` · Attendance: `ATTENDANCE.md` · Media: `AUDIO.md`, `TRANSCRIPTION.md`

---

## 1. The event as the unit of everything

One kajian event is one occasion people can attend: one date, one venue, one speaker (or a panel), one
registration state, one check-in window, one attendance record set, one recording (or none), one set of
feedback. Every product question ("can I come?", "am I checked in?", "what was said?") resolves against
an event.

Events are **created from** a program (recurring) or standalone (a one-off, a seminar, a visiting
speaker). Both paths produce the same object; the program link is metadata.

## 2. The lifecycle (transitions only — see `STATE_MACHINE.md` for the authoritative table)

```
DRAFT → SCHEDULED → REGISTRATION_OPEN → REGISTRATION_CLOSED → IN_PROGRESS → COMPLETED → ARCHIVED
              └──────────────┴───────────────┴──────────────► CANCELLED
```

| State | Meaning | What works |
|---|---|---|
| DRAFT | Being prepared; nobody outside the organization sees it | Edit everything |
| SCHEDULED | Published, registration not yet open | Public page; "add to calendar"; no registration |
| REGISTRATION_OPEN | Public registration accepted (or walk-in accepted for `WALK_IN` mode) | Registration, capacity accounting, waitlist |
| REGISTRATION_CLOSED | No new registrations; existing registrations remain valid | Code retrieval; check-in not yet open |
| IN_PROGRESS | The kajian is happening | Check-in open, recording allowed |
| COMPLETED | Finished; attendance window eventually closed | Attendance summary, correction window, transcription request |
| CANCELLED | Not happening | Public page explains; registered participants notified; codes invalidated |
| ARCHIVED | Historical; read-only | Archive browsing, published media |

Rules: hard deletion of an event does not exist (retention policy only). An event can be cancelled from
any pre-completion state, and cancellation requires a reason that is shown to participants.

## 3. Fields that matter to participants

| Field | Why a participant needs it | Behaviour |
|---|---|---|
| Title + topic | Deciding whether to come | Free text; topic tags optional |
| Speaker(s) + confirmation state | Trust | Unconfirmed speakers are never advertised |
| Date, start time, end time | Planning | Venue timezone; end time may be an estimate and is labelled "perkiraan" if so |
| Venue, mosque, entrance info | Getting there | Includes accessibility attributes of the venue |
| Registration mode and status | Whether they can just turn up | OPEN / CAPACITY_LIMITED / INVITATION / WALK_IN / NO_REGISTRATION, stated in words |
| Capacity and remaining places | Urgency without pressure | Shown when exact; never a fake "almost full" nudge |
| Recording/publication policy | Consent expectations | Stated plainly before the event |
| Accessibility notes | Physical feasibility | From the venue, plus event-specific notes |
| Contact/ask-a-question path | Reducing uncertainty | Organizer contact through the event, not a scraped number |

## 4. Fields organizers control

Registration mode, capacity, registration open/close times, waitlist behaviour, check-in window and
grace period, entrances used, recording policy, transcript policy, collection of participant count,
feedback window, speaker confirmation, publication readiness.

**Readiness checklist before publishing** (all must be true, and the UI says why not):
1. Venue exists and is available for the date (conflict check).
2. Times are consistent (end after start), timezone resolved.
3. Speaker confirmed, or explicitly marked "tanpa penceramah tetap" (e.g. a study circle).
4. Registration mode chosen (including `NO_REGISTRATION` if that is the intent).
5. Recording policy chosen — "belum diputuskan" is not publishable, because people need to know.
6. Accessibility note present (either venue-derived or explicitly "belum ada informasi").
7. Public title and description are readable at a glance (no placeholder text).

## 5. Participant-facing behaviour, per situation

| Situation | Expected behaviour |
|---|---|
| Capacity full | Waitlist offered with an honest explanation and a realistic expectation; no "act now" pressure |
| Event moved to another venue | Participants notified with the new venue and entrance; codes still valid; the public page keeps a change notice |
| Event rescheduled | Participants notified; codes remain valid unless the event becomes a different occasion (new event) |
| Event cancelled | Participants notified with the reason; codes invalidated; a calm explanation page remains |
| Speaker replaced | Participants notified; title/topic changes go through reschedule rules |
| Walk-in event | No registration needed; the page says so, and the check-in path supports walk-ins |
| Registration closed but the event continues | Page states registration closed; walk-in possibility stated if allowed |
| No registration mode at all | The page never shows a registration button that would fail |

## 6. Discovery and listing rules

1. The list is chronological and location-aware; **never** ordered by popularity, attendance or
   engagement (ADR-0014/0024).
2. Filters: date range, mosque, speaker, topic, area, accessibility needs, language, registration state.
3. Each card answers: what, when (venue-local, human-readable), where, who (if confirmed), whether I
   need to register.
4. Recurring events are grouped ("Kajian Ba'da Subuh — setiap Ahad") with the next occurrence first, so
   the list does not flood with 52 rows.
5. Cancelled events remain visible for a short period with a clear cancellation label, then are
   filtered out by default (with an option to include them).
6. Past events lead to the archive (audio/transcript) when published; otherwise they show an honest
   "tidak ada rekaman/transkrip" state — **never** an empty player.

## 7. Failure, edge cases and honest states

| Case | Behaviour |
|---|---|
| Duplicate event created by two organizers | Overlap detection at the same venue/time warns both; merge flow keeps one event and moves registrations with audit |
| Nobody registered | Registration state shows 0 honestly; the event still runs; attendance shows walk-ins only |
| 320 registered, 278 checked in, 32 walk-in, 42 no-show | Displayed with distinct categories and a data-quality note where relevant (`ATTENDANCE.md` §1) |
| Recording failed | Event page states "rekaman tidak tersedia" with the reason category (tidak direkam / gagal / ditarik) — never a broken player |
| Transcript still in review | Event page shows "transkrip sedang ditinjau" and the provisional date; no partial text |
| Event cancelled after recording | Audio stays unpublished; policy `INTERNAL` rules apply; participant notifications explain |
| Time zone confusion (Makassar participants) | Times displayed in venue timezone with an explicit label; a local-time hint appears for viewers in another timezone |

## 8. Anti-requirements

1. No attendance counts as social proof on public cards, no "X orang akan hadir" pressure mechanics.
2. No rankings of events, organizers or mosques by engagement.
3. No paid promotion, no sponsored placement.
4. No gamification (streaks, badges for attending).
5. No automatic publication of recordings or transcripts after an event.
