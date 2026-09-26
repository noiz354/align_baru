# TRANSCRIPTION

Asynchronous speech-to-text with a **mandatory human review gate**. Machine output is never
authoritative, and never published unreviewed.

Requirements: FR-TRANSCRIPT-001…016 · ADRs: 0011 (provider port), 0012 (mandatory review),
0023 (revisions) · Detail: `docs/transcription/*`, `docs/product/CONTENT-INTEGRITY.md`

---

## 1. Why this subsystem is treated as dangerous

A transcript of a kajian looks like a quotation of the speaker. In this domain, errors have
religious consequences:

- a Qur'anic verse transcribed with a changed word;
- a hadith attributed to the wrong collection or narrator;
- a negation dropped ("tidak boleh" → "boleh");
- an Arabic term mangled into a different term with a different meaning;
- a sentence assembled across a pause into something the speaker did not say.

Published benchmarks in 2026 put the best hosted English WER near 5% and Whisper large-v3 nearer
15% on hard real-world audio; **no provider documents strong Indonesian–Arabic code-switching
support**, which is exactly our material. Therefore: **automation drafts, a human decides.**

## 2. Conceptual pipeline

```
Audio Uploaded → Audio Ready → Transcription Requested → Speech-to-Text
→ Raw Transcript → Segmentation → Human Review → Approved → Published
```

Mapped to the state machine (`STATE_MACHINE.md` §6):

```
NOT_REQUESTED → QUEUED → PROCESSING → DRAFT → REVIEW_REQUIRED → APPROVED → PUBLISHED
                                    ↘ FAILED ↗ (retriable)
```

## 3. States (candidate set from the brief, kept with two clarifications)

| State | Meaning | Who can see it |
|---|---|---|
| `NOT_REQUESTED` | An audio asset exists; no transcription asked for | organizers |
| `QUEUED` | Job created, not yet submitted to a provider | organizers |
| `PROCESSING` | Provider working | organizers |
| `DRAFT` | Provider returned a result and it was segmented. **Always `source = MACHINE`** | reviewers, organizers |
| `REVIEW_REQUIRED` | Queued/assigned for human review; blocking flags may exist | reviewers, organizer, speaker (own) |
| `APPROVED` | A named human approved a specific revision | reviewers, organizers; publication may follow |
| `PUBLISHED` | Publicly visible (`published_revision_id` pinned) | public |
| `UNPUBLISHED` | Was public, now withdrawn with a reason | organizers/moderators; link kept with an explanation |
| `FAILED` | Provider error / timeout / malformed output | organizers (+ operator alert) |

Two clarifications versus the brief's list:

1. `DRAFT` and `REVIEW_REQUIRED` are **distinct**: a draft may exist without being in a review
   queue (e.g. transcription enabled internally for search only, with no reviewer yet). The gate is
   between `REVIEW_REQUIRED` and `APPROVED`, and the hard block is between `DRAFT` and `PUBLISHED`.
2. `UNPUBLISHED` is a real state, not a return to `REVIEW_REQUIRED`, because withdrawal must remain
   visible in history (`FR-TRANSCRIPT-012`).

## 4. Provider abstraction

```ts
interface TranscriptionProvider {
  readonly id: string;
  submit(input: TranscriptionRequest): Promise<ProviderJobHandle>;
  poll(handle: ProviderJobHandle): Promise<ProviderJobStatus>;
  fetchResult(handle: ProviderJobHandle): Promise<ProviderResult>;
}
```

- Domain types are **ours**: `TranscriptSegment { ordinal, startMs, endMs, text, kind, certainty,
  speakerLabel? }`. No provider type appears outside `src/server/transcription/providers/**`.
- Default provider: **self-hosted Whisper (`large-v3` / `large-v3-turbo`) via `faster-whisper`** on
  the worker. Voice data stays inside the operator's boundary by default (`NFR-PRIV-004/007`).
- Optional hosted adapters (Deepgram, AssemblyAI, OpenAI, Groq) are enabled per deployment with an
  explicit configuration flag and a documented data-processing note in `PRIVACY.md`.
- `provider_id`, `model`, `language_hints` are recorded on every job so provenance is auditable and
  quality can be compared across providers without contaminating published content.

Provider quirks to normalise in the adapter (recorded because they are the usual source of bugs):

| Quirk | Normalisation rule |
|---|---|
| Timestamps in seconds vs ms vs "HH:MM:SS.mmm" | Adapter emits **integer milliseconds**; monotonic, non-overlapping |
| Segments with zero-length or inverted ranges | Clamped; invalid segments dropped, and the drop count is recorded on the job |
| Missing/word-level-only output | Sentences reconstructed by punctuation or long gaps; a job that cannot produce segments fails rather than producing one 2-hour block |
| Hallucination on silence (a known Whisper behaviour) | Silence-region detection cross-checks; segments inside detected silence with high text length are flagged `UNVERIFIED` for the reviewer's attention (never auto-deleted) |
| Provider error taxonomies | Mapped to `{ errorCode, retriable }` in our vocabulary |

## 5. Language, code-switching and religious vocabulary

The audio is typically Bahasa Indonesia with embedded Arabic: Qur'anic recitation, hadith,
du'a, and technical terms (e.g. *sanad*, *tasbih*, *fiqh*, *istinja*), plus speaker names and
kitab titles. Local languages (Minang, Javanese, Sundanese) appear in speech too.

Design decisions:

1. `languageHints` is an **ordered set** (default `['id','ar']`), stored on the job and derived into
   provider-specific parameters; a deployment may add a local language.
2. **Code-switching is an explicit, first-class concern** (`docs/transcription/CODE-SWITCHING.md`):
   the product expects mid-sentence switches and must not treat them as errors to be "fixed".
3. **No transliteration, no normalisation, no automatic Arabic correction.** The transcript stores
   what was heard, in the script the speaker used (Arabic words in Arabic script when the model
   emits them; otherwise as emitted), and the reviewer decides.
4. **A domain term list is *forwarded*, not applied.** A deployment may maintain a glossary
   (mosque, speaker, kitab names, common terms) and pass it to providers that support keyterm
   hints. It is never used to auto-replace words in the output (ADR-0012).
5. **Qur'anic recitation is marked, not corrected.** Detected recitation segments are `kind =
   RECITATION`; the reviewer is expected to verify them against the mushaf, and the UI says so.
6. Diacritics: the reviewer may add them; the system never adds them automatically.

## 6. Segmentation

- Provider segments are the base; the reviewer may split/merge.
- Segments are bounded (default ≤ 4,000 chars, target ~300–800) for editor performance and for
  timestamp navigation; a segment must not exceed the audio duration by more than a tolerance
  (2 s) or it is clamped and flagged.
- Segment kinds: `SPEECH`, `RECITATION`, `QUESTION`, `ANNOUNCEMENT`, `SILENCE`, `UNKNOWN`.
  Assignment is best-effort by provider output (and by the reviewer); `UNKNOWN` is an honest value.
- Speaker labels exist but are optional in MVP (a single-speaker kajian dominates). When present
  (Q&A, panel), they come from the provider if it supports diarization, otherwise from the
  reviewer.

## 7. Review workflow

Full detail: `docs/transcription/REVIEW-WORKFLOW.md`. Summary of the gate:

```
DRAFT (machine) ──assign──▶ REVIEW_REQUIRED
   reviewer: listen + edit + mark certainty + resolve/annotate flags
   each save → new immutable TranscriptRevision (ADR-0023), optimistic lock (version)
   ──approve (permission: transcript.approve)──▶ APPROVED (pins approved_revision_id)
   ──publish (permission: content.publish AND event policy allows)──▶ PUBLISHED
```

Reviewer capabilities (specified, not implemented):

| Capability | Requirement |
|---|---|
| Audio playback with rate control, jumping to a segment by clicking its timestamp | FR-TRANSCRIPT-007 |
| Paragraph/segment editing with Arabic-aware text handling (RTL rendering, no ASCII-only validation) | NFR-I18N-003 |
| Marking certainty (`UNVERIFIED` / `UNCERTAIN` / `VERIFIED`) per segment | FR-TRANSCRIPT-008 |
| Speaker labels for Q&A | FR-TRANSCRIPT-007 |
| Search within the transcript | FR-TRANSCRIPT-013 |
| Flagging passages for the speaker's attention (`ASK_SPEAKER`, `CHECK_ATTRIBUTION`, `CHECK_ARABIC`) | FR-TRANSCRIPT-016 |
| Revision history with author/time and the ability to view any prior revision | FR-TRANSCRIPT-009 |
| Explicit approval step listing exactly what will become public | ADR-0012 |
| Unpublish with a reason (owner or moderator) | FR-TRANSCRIPT-012 |

**Blocking rules:** a transcript with unresolved `CHECK_ARABIC` / `CHECK_ATTRIBUTION` flags cannot
be approved unless the reviewer explicitly acknowledges them, in which case the flags remain visible
on the published page as uncertainty markers.

## 8. Provenance (never optional)

Every transcript surface shows:

- `source`: `MACHINE` | `HUMAN` | `MIXED` (ADR-0023 determines it precisely from revision history);
- status label: *"Draf mesin — belum ditinjau"* / *"Perlu ditinjau"* / *"Ditinjau oleh <nama>,
  <tanggal>"* / *"Dipublikasikan <tanggal>"*;
- for published: the approving reviewer's name and the revision number;
- uncertainty markers preserved from review;
- the audio the transcript belongs to, with a link to the exact timestamp.

The **machine draft is retained as revision 1** and is never deleted, so "what the model produced"
is auditable (this protects both the speaker and the platform).

## 9. Failure handling

| Failure | Detection | Behaviour |
|---|---|---|
| Provider unavailable | submit/poll error | job `FAILED` with `retriable: true`; alert; retry with backoff while attempts remain; the audio is unaffected |
| Timeout (> policy limit, default 2× audio duration) | scheduler | `FAILED`; safe to retry; the organizer sees a truthful status |
| Malformed/empty response | schema validation of provider output | `FAILED` (never a partial transcript presented as complete); raw payload stored for diagnosis with a short retention and **no** public exposure |
| Partial result (first N minutes only) | duration mismatch vs asset | `FAILED` with a note "hasil tidak lengkap"; a retry is required — the product does not publish a fragment silently |
| Segment timing invalid | validation | clamp/flag; if > 5% of segments are invalid → `FAILED` |
| Provider returns a different language | language detection check | still creates a DRAFT but flags the whole transcript `UNVERIFIED` and notifies the reviewer |
| Quota/cost limit exceeded | provider quota response | job held (`QUEUED`) with an operator alert; no silent spend |
| Callback repeated | duplicate webhook | idempotent per `(providerJobId, event)` — no second draft (`CONCURRENCY` C9) |
| Reviewer abandons the queue | SLA metric | alert `TRANSCRIPT_REVIEW_REQUIRED` after the configured age; the organizer is told a review is overdue |

## 10. Storage, retention and cost

| Artefact | Storage | Retention (default) |
|---|---|---|
| Raw provider payload | `artifacts/` (private) | 30 days (`RETENTION.md`) |
| Segments | `transcript_segments` | with the transcript |
| Revisions | `transcript_revisions` (JSONB snapshots) | published: 7 years; unpublished drafts: 12 months |
| Transcription derivative audio (16 kHz) | object storage | 30 days after successful transcription |

Cost note: transcription is the most likely per-event cost driver if a hosted provider is used
(2 hours of audio per event). Self-hosting is the default precisely because the cost model must be
predictable for a mosque committee (`OPERATIONS.md` §Cost).

## 11. Explicit non-goals

1. **No real-time/live transcription** in MVP (complex, and it tempts live publication of unreviewed
   text). Documented as OPTIONAL in `docs/transcription/PIPELINE.md`.
2. **No automatic publication**, ever (ADR-0012).
3. **No automatic correction of religious text**, ever.
4. **No AI-generated "answer" surface** ("ask the archive"). Retrieval over transcripts is a search
   feature, not an authority (`PRD.md` NG-10).
5. **No translation.** A transcript is in the language spoken; translation is out of scope and would
   create a second, less-verifiable text.
6. **No diarization requirement.** A Q&A section may carry speaker labels if the provider supports
   it; otherwise the reviewer adds them or leaves them absent.

## 12. Acceptance criteria

1. A machine transcript cannot reach `PUBLISHED` without an approving human revision — asserted at
   API level **and** by a database constraint test.
2. A transcript rendered anywhere always shows its provenance label.
3. Provider output that is malformed, empty, or incomplete produces `FAILED`, never a partial
   "success".
4. Reviewing 1 hour of audio is achievable in ≤ 90 minutes of human effort with the specified
   editor affordances (measured in manual QA with a real reviewer).
5. A repeated provider callback creates exactly one draft.
6. Unresolved `CHECK_ARABIC`/`CHECK_ATTRIBUTION` flags either block approval or remain visible on the
   published page.
7. The published page displays uncertainty markers and the reviewer's identity.
