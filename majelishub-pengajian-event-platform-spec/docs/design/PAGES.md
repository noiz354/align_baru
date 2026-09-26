# PAGE INVENTORY

Every route that MajelisHub will have, with its audience, purpose, primary action, states and
requirements. **Phase 0 implements these as empty shells only** (`src/app/**`, each returning
`null`/`<main>` with a `TODO(taskId)` comment). No page may be built before its task exists in
`TASKS.md`.

Legend: **Auth** = `public` | `contact` (identified by contact channel, no password) |
`session` (authenticated) | `role` (authenticated + role check, server-side).

---

## 1. Public (participant) pages

| Route | Auth | Purpose | Primary action | Key states | Requirements |
|---|---|---|---|---|---|
| `/` | public | "Kajian apa yang tersedia?" — today/this week nearby | Open an event | loading · empty (no events) · offline banner | FR-EVENT-014, NFR-PERF-001 |
| `/kajian` | public | Full list + filters (date, mosque, area, topic, language, format) | Open an event | loading · empty · partial (pagination) · error | FR-EVENT-014, FR-EVENT-015 |
| `/kajian/[slug]` | public | **Decision screen** — speaker, mosque, venue, schedule, capacity, accessibility, recording policy | Daftar / Lihat kode / Datang langsung | event open · full (waitlist) · closed · cancelled · in progress · completed (with media) | FR-EVENT-010, FR-EVENT-015, FR-EVENT-016 |
| `/masjid` | public | Mosque directory (area, facilities filter) | Open a mosque | loading · empty | FR-MOSQUE-002, FR-MOSQUE-003 |
| `/masjid/[slug]` | public | Mosque profile: venues, facilities, accessibility, upcoming kajian, contact (if published) | See upcoming kajian · get directions | no upcoming events · closed temporarily | FR-MOSQUE-002, FR-MOSQUE-003, FR-MOSQUE-004 |
| `/ustadz` | public | Speaker directory (search by name/area of study) | Open a profile | loading · empty | FR-SPEAKER-003 |
| `/ustadz/[slug]` | public | Speaker profile: bio, areas of study, affiliation, verification, upcoming/past kajian, published recordings/transcripts | See upcoming kajian | unverified · unlisted · no content yet | FR-SPEAKER-001/003/004/007 |
| `/program` | public | Recurring kajian programs (kajian rutin) across mosques | Open a program | empty | FR-PROGRAM-001/003 |
| `/program/[slug]` | public | Program page: schedule, mosque, typical speaker, past sessions | See next session | paused · ended | FR-PROGRAM-005 |
| `/rekaman` | public | Published audio archive (searchable) | Play a recording | empty · processing (not yet published) | FR-CONTENT-001/004 |
| `/rekaman/[id]` | public | Recording page: player, chapters, transcript link, speaker/mosque/date, download if allowed | Play · read transcript | audio not ready · transcript unavailable · policy INTERNAL (404 with explanation) | FR-CONTENT-001/002/007 |
| `/transkrip/[id]` | public | **Published, human-reviewed transcript** with timestamp navigation and provenance header | Read · jump to audio | draft (only to reviewers) · unpublished | FR-TRANSCRIPT-011/012/013, FR-CONTENT-002 |
| `/masjid/[slug]/lokasi` | public | Location helper: address, map link, parking, entrance instructions, transport notes | Open map | coordinates missing | FR-MOSQUE-003/008 |

### 1.1 Participant transaction pages

| Route | Auth | Purpose | Primary action | Key states | Requirements |
|---|---|---|---|---|---|
| `/daftar/[eventId]` | contact | Registration form (≤ 4 fields) + accessibility request | Kirim pendaftaran | open · full → waitlist offer · closed · invitation required · already registered | FR-REG-001…004, 007, 010, 011 |
| `/daftar/[eventId]/hasil` | contact | Result: status, QR, short code, add-to-calendar, screenshot hint | Lihat kode | registered · waitlisted (with position) · rejected (reason) | FR-REG-003, FR-REG-009 |
| `/pendaftaran/[token]` | tokenised | **My registration & QR** — offline-capable, brightness mode | Tampilkan kode | active · checked-in (with time) · cancelled · event cancelled · expired | FR-REG-009, FR-CHECKIN-003, NFR-MOB-004 |
| `/pendaftaran/[token]/batal` | tokenised | Cancellation with explicit consequences | Batalkan pendaftaran | already cancelled · after check-in (blocked) | FR-REG-006 |
| `/umpan-balik/[eventId]` | tokenised | Post-event feedback (≤ 5 ratings + optional comment, anonymity stated) | Kirim | window open · closed · already submitted | FR-FEEDBACK-001…003 |
| `/masuk` | public | Magic-link / passkey sign-in (organizers; participants need no account) | Kirim tautan | sent · expired link · rate-limited | NFR-SEC-001/010 |
| `/undangan/[token]` | tokenised | Invitation acceptance for `INVITATION` events | Terima undangan | invalid · used · expired | FR-REG-007 |

## 2. Organizer / volunteer pages

All are `role`-guarded server-side (`AUTHZ-MATRIX.md`). Client-side hiding is never a control.

| Route | Roles | Purpose | Primary action | Requirements |
|---|---|---|---|---|
| `/dasbor` | ORGANIZER, MOSQUE_ADMIN | Operator home: upcoming, needs-action, capacity, alerts | Act on the top task | FR-ANALYTICS-001/002 |
| `/kajian-baru` | ORGANIZER | Create a kajian (single page, progressive disclosure) | Simpan draf | FR-EVENT-001…003, 005…009 |
| `/kajian/[id]` | ORGANIZER | Event detail (organizer view): status, checklist, publish | Publikasikan | FR-EVENT-010 |
| `/kajian/[id]/ubah` | ORGANIZER | Edit / reschedule / cancel | Simpan · Batalkan | FR-EVENT-004, 011 |
| `/kajian/[id]/check-in` | VOLUNTEER, ORGANIZER | **Entrance console** (camera + manual + walk-in) | Scan / cari nama | FR-CHECKIN-001…016 |
| `/kajian/[id]/peserta` | ORGANIZER | Registrations list, search, waitlist management | Promote from waitlist | FR-REG-004/012/014 |
| `/kajian/[id]/kehadiran` | ORGANIZER | Attendance summary + corrections + export | Correct with reason · Export | FR-ATTEND-001…008 |
| `/kajian/[id]/rekaman` | AUDIO_OPERATOR, ORGANIZER | Recording console (start/pause/stop, health, recovery) | Mulai rekaman | FR-AUDIO-001…017 |
| `/kajian/[id]/audio` | ORGANIZER | Audio assets: raw/normalized/derivative, playback, policy, download | Process · Publish | FR-AUDIO-009/010/011/017, FR-CONTENT-001 |
| `/kajian/[id]/transkrip` | ORGANIZER, TRANSCRIPT_REVIEWER | Transcription job status + review entry | Minta transkrip · Tinjau | FR-TRANSCRIPT-001…003, 006 |
| `/kajian/[id]/transkrip/tinjau` | TRANSCRIPT_REVIEWER, SPEAKER (own) | **Transcript editor** (audio + segments + certainty + revisions) | Simpan · Setujui | FR-TRANSCRIPT-007…010, 015 |
| `/kajian/[id]/konten` | ORGANIZER | Publication: chapters, materials, references, policy enforcement | Publikasikan | FR-CONTENT-002/003/006/007 |
| `/kajian/[id]/umpan-balik` | ORGANIZER | Feedback review (aggregates + comments; speakers see filtered) | Tandai ditindaklanjuti | FR-FEEDBACK-004, 006 |
| `/masjid-saya` | MOSQUE_ADMIN | Mosques in scope; venues, facilities, entrances | Tambah ruang | FR-MOSQUE-005/006/007 |
| `/masjid-saya/[id]/ruang` | MOSQUE_ADMIN | Venue management (capacity, entrance notes) | Simpan | FR-MOSQUE-005/006 |
| `/pembicara` | ORGANIZER | Speaker registry (create, link, edit within scope) | Tambah pembicara | FR-SPEAKER-001, 005 |
| `/pembicara/[id]` | ORGANIZER, SPEAKER (own) | Speaker profile editing (server-validated ownership) | Simpan | FR-SPEAKER-001/005/006 |
| `/program` | ORGANIZER | Program list in scope | Buat program | FR-PROGRAM-001 |
| `/program/[id]` | ORGANIZER | Program editor + generate events for a date range | Buat jadwal | FR-PROGRAM-002/004/005 |
| `/anggota` | ORGANIZER (owner) | Members and roles within the organization | Undang anggota | FR-ORG-002/005 |
| `/pengaturan` | ORGANIZER | Organization defaults (timezone, registration mode, recording policy, reminders) | Simpan | FR-ORG-004, FR-NOTIF-002 |
| `/notifikasi` | session | In-app notifications (quiet list, mark read) | Buka item | FR-NOTIF-006/007 |
| `/sesi-saya` | session | Device/session management | Cabut sesi | NFR-SEC-011 |

## 3. Reviewer, moderator, admin pages

| Route | Roles | Purpose | Primary action | Requirements |
|---|---|---|---|---|
| `/tinjau` | TRANSCRIPT_REVIEWER | Review queue (assigned, due, blocked) | Buka draf | FR-TRANSCRIPT-006/015 |
| `/moderasi` | MODERATOR | Reports queue with evidence and history | Putuskan | FR-MOD-001/002/004 |
| `/verifikasi` | PLATFORM_ADMIN | Speaker verification requests with evidence | Verifikasi / Tolak | FR-SPEAKER-002 |
| `/audit` | PLATFORM_ADMIN, ORGANIZER (scoped) | Audit query (actor, target, type, time) | Cari · Ekspor | FR-AUDIT-004 |
| `/operasional` | PLATFORM_ADMIN | Platform health: jobs, queues, storage, SLOs | Investigate | NFR-OBS-003/006 |
| `/operasional/penyimpanan` | PLATFORM_ADMIN | Storage usage, retention runs, orphan detection | Run retention | RETENTION.md |
| `/operasional/transkripsi` | PLATFORM_ADMIN | Provider status, job backlog, failures, cost | Retry / Disable provider | FR-TRANSCRIPT-002/003 |

## 4. Status / error pages

| Route | Purpose |
|---|---|
| `not-found.tsx` | Plain-language 404 that still offers the discovery list |
| `error.tsx` | Per-section error boundary with retry and a support path |
| `offline` (client) | Offline shell for registration display and check-in degraded state |
| `maintenance` | Documented maintenance page (read-only archive where possible) |

#### Route naming note (implementation constraint)

Next.js forbids two different dynamic segment names at the same path position, so the event console
routes listed as `/kajian/[id]/...` in §2 are implemented under the same `[slug]` segment as the public
event page (`src/app/kajian/[slug]/...`). The server resolves whether the viewer gets the public decision
screen or the organizer view from their permissions - the URL is the same resource, which is also better
for link sharing. Organizer-only sub-routes stay permission-guarded server-side; a URL never grants
access.

## 5. Per-page contract (mandatory for every page)

When a page is implemented, its file must declare:

1. **Route + audience + role guard** (server-side).
2. **Requirement IDs** it satisfies.
3. **Data dependencies** (queries/ports used) and their authorisation scope.
4. **States**: loading, empty, error, offline, partial, permission-denied.
5. **Primary action** and its idempotency behaviour.
6. **Accessibility notes**: focus order, live regions, keyboard path, target sizes.
7. **Privacy notes**: what personal data is rendered, to whom, and why it is necessary.
8. **Link to its task** in `TASKS.md` and its QA scenario in `QA.md`.

Phase 0 shells contain the docblock and return nothing (`return null`) so that no page can be
mistaken for a working feature.
