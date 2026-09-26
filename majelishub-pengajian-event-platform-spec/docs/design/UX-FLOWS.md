# UX FLOWS

Step-by-step interaction specifications for the flows that carry the product's risk. Each flow
states its **budget** (time/taps), its **failure branches**, and its **non-negotiable rules**.

Read with `DESIGN.md` (principles), `docs/design/DESIGN-SYSTEM.md` (components),
`CHECKIN.md` (entrance detail), `REGISTRATION.md`, `AUDIO.md`.

---

## 1. Participant: discover → attend (target: < 3 minutes, 6 interactions)

| # | Step | Screen | Interaction | Failure branch |
|---|---|---|---|---|
| 1 | Open a shared link or `/` | `/` or `/kajian/[slug]` | — | Link expired → fall back to the event list filtered by mosque, not a dead end |
| 2 | Read the decision screen | `/kajian/[slug]` | — | Event cancelled → banner + nearest alternative in the same program |
| 3 | Tap **Daftar** | `/daftar/[eventId]` | 1 tap | Registration closed → explain why + offer reminder for the next session in the program |
| 4 | Fill ≤ 4 fields | `/daftar/[eventId]` | 3–4 inputs | Validation error → inline, field-level, no data loss |
| 5 | Submit | → `/daftar/[eventId]/hasil` | 1 tap (idempotent) | Capacity reached concurrently → offer waitlist explicitly (`CONCURRENCY` C1) |
| 6 | Save the QR | `/pendaftaran/[token]` | screenshot / add to home screen | Participant with no data plan at the mosque → page is cached (`NFR-MOB-004`) |

**Non-negotiables:** no account creation; no email verification to attend; no field beyond the
four permitted; the QR and the short code are both shown; cancellation is always possible
before the event ends, with the consequences stated.

## 2. Volunteer: entrance scanning (target: ≤ 5 s per person at steady state)

| # | Step | Budget | Rules |
|---|---|---|---|
| 1 | Open `/kajian/[id]/check-in` | ≤ 2 taps from login | The session is remembered per device; the operator does not re-authenticate between arrivals |
| 2 | Confirm context bar | visual check | Event · venue · entrance · device label always visible; if two events are live at the mosque, the device is bound to one (`FR-CHECKIN-002`) |
| 3 | Scan | ≤ 1 s | Result panel ≥ 40% of viewport; success shows first name only |
| 4 | Auto-resume | ≤ 400 ms | No confirmation tap; a rapid sequence of scans must not require waiting |
| 5 | Handle failure | immediate | Failure panel offers **Cari nama** and **Daftarkan datang langsung** as equal-weight actions |
| 6 | Watch totals | continuous | Checked-in count and capacity visible but non-dominant |

**Branch: no camera available / permission denied** → the viewfinder is replaced (not merely
augmented) by manual entry: short code field + name search. Announcement: "Kamera tidak
tersedia. Gunakan pencarian nama." The flow must never depend on the camera.

**Branch: network down** → the scanner shows a persistent offline banner, disables scanning
actions that cannot commit, and routes the operator to manual recording of arrivals on paper
or in a local queue with an explicit "belum tercatat" state. **Never** a fake success
(`FR-CHECKIN-016`).

**Branch: already checked in** → distinct warning state (not success, not failure) showing the
time of the first scan, so the operator can decide whether to flag a duplicate token.

**Branch: walk-in** → 2 fields (name, optional contact) and the participant is counted
immediately; a short-code is issued so the person can later access the archive.

## 3. Organizer: create and publish a kajian (target: ≤ 90 s for a repeat event)

| # | Step | Rules |
|---|---|---|
| 1 | `/kajian-baru` | Mosque/venue pre-selected from scope; speaker from registry (inline create allowed) |
| 2 | Title + time | Title may default from the program ("Kajian Ba'da Subuh"); end time optional |
| 3 | Registration mode | Defaulted from organization; each option states its consequence in one line |
| 4 | Recording & transcription policy | Explicit choice, no silent default; each option states who will be able to see the result |
| 5 | Save draft / Publish | Publish runs the checklist (`DESIGN.md` §5.2) and refuses with actionable reasons |
| 6 | Distributable link | Generated `slug` + share text in Bahasa Indonesia, copyable in one tap |

## 4. Organizer: run the event (day-of)

```
Open check-in on N devices → verify context → scan arrivals → watch totals
→ (optional) register walk-ins → close check-in window → review attendance summary
→ start recording → monitor health → stop → confirm upload
```

Rules: closing the check-in window is an explicit action that freezes `NO_SHOW` derivation;
the attendance summary must state its window ("check-in dibuka 05.45–06.45").

## 5. Audio operator: record a 2-hour kajian

| # | Step | State | Rules |
|---|---|---|---|
| 1 | Open `/kajian/[id]/rekaman` | `READY` | Device check: input selector, live level, storage estimate, policy reminder |
| 2 | Start | `RECORDING` | Start is blocked only if no device is available; a warning (not a block) if level is implausible |
| 3 | Monitor | `RECORDING` | Chunk count, upload backlog, connection, battery, "screen may sleep — recording continues" |
| 4 | Pause/resume | `PAUSED`/`RECORDING` | Pause is explicit and visible; resuming continues the same session (not a new one) |
| 5 | Stop | `STOPPING` → `UPLOADING` | Final chunk flushed; UI states exactly how many chunks remain |
| 6 | Confirm | `COMPLETED` | Summary: duration, gaps, asset state, next step (processing/transcription) |
| 7 | Failure | `FAILED`/`RECOVERABLE` | Recovery panel: what is safe locally, what is uploaded, and the one action to take |

**Non-negotiables:** never require the whole recording in memory; never claim upload success
for buffered chunks; never auto-publish; recovery must be attempted automatically on reload
before asking the operator anything.

## 6. Reviewer: transcript review and approval

```
Open review queue → open draft (audio + segments) → listen and edit
→ mark uncertain passages → flag unclear attributions → save (revision)
→ approve (deliberate) → publish (policy-gated)
```

Rules:
- The header always states provenance: `Draf mesin — belum ditinjau` until approval, and the
  approver's identity afterwards.
- Arabic spans are never auto-corrected; the editor only helps the human.
- Approval requires a confirmation screen listing exactly what becomes public (audio,
  transcript, chapters, materials).
- A second reviewer is optional; when two reviewers have the transcript open, saving is
  optimistic-locked with a diff, never last-write-wins.

## 7. Feedback

```
Event ends → (next morning) one notification → open /umpan-balik/[eventId]
→ 5 ratings with plain labels → optional comment → submit → thank-you + link to next session
```

Rules: one request only; anonymity is stated truthfully and enforced at the data layer
(`ADR-0016`); no public display of comments; no comparison of speakers.

## 8. Failure and recovery flow index

Cross-references so agents can find the right specification quickly:

| Failure | Flow affects | Where specified |
|---|---|---|
| Camera unavailable/permission denied | Check-in | `UX-FLOWS` §2, `CHECKIN.md` §Fallback |
| Network down at the entrance | Check-in | `CHECKIN.md` §Offline, `docs/attendance/OFFLINE-EVALUATION.md` |
| Capacity reached during registration | Registration | `REGISTRATION.md` §Capacity, `CONCURRENCY` C1 |
| Microphone permission denied | Recording | `AUDIO.md` §Permission |
| Mic disconnected / device changed mid-session | Recording | `AUDIO.md` §Health, `docs/media/AUDIO-PIPELINE.md` |
| Upload interrupted | Recording | `docs/media/CHUNK-PROTOCOL.md` |
| Browser crash / refresh during recording | Recording | `AUDIO.md` §Recovery |
| STT provider unavailable/timeout/malformed output | Transcription | `TRANSCRIPTION.md` §Failures |
| Transcript conflict between reviewers | Review | `CONCURRENCY` C6 |
| Object storage unavailable | Recording, publishing | `docs/architecture/FAILURE-MODEL.md` F6 |
| Notification provider unavailable | Notifications | `NOTIFICATIONS.md` §Delivery |
