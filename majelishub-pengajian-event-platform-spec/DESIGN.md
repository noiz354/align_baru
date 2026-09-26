# DESIGN — MajelisHub

**The central UX principles and the three primary experiences.**

- Authority: below `PRD.md` and the product specs; above `ARCHITECTURE.md` in matters of
  user experience. ADRs may constrain design; design may not contradict ADRs.
- Companions: `docs/design/DESIGN-SYSTEM.md` (tokens and components),
  `docs/design/PAGES.md` (page inventory), `docs/design/UX-FLOWS.md` (step-by-step flows),
  `ACCESSIBILITY.md`.

---

## 1. The product should feel

| Quality | What it means concretely (testable) |
|---|---|
| **SIMPLE** | One primary action per screen. A participant completes registration in ≤ 4 interactions with ≤ 4 fields. A volunteer reaches a scanning state in ≤ 2 taps after login. |
| **RESPECTFUL** | No gamification, no exclamation marks, no marketing superlatives, no "engagement" prompts. Copy addresses the user as an adult peer. Religious content is presented with visible provenance, never paraphrased by the product. |
| **CALM** | Neutral surfaces, restrained colour, no motion beyond 150 ms state transitions, no badges or counters competing for attention. The most visually prominent element on any screen is the thing the user must do next — or nothing at all. |
| **MOBILE FIRST** | Designed at 360 px first. The desktop layout is the mobile layout with more whitespace and a persistent rail, never a different information architecture. |
| **FAST AT THE MOSQUE ENTRANCE** | The check-in path assumes a queue, bright sunlight, one hand, gloves, a 4-year-old phone and a distracted operator. Feedback is large, immediate and unambiguous. No step exists between scan and result. |
| **ACCESSIBLE** | WCAG 2.2 AA minimum. Body text ≥ 16 px. 44 px targets. Keyboard-complete. QR is never the only way in. A "large text" mode exists for older participants. |
| **LOW FRICTION** | No account required to register (contact channel = identity). No password to view your own QR. No app install. No email verification to attend. |
| **INFORMATION FIRST** | Layout answers the user's question before it asks for anything: who / where / when / what / how to come. Marketing imagery never precedes facts. |

### Anti-patterns (explicitly forbidden)

- Dark patterns of any kind: pre-ticked consent for recording/publication, urgency timers,
  "X people are viewing this", bait notifications.
- Social mechanics: likes, follows, comment threads on teachings, shares with counters,
  streaks, leaderboards.
- Ranking surfaces: "most popular ustadz", "trending kajian", "recommended for you" driven by
  engagement (`NFR-ETH-001`, `ADR-0024`).
- Ambiguity at the entrance: any state that could be read as success when the check-in did
  **not** commit (`NFR-REL-002`).
- Fake precision in attendance numbers (`FR-ATTEND-006`).

## 2. Voice and copy

- **Language:** Bahasa Indonesia default; English available (`NFR-I18N-001`).
- **Register:** plain, warm, brief. "Anda" for participants, "Anda" or first person plural for
  organizers. No slang in operational copy.
- **Religious terminology** is used correctly and consistently with `GLOSSARY.md`
  (kajian, ustadz, masjid, jamaah, ruang). Do not translate fixed terms into English in the
  Indonesian locale.
- **Numbers and dates:** `Sabtu, 11 Oktober 2026 · 06.15 WIB` — weekday always included,
  24-hour clock, timezone label always present (`NFR-I18N-002`).
- **Errors** say what happened, why, and the next action. Never an error code alone.
  Example: *"Kode ini milik kajian lain. Minta panitia memeriksa jadwal Anda, atau daftarkan
  Anda sebagai peserta datang langsung."*
- **Uncertainty** is expressed openly: *"Transkrip ini hasil perbaikan manusia. Bagian yang
  ditandai ragu belum diverifikasi."*

## 3. Information architecture

Three products in one surface, separated by role, not by menu depth.

```
PUBLIC (no account)
  /                     discovery: what's on, near me, today
  /kajian               list + filters (date, mosque, topic, language)
  /kajian/[slug]        event detail → register → QR
  /masjid  /masjid/[slug]
  /ustadz /ustadz/[slug]
  /rekaman  /transkrip/[id]        reviewed archive (searchable)

PARTICIPANT (account optional; contact-identified)
  /daftar/[eventId]     registration
  /pendaftaran/[token]  my registration + QR + status      ⇐ works offline (cached)
  /umpan-balik/[eventId] feedback

ORGANIZER / VOLUNTEER (authenticated, role-scoped)
  /dasbor               operator dashboard (cards + alerts)
  /kajian-baru  /kajian/[id]/…      manage an event
  /kajian/[id]/check-in             entrance console           ⇐ one-tap entry
  /kajian/[id]/peserta              registrations + attendance
  /kajian/[id]/rekaman              recording console
  /kajian/[id]/transkrip            transcription + review
  /kajian/[id]/umpan-balik          feedback review
  /masjid  /pembicara  /program     registries

REVIEWER / MODERATOR / ADMIN
  /tinjau                review queue
  /moderasi              reports and decisions
  /verifikasi            speaker verification
  /audit                 audit query
```

Routing details and per-page contracts: `docs/design/PAGES.md`.
Every route that exists in the skeleton today is an empty shell (`src/app/**`).

## 4. Participant experience

```
Discover Kajian → Open Event → See Ustadz + Mosque + Schedule → Register
→ Receive QR → Arrive → Scan QR → Attend → Receive Recording / Transcript → Submit Feedback
```

### 4.1 Discover

- The list is **time-ordered and local**. Default filter: upcoming, in the venue's timezone,
  nearest first only when location is granted (never a blocker).
- Every card shows: title, speaker name, mosque + area, day/time in local time, and
  registration state (Terbuka / Penuh / Tanpa pendaftaran / Undangan).
- Filters are chips, not a form: Hari ini · Minggu ini · Masjid terdekat · Bahasa · Topik.
- Empty state is honest and useful: "Belum ada kajian terjadwal di area ini. Lihat masjid
  terdekat" with the nearest three mosques that publish programs.

### 4.2 Event detail — the decision screen

Order of information is fixed (this is a specification, not a suggestion):

1. Title + topics (plain text, no hero image)
2. Speaker (name, photo, verified mark if applicable) → link to profile
3. Mosque + venue + **entrance instruction** (where to come in, whether to bring anything)
4. Date and time in local time, with the timezone label; prayer-relative note if applicable
5. Registration state and remaining capacity **only if exact numbers are known**
6. Accessibility and facilities: parking, women's area, wheelchair access, wudu
7. Recording policy: "Sesi ini direkam untuk arsip dan dipublikasikan" / "tidak direkam"
8. Primary action: Daftar / Sudah terdaftar — lihat kode / Datang langsung tanpa daftar
9. Secondary: Bagikan (a plain link, no tracking), Tambahkan ke kalender

### 4.3 Register

- Four fields maximum: Nama · Kontak (WhatsApp/email, one channel) · Jumlah peserta ·
  (opsional) Kebutuhan aksesibilitas. Nothing else, ever, without a documented purpose.
- No account creation step. Contact channel is the identity; a magic link is sent to it.
- Submission is idempotent; double-tapping the button cannot create two registrations
  (`FR-REG-005`). The button disables itself on first press and shows progress.
- Result screen shows the QR immediately, plus a **download/screenshot hint**, plus a plain
  text short code underneath (`FR-CHECKIN-003`).

### 4.4 My registration & QR

- Reachable from the notification link without a password (signed, short-lived link) and from
  the account if one exists.
- **Works offline** (`NFR-MOB-004`): the page shell, the QR and the short code are cached; the status
  shown is "sebagaimana saat terakhir tersinkron" with a timestamp.
- Screen is brightness-maximised on request ("Perbesar kode") — one tap fills the screen with
  the QR and the short code.
- Contains: event summary, venue + entrance note, my status (Terdaftar / Menunggu daftar
  tunggu / Check-in pukul …), and a Cancel action with explicit consequences.

### 4.5 Arrive & check in

- The participant does nothing except show the code. No app, no tap-to-check-in required.
- Result is announced on the **operator's** screen and, if the participant's page is open,
  updated on theirs within the same second.

### 4.6 Aftermath

- Once published: audio player with chapter markers, transcript with timestamp navigation,
  and a short "ringkasan" only if human-reviewed (never a generated summary presented as
  the teaching; if generated, it is labelled `Ringkasan otomatis — belum ditinjau`).
- Feedback request arrives **once**, after the event, with ≤ 5 questions and an optional
  comment, and states plainly whether the answer is anonymous.

## 5. Organizer experience

```
Create Kajian → Choose Mosque → Choose Speaker → Define Capacity → Publish → Registration
→ QR Check-In → Attendance → Record Audio → Generate Transcript → Review → Publish
→ Review Feedback
```

### 5.1 Create (target: ≤ 90 seconds for a repeat event)

- Single page, progressive disclosure, no wizard. Mosque and venue pre-selected from the
  organizer's scope; speaker selected from the registry with a "add new speaker" inline path.
- Time input is forgiving: a duration is often enough ("selesai sekitar 07.30"). End time is
  optional but recommended.
- Recurring: a "Program" toggle that reuses `FR-PROGRAM-*`. Creating the weekly kajian should
  never require re-entering mosque, venue, speaker or time.
- Defaults come from the organization (`FR-ORG-004`): registration mode, recording policy,
  transcription policy, reminder lead time.

### 5.2 Publish

- Publish is a distinct, explicit action with a pre-publish checklist: time is in the future,
  venue belongs to the mosque, speaker is set, registration mode is intentional, recording
  policy is intentional.
- Choosing a **publication policy for audio/transcript is a decision with consequences**
  shown in plain language: "Rekaman akan dipublikasikan di halaman umum dan dapat dicari."

### 5.3 Entrance operations (the stress case)

Design constraints derived from the queue, not from aesthetics:

- **Zero-state ambiguity**: the top of the screen always states which event, which venue and
  which entrance the device is operating. Wrong-event mistakes must be structurally hard.
- Feedback occupies ≥ 40% of the viewport: green ✓ with the participant's **first name and
  count** on success, red ✕ with a plain-language reason and the manual action on failure.
- Audible feedback is available (short, discreet, toggleable) because the operator is often
  looking at the participant, not the screen.
- Auto-resume in ≤ 400 ms after a result; no "scan next" button required.
- Running totals (checked in / capacity) are visible but never dominate.
- Manual paths are always one tap away: **cari nama** (search by name) and **daftarkan
  peserta datang langsung** (walk-in).
- The operator's own phone number/email is never displayed.

### 5.4 Attendance review

- The summary performs honest arithmetic and labels every number with its meaning:
  Registered, Checked In, Walk-In, No Show, Cancelled — and explicitly labels No Show as
  "belum check-in" until the window closes (`ATTENDANCE.md`).
- Corrections require a reason and are visible in the audit trail.

### 5.5 Recording

- One primary button. Before it: device check (input level), duration estimate, storage
  state ("tersimpan lokal: 3 menit belum terunggah").
- During: elapsed time, level meter, upload state per chunk, connection state, battery and
  screen-lock warning, and a plain-language statement of what happens if things fail
  ("Rekaman tetap tersimpan di perangkat ini").
- After: explicit summary of what was captured, where it was uploaded, and what was not.

### 5.6 Dashboard

Cards in this priority order, with a maximum of one alert row above them:

1. Kajian mendatang (next 7 days, with registration/check-in status)
2. Perlu tindakan (recordings not processed, transcripts awaiting review, feedback unread)
3. Kapasitas hampir penuh
4. Operasional (alerts: `AUDIO_UPLOAD_FAILED`, `CHECKIN_FAILURE_RATE_HIGH`, …)

No vanity metrics. No "engagement" charts. Numbers come with their definitions on tap.

## 6. Ustadz / Speaker experience

A profile is a **reference**, not a brand page:

```
name · display name · biography · areas of study · affiliation
photo · verification status
upcoming kajian · past kajian · published recordings · reviewed transcripts
aggregate feedback (operational dimensions only, never compared to others)
```

Rules:

- Verification is an explicit, evidence-backed status set by a platform administrator with a
  recorded verifier (`FR-SPEAKER-002`). It means "identity confirmed by the platform", not
  "religiously endorsed".
- Publication control: the speaker can approve/decline publication of a transcript of their
  own talk when `PUBLISH_AUDIO_AND_TRANSCRIPT` policy applies (`CONTENT-INTEGRITY` §Control).
- A speaker can request unlisting; historical attendance records remain as records
  (`FR-SPEAKER-006`).
- **No popularity mechanics:** no follower counts, no ratings shown publicly, no "trending",
  no comparison view, no badge for volume of talks (`ADR-0024`).

## 7. Cross-cutting interaction rules

| Rule | Specification |
|---|---|
| Loading | Skeleton only where the wait is ≥ 300 ms; otherwise an inline spinner next to the action. Never a full-page blocking spinner for a mutation. |
| Optimistic UI | Permitted only for reversible, non-integrity actions (e.g. marking a notification read). **Never** for check-in, attendance, payment-less registration or transcript approval. |
| Errors | Inline, adjacent to the cause, in plain language, with a retry or an alternative path. Network vs. validation vs. permission failures are visually distinct. |
| Destructive actions | Require typed confirmation only for irreversible, high-impact actions (delete account, discard recording > 30 min). Otherwise a confirm dialog naming the consequence. |
| Notifications in-app | Quiet by default: a dot, not a modal. Alerts that require action appear in the dashboard's "Perlu tindakan", not as pop-ups. |
| Tables | On mobile, tabular data becomes stacked cards with labelled fields; no horizontal scroll for primary content. |
| Forms | One column. Labels above inputs, always visible (no placeholder-only labels). Required marked explicitly. Server-side errors map to fields. |
| Time | Never show a bare numeric time without its timezone context when the viewer's timezone may differ from the venue's. |
| Empty states | Every list has one, with a single relevant action. |
| Offline | Any screen that can be used offline says so, and states the last sync time. |

## 8. The three primary experiences — success statements

| Experience | "It worked" looks like |
|---|---|
| **Participant** | Bu Sariah opens a WhatsApp link, sees the kajian, taps Daftar, fills 2 fields, and screenshots her QR. At the mosque she shows the screen; the volunteer's device says her first name in green within a second. |
| **Organizer** | Pak Andi creates the monthly program once. On kajian day he scans 278 people in 12 minutes from three devices with no duplicate records, records 2 hours with one Wi-Fi dropout, and reviews the attendance summary the same evening. |
| **Ustadz / Content** | Ustadz Rahman opens the draft transcript on his phone, corrects three Arabic terms and one hadith attribution, marks two passages as uncertain, approves it — and the published page states clearly who reviewed it and when. |

## 9. What design must never do

1. Present an unreviewed machine transcript as reviewed content.
2. Show an attendance number it cannot support.
3. Require the QR as the only route to attendance.
4. Make the participant create an account to attend.
5. Hide a recording/publication decision in a default.
6. Rank, score or compare speakers.
7. Use the participant's contact details for anything other than the kajian lifecycle.
