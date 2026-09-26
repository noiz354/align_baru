# TRANSCRIPTION PIPELINE

Requirements: FR-TRANSCRIPT-001…005 · ADRs: ADR-0011 (provider port), ADR-0012 (human gate),
ADR-0010 (jobs) · Related: `TRANSCRIPTION.md`, `docs/media/AUDIO-PIPELINE.md`, `docs/transcription/CODE-SWITCHING.md`

---

## 1. Stages and states

```
NOT_REQUESTED → QUEUED → PROCESSING → DRAFT → REVIEW_REQUIRED → APPROVED → PUBLISHED
                                   ↘ FAILED (retryable)   ↘ DRAFT (rev #1, verbatim machine output)
```

State authority: `STATE_MACHINE.md` (transcript machine). `DRAFT` is the machine output as received —
never edited, never normalised; it is stored as revision #1 and is permanently retrievable
(ADR-0023). A human review creates new revisions; approval binds a revision number, and publication
serves only that revision.

## 2. Job orchestration

| Step | Job | Behaviour |
|---|---|---|
| Request | `transcription.request` | Validates the audio asset is `READY` (or explicitly `PARTIAL` with the gap manifest attached), the event policy allows it, the duration is under the configured limit, and no in-flight job exists for the asset |
| Submit | `transcription.submit` | Calls the provider port with the ASR derivative (16 kHz mono) + gap manifest + language hints; stores the provider job id |
| Poll / callback | `transcription.poll` | Polls at a backoff schedule (or accepts a signed callback); idempotent by `(providerJobId, event)` (C9) |
| Fetch | `transcription.fetch` | Retrieves the result, validates its shape, and stores the verbatim draft |
| Segment | `transcription.segment` | Normalises the provider's segmentation into our model (segments, timestamps, text, language tags, kind) — structure only, text untouched |
| Flag | `transcription.flag` | Computes advisory flags (gap-adjacent text, very low confidence, long silence, probable recitation markers, code-switch boundaries) |
| Notify | `transcription.notify` | Notifies reviewers that the draft is ready (dedupe key per transcript) |

Rules: every step is idempotent and re-runnable; a failure never partially mutates the transcript (the
draft is written in one transaction); the job records the provider id, model version, language hints and
the exact audio object hash it consumed.

## 3. Provider port (what any adapter must do)

```
interface TranscriptionProvider {
  id: string;                       // stable provider identifier, recorded on every job
  supports(languageHints): boolean; // declared capability, never assumed
  submit(input: {audioUrl, durationMs, languageHints, gapManifest, metadata}): Promise<{providerJobId}>;
  poll(providerJobId): Promise<{status, progress?}>;
  fetch(providerJobId): Promise<{segments, language?, modelVersion}>;
}
```

Adapter obligations:

1. Send **only** the audio and a job reference. Never participant names, contact data, event attendee
   counts or organization identifiers beyond an opaque reference.
2. Report `modelVersion` and any confidence or language metadata the provider returns, unaltered.
3. Fail with a classified error (`PROVIDER_UNAVAILABLE`, `PROVIDER_AUTH`, `PROVIDER_QUOTA`,
   `PROVIDER_REJECTED_INPUT`, `PROVIDER_MALFORMED_OUTPUT`, `PROVIDER_TIMEOUT`) so retry decisions are
   automatic and auditable.
4. Never "improve" text on the way in or out. No post-processing beyond structural segmentation.
5. Respect egress configuration: constructing a hosted adapter when egress is disabled is an error
   (`T-TRANSCRIPT-005`).

## 4. Gap-aware handling (do not let the model invent words)

The ASR derivative is submitted with the gap manifest. The segmenter:

1. Inserts `[jeda]` markers at gap ranges and **never** allows a segment to span a gap.
2. Marks text immediately adjacent to a gap (within 2 s) as `adjacentToGap` for the reviewer.
3. Treats long silence regions as gaps, not as audio to be transcribed (Whisper-family models are known
   to hallucinate over silence — `docs/research/STACK-2026.md` §12).
4. Never fabricates an elapsed duration: the published timeline reflects real audio time.

## 5. Language and code-switching

1. Language hints (e.g. `id`, `ar`, `id+ar`) are sent when the provider supports them; capability is
   queried, not assumed.
2. The draft preserves whatever language tags the provider returns, plus our own regex-based tagging of
   Arabic-script spans (structural only).
3. Code-switched segments are flagged for review (`docs/transcription/CODE-SWITCHING.md`); they are the
   highest-risk content and the highest-value correction.
4. No translation is performed, ever.

## 6. Confidence and flags (advisory only)

| Flag | Source | Meaning for the reviewer |
|---|---|---|
| `LOW_CONFIDENCE` | Provider confidence below threshold (or none reported) | Listen before trusting |
| `ADJACENT_TO_GAP` | Our segmentation | The audio is discontinuous here |
| `POSSIBLE_RECITATION` | Arabic-script span, verse-like phrasing, or provider annotation | Never auto-corrected; verify against audio |
| `PROBABLE_NAME` | Capitalised/proper-noun heuristics | Names are commonly wrong in ASR |
| `LONG_SEGMENT` | Segment > 2× median length | Possible merged turn |
| `EMPTY_OR_NOISE` | Text is punctuation/noise only | Likely silence artefact; verify, mark unintelligible if needed |

Flags are **hints for humans**, never machine decisions, and never displayed to the public as scores.

## 7. Failure taxonomy and retry policy

| Failure | Classification | Retry | User-visible state |
|---|---|---|---|
| Provider 5xx / timeout | Transient | 3 attempts, backoff | `QUEUED` → `PROCESSING` continues; organizer sees "sedang diproses" |
| Auth/quota | Configuration | No automatic retry | `FAILED(CONFIGURATION)`; operator alerted |
| Rejected input (format/duration) | Permanent for that input | No | `FAILED(INPUT)` with a concrete reason (e.g. duration over limit) |
| Malformed output (schema) | Provider defect | 1 retry, then fail | `FAILED(MALFORMED_OUTPUT)`; audio unaffected; manual transcription path offered |
| Empty output (no segments) | Suspicious | 1 retry | `FAILED(EMPTY_OUTPUT)` — never store an empty draft as if valid |
| Partial output (some segments) | Usable but incomplete | No | `REVIEW_REQUIRED` with `partial` flag and the affected time ranges marked |

An empty or malformed draft must never reach the review queue looking like a normal transcript.

## 8. Observability contract for this pipeline

Metrics: `transcription_jobs_total{provider,result}`, `transcription_duration_s`,
`transcription_queue_age_s`, `transcript_review_age_s`; spans `transcription.submit|poll|fetch|segment`
with provider id, duration and result. **No transcript text, no audio, no provider payload** may appear
in telemetry (`OBSERVABILITY.md` §7).

## 9. Cost and capacity notes

- Self-hosted default: Whisper large-v3 (MIT). CPU-only transcription is a batch pattern (nightly);
  GPU reduces a 2-hour file to minutes. Both are documented in `docs/research/STACK-2026.md` §12.
- Hosted providers are optional and cost per minute; the operator dashboard shows minutes processed and
  a monthly estimate with stated assumptions.
- A provider outage must never block attendance, archives or feedback — transcription is asynchronous
  by design precisely so the rest of the product is unaffected.
