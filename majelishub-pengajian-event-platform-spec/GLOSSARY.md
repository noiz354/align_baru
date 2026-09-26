# GLOSSARY

Shared vocabulary for MajelisHub. Indonesian/Islamic terms are used because that is the
domain language of the users; engineering terms are defined only where they carry a
precise meaning **in this system**.

## Domain terms (Bahasa Indonesia / Islamic)

| Term | Meaning in MajelisHub | Canonical entity |
|---|---|---|
| **Kajian / Pengajian** | A religious learning session (lecture/study circle). The unit participants care about. | `KajianEvent` |
| **Majelis** | A gathering or assembly; also used for a community that runs regular kajian. | `Organization` / `KajianProgram` |
| **Ustadz / Ustadzah** | Speaker/teacher. Gender-neutral engineering term: **Speaker**. | `Speaker` |
| **Pemateri** | The person delivering the material; synonym for speaker. | `Speaker` |
| **Masjid** | Mosque — the physical site. | `Mosque` |
| **Musholla / Surau** | Small prayer place, often without Jum'ah. Modelled as a `Mosque` with type `MUSHOLLA` / `SURAU`. | `Mosque` |
| **Ruang / Aula** | A hall or room inside a mosque. A mosque can have several. | `Venue` |
| **Jamaah** | The congregation; in this product, **Participant**. | `Registration` / `AttendanceRecord` |
| **Panitia** | Event committee/organizer. | `OrganizationMember` roles |
| **Relawan / Volunteer** | Helper at the entrance (check-in operator). | role `CHECKIN_OPERATOR` |
| **Kajian rutin** | Recurring kajian program (e.g. weekly ba'da Subuh). | `KajianProgram` |
| **Ba'da Subuh / Ba'da Maghrib** | "After Fajr / after Maghrib" — a time *relative to prayer*, not an absolute clock time. See §Time. | `ProgramRecurrence` note |
| **Kajian Subuh / Kajian Rutin** | Named recurring program examples. | `KajianProgram` |
| **Tausiyah / Ceramah** | Short talk; a `KajianEvent` with `format: TAUSIYAH` if ever needed. | `KajianEvent` |
| **Kitab** | A book studied in the kajian (e.g. kitab kuning). | `KajianEvent.materials` |
| **Sanad / Isnad** | Chain of transmission of a narration. Not modelled as a score or rank. | — |
| **Hadith** | Reported saying of the Prophet ﷺ. **Never auto-corrected** by the system. | content integrity rules |
| **Ayat** | Qur'anic verse. Preserved verbatim or flagged uncertain; never silently "fixed". | `TranscriptSegment.certainty` |
| **Tilawah** | Qur'anic recitation inside an audio recording. | `TranscriptSegment.kind = RECITATION` |
| **Kultum** | Short pre-prayer talk (kuliah tujuh menit). | `KajianEvent` (short format) |
| **Wudu** | Ritual ablution; a modelled facility. | `MosqueFacility` |
| **Musalla (women's prayer area)** | Separate women's area — a first-class accessibility/facility field. | `MosqueFacility` |
| **Izin / Idzin** | Permission; used for recording/consent notices. | `RecordingPolicy` |

## Time & scheduling terms

| Term | Definition |
|---|---|
| **Prayer-relative time** | A start time expressed relative to a prayer (e.g. "ba'da Subuh", "ba'da Isya"). Stored as `{ anchorPrayer: PrayerName, offsetMinutes: number }`, **not** as a clock time, because prayer times shift daily. Resolution to a clock time requires a mosque-local prayer-time source; if unavailable, the event is displayed as prayer-relative with an explicit "approximate" marker. |
| **Venue timezone** | The IANA timezone (e.g. `Asia/Jakarta`) that governs display for an event. Storage is always UTC. |
| **Local date** | The date in the venue timezone. "Sunday 11 October 2026" always means the local date at the mosque. |

## Engineering terms (system-specific)

| Term | Precise meaning here |
|---|---|
| **Organization** | The tenant. Owns mosques, speakers, programs, events and everything downstream of them. Every scoped row carries `organization_id`. |
| **Scoped row** | A database row whose access requires an organization + role check. |
| **Check-in token** | Opaque, high-entropy, per-registration secret that authorises exactly one check-in for one event. Stored **hashed**. Not a JWT, not a database id. |
| **AttendanceRecord** | The durable fact that a person attended. Created exactly once per (event, registration) or (event, walk-in). |
| **Walk-in** | A participant with no prior registration who attends and is registered at the entrance. |
| **RecordingSession** | One continuous recording attempt for an event, from `PREPARING` to `COMPLETED`/`FAILED`/`ABANDONED`. An event may have several. |
| **AudioChunk** | A monotonic, idempotent slice of a RecordingSession, uploaded individually and assembled server-side. |
| **AudioAsset** | A stored, playable/derivable audio object: `RAW`, `NORMALIZED`, `TRANSCRIPTION_DERIVATIVE`. |
| **Transcript** | A text representation of an AudioAsset with segments and timestamps. Has `source: MACHINE | HUMAN | MIXED`. |
| **TranscriptRevision** | An immutable snapshot produced by each save in the review workflow. |
| **Draft vs Published** | Draft = visible to authorized reviewers only. Published = visible per the event's publication policy. Machine output can never reach Published without human approval. |
| **Certainty flag** | Reviewer-set marker on a segment or span: `UNVERIFIED` / `UNCERTAIN` / `VERIFIED`. Not a confidence score from the model. |
| **Idempotency key** | Client-supplied key that makes a mutating request safe to retry, scoped to (operation, actor, event). |
| **Port** | A TypeScript interface defining what the domain needs from the outside world (`src/server/*`, `src/features/*/*.port.ts`). Adapters implement ports. |
| **NotImplemented placeholder** | A function that throws `Not implemented: <TASK-ID>`. It is the *only* permitted body for unimplemented behaviour. |
| **Domain event** | An immutable, past-tense fact persisted to the outbox in the same transaction as the state change (`EVENTS.md`). Not Kafka, not a message bus. |
| **Outbox** | The durable table of domain events awaiting dispatch to handlers (notifications, analytics, search indexing). |
| **Vertical slice** | A complete, user-visible capability (VS-0…VS-15) that ships value end-to-end, including tests and operations. |

## Roles (see `docs/security/AUTHZ-MATRIX.md`)

`PARTICIPANT`, `SPEAKER`, `MOSQUE_ADMIN`, `ORGANIZER`, `VOLUNTEER`, `AUDIO_OPERATOR`,
`TRANSCRIPT_REVIEWER`, `MODERATOR`, `PLATFORM_ADMIN`.

> Deployments are not required to use every role. A single-mosque deployment may assign
> `ORGANIZER` + `AUDIO_OPERATOR` + `TRANSCRIPT_REVIEWER` to one person — but the
> *permissions* remain separable, and no role implies another except where stated in the
> matrix.

## Anti-glossary (things this product deliberately has no concept of)

`SpeakerRank`, `PopularityScore`, `AuthorityScore`, `Follower`, `Like`, `TrendingTopic`,
`EngagementStreak`, `RecommendationFeed`, `Donation`, `Payment`, `AdSlot`.
See `ADR-0024` and `PRD.md` §Non-goals.
