# QA — MANUAL SCENARIOS

Manual QA exists for what automation cannot honestly cover: real devices, real rooms, real humans in
a hurry. Each scenario states setup, steps, and **verification** — the specific observations that
must hold.

Automated coverage lives in `TESTING.md`; concurrency invariants in
`docs/testing/CONCURRENCY-TESTS.md`. Scenarios here are executed by a human on real hardware and
recorded in the release checklist.

---

## QA-01 · Busy Mosque Entrance (the primary stress scenario)

**Purpose:** prove the entrance works at speed, under contention, and never lies.
**Setup:** 500 registrations seeded (mixed: 60 groups of 2–4, 12 waitlisted, 8 cancelled, 40 with
short codes only); 3 scanner devices on the **same event and venue**, each bound to a different
entrance (Pintu Utama, Pintu Samping, Pintu Belakang); real phones (2 mid-range Android, 1 iPhone);
daylight or a bright hall; a stopwatch.

**Steps**

1. Open `/kajian/[id]/check-in` on all three devices. Confirm the context bar shows event, venue,
   entrance and device label correctly on each.
2. Scan 100 different participants rapidly (print 60 QR pages, use 40 phone screens; mix brightness
   levels and screen brightness including minimum brightness).
3. Scan the **same QR simultaneously** on two devices (count 3, 2 and 1).
4. Scan an invalid QR (a poster QR, a Wi-Fi QR, a URL QR from another site).
5. Scan a QR belonging to a different event at the same mosque.
6. Scan a cancelled registration's code, and an expired token (seeded).
7. Register 10 walk-ins (5 with contact, 5 without); deliberately submit one walk-in **twice** from
   two devices.
8. Disable network on one device for 90 seconds while continuing to scan; then restore it.
9. Have one device's camera permission denied mid-session (revoke in settings and return).
10. Close the check-in window on one device while another is mid-scan.

**Verify**

- [ ] Every valid participant is checked in **exactly once**; the attendance summary shows no
      duplicates (`checkin` counts vs expected list).
- [ ] The simultaneous double-scan produces one success and one "Sudah check-in pukul hh:mm" state —
      **no second attendance record**.
- [ ] Invalid QR is rejected **instantly** (no visible network delay) and never reaches the server.
- [ ] Wrong-event scan shows the specific wrong-event message, and the event name is **not**
      disclosed.
- [ ] Cancelled and expired results are distinct and each offers the manual path.
- [ ] The duplicate walk-in converges: one attendance record, second attempt reports "sudah tercatat".
- [ ] With the network disabled, the device shows "belum tercatat" states — **never** a success
      state — and the operator can keep working with the manual/paper path.
- [ ] After restoring the network, scanning resumes within ~2 seconds without a page reload.
- [ ] Camera-denied device instantly presents manual entry (short code + name search), not an error
      screen or a black box.
- [ ] Check-in after the window closes is refused with a clear reason and the organizer's options.
- [ ] The operator's own contact details are never visible; participant contact details are never
      visible on the scanner at any point.
- [ ] Median time per participant (stopwatch) ≤ 3 s at steady state; the 100-scan block completes in
      ≤ 10 minutes on a single device.
- [ ] Accessibility: the result state is interpretable at 1 m distance, in daylight, with
      brightness at 60%; the sound feedback (if on) is audible but not alarming.

**Failure handling:** record device model, browser version, network type, and a screenshot of every
distinct result state. Any duplicate record is a **release blocker**.

---

## QA-02 · Long Kajian Recording (2+ hours)

**Purpose:** prove a two-hour session survives the real world.
**Setup:** one phone (mid-range Android, 40% battery at start), one laptop as a second operator view;
a real hall with a PA system; event policy `PUBLISH_AUDIO_AND_TRANSCRIPT`; a deliberately flaky
network (mobile hotspot that will be toggled).

**Steps**

1. Open `/kajian/[id]/rekaman`; verify the policy statement is visible **before** starting; check the
   input level meter responds to speech; note the device name.
2. Start recording. Confirm the elapsed timer and level meter are live.
3. At minute 20, lose Wi-Fi for 5 minutes (hotspot off), then restore it.
4. At minute 45, **refresh the browser tab**.
5. At minute 70, disable the microphone at the OS level (or disconnect the headset) for 30 seconds,
   then restore.
6. At minute 90, connect a Bluetooth headset (device change), then disconnect it.
7. At minute 110, let the screen lock for 10 minutes without touching the device.
8. At minute 140, stop the recording; watch the upload flush; note the final summary.
9. Re-open the session page after completion and verify the asset pipeline states.

**Verify**

- [ ] Recording does not accumulate the whole file in browser memory: no tab crash; device does not
      become unresponsive; a memory snapshot (DevTools) stays bounded.
- [ ] Chunk identifiers are ordered and contiguous on the server; the recovered sequence set matches
      the expected count for the elapsed duration.
- [ ] Temporary upload failure is **recoverable**: chunks upload after reconnection without user
      intervention; the backlog indicator appears and then clears.
- [ ] The refresh at minute 45 recovers automatically with a truthful statement of what was
      recovered; no audio captured before the refresh is missing (verify by listening across the
      boundary).
- [ ] Microphone loss is **visible** (a warning within ~20 s) and the operator is told what to do;
      the gap is recorded and reported in the summary.
- [ ] Device change is detected and surfaced; after restoring the original device, recording
      continues within the same session.
- [ ] With the screen locked for 10 minutes, either recording continues (documented behaviour) or the
      operator is warned in advance and the gap is recorded — and the app states which happened.
- [ ] The completed recording has a **deterministic status**: `COMPLETED` with a duration matching
      the wall clock (± chunk interval), a gap count, and a playable normalized asset.
- [ ] An accidental refresh does not create a duplicate session or a duplicate asset.
- [ ] After publication: the public player seeks correctly across the 2-hour timeline (remux worked),
      chapters (if any) land within 1 s, and playback works on 3G without stalling at the start.
- [ ] Battery drain is acceptable (report the percentage consumed; ≥ 40% remaining after 2 h is the
      expected target on a mid-range device with the screen mostly off).

**Failure handling:** any lost acknowledged chunk is a **release blocker**. Record the exact
timestamps, the app's messages, and the server's session state.

---

## QA-03 · Registration on a Cheap Phone, Cold

**Setup:** participant with no prior exposure, Device B (old Android), 3G.

**Steps:** open a shared event link → register with 2 fields → screenshot the code → close the
browser → reopen from a notification → show the code.

**Verify:** total time ≤ 3 minutes; no account creation requested; no English text; the code is
legible at arm's length; the page loads offline from cache with a last-sync statement; the participant
can articulate what the code is for.

---

## QA-04 · Accessibility Pass (per release)

**Setup:** TalkBack (Android) / VoiceOver (iOS) / NVDA (desktop); 200% zoom; large-text mode on.

**Steps:** execute the keyboard-only script in `ACCESSIBILITY.md` §6, plus a screen-reader pass over
the participant flow, the check-in console and the transcript page.

**Verify:** zero axe critical violations; every interactive element reachable and announced with a
meaningful name; check-in results announced without personal data; Arabic passages read as Arabic;
no focus traps; no content clipped at 200% zoom; registration completable without sight.

---

## QA-05 · Transcript Review Session (real reviewer, real audio)

**Setup:** 60 minutes of real (rights-cleared) audio with code-switching; the event's policy allows
publication; a reviewer who has never used the tool.

**Steps:** open the draft → listen and edit → mark two passages uncertain → flag one attribution →
save → close → reopen (revisions visible) → approve → publish → view the public page on a phone.

**Verify:**

- [ ] The reviewer can complete the review in ≤ 90 minutes for 60 minutes of audio.
- [ ] Timestamp navigation lands within 1 s of the spoken phrase.
- [ ] Arabic editing works (bidi correct, diacritics not clipped, no ASCII-only validation).
- [ ] Uncertainty markers survive into the published page and are visible.
- [ ] The published page states who reviewed it and when, and the revision number.
- [ ] Attempting to publish a transcript with unresolved blocking flags is refused with a clear
      explanation (and the reviewer can acknowledge them deliberately).
- [ ] The machine draft is still viewable as revision 1 by an authorized user.
- [ ] No automatic "correction" of any Arabic or religious term is observable anywhere.

---

## QA-06 · Failure Drills (once per quarter)

| Drill | Method | Verify |
|---|---|---|
| Database unavailable during registration | Stop Postgres for 60 s in staging | Clear error to the participant, retry safe (no duplicate), alert fired |
| Storage unavailable during recording | Revoke storage access in staging mid-session | Chunks queue locally, UI warns, no false success, recovery after restore |
| Provider outage | Disable STT provider | Job fails with a truthful state, organizer alerted, audio unaffected, retry works |
| Worker restart mid-job | Restart worker during assembly | Job resumes/idempotent, exactly one current asset |
| Backup restore | Restore last backup to a scratch environment | Documented restore time achieved, counts match, procedure followed by a second person |
| Secret rotation | Rotate storage credentials | No downtime beyond the documented window; old keys revoked |
| Retention dry-run | Run dry-run on production-sized data | Counts reviewed and plausible; no accidental deletion |

---

## QA-07 · Abuse and Privacy Scenarios

| Scenario | Steps | Verify |
|---|---|---|
| Contact harvesting attempt | As an authenticated organizer of mosque A, request mosque B's registration list/export by id manipulation | 404, no data, attempt logged |
| Anonymous feedback de-anonymisation attempt | Submit anonymous feedback, then as organizer try to identify via UI, exports, or API joins | No path exists; schema shows no link; aggregate n < 5 suppressed for the speaker |
| QR screenshot forwarding | Forward a QR screenshot to a second person; both arrive | First scan wins; second is "already checked in"; duplicate metric rises; organizer sees the flag |
| Malformed audio upload | Upload a zip renamed `.webm` and an oversized file | Rejected at validation; nothing stored; error is clear |
| Published-content withdrawal | Unpublish a transcript with a reason | Gone from search, direct link shows an explanation, audio signing refused, owner notified |
| Telemetry leak check | Inspect a day of logs/metrics for tokens, contacts, names, transcript text | Zero findings; `telemetry_dropped_attribute_total` is 0 |

---

## QA record

Each scenario run records: date, environment, commit/tag, devices, browsers, per-step results,
screenshots for failures, and an explicit pass/fail per verification line. Results are attached to the
release checklist and linked from the release notes. A scenario may only be skipped with a written
justification from the release owner.
