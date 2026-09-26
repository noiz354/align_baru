# ADR-0011 — Transcription behind a provider port; self-hosted default

- Status: Accepted · Date: 2026-09-26 · Deciders: AI/transcription architect, Security, SRE
- Requirements affected: FR-TRANSCRIPT-003/004, NFR-PRIV-007 · Related: ADR-0012, `TRANSCRIPTION.md`

## Context

Transcription providers differ in language coverage, code-switching behaviour, pricing model
(per minute vs. per hour), data processing terms, residency, latency, and output shape
(word-level timestamps, diarization, confidence). 2026 published benchmarks put best-in-class
hosted English WER near 5% while Whisper large-v3 sits nearer 15% on hard real-world audio, and
**no provider documents strong Bahasa-Indonesia + Arabic code-switching**, which is exactly our
material: Qur'anic recitation, Arabic terms in an Indonesian sentence, hadith quotations,
names, and technical vocabulary.

The provider decision is therefore *not stable*, while the pipeline around it is. Also, voice
recordings are personal data (`NFR-PRIV-004`); sending them to a third party is a deployment
decision with legal implications (UU PDP cross-border transfer), not a product default.

## Decision

Define a **`TranscriptionProvider` port** in the transcription module with a minimal,
provider-neutral contract:

```ts
interface TranscriptionProvider {
  readonly id: string;                 // 'self-hosted-whisper' | 'hosted-x' | ...
  submit(request: TranscriptionRequest): Promise<ProviderJobHandle>;
  poll(handle: ProviderJobHandle): Promise<ProviderJobStatus>;
  fetchResult(handle: ProviderJobHandle): Promise<ProviderResult>; // neutral segment shape
  cancel?(handle: ProviderJobHandle): Promise<void>;
}
```

- The domain stores **our** types (`TranscriptSegment`, `SegmentCertainty`, timestamps in ms),
  never provider payloads; the raw provider response is stored as an opaque artefact for
  audit/debugging with a retention limit.
- **Default provider: self-hosted Whisper (large-v3 or large-v3-turbo) via `faster-whisper`** on
  a worker with a GPU when available, CPU otherwise. Rationale: no per-minute cost, voice data
  never leaves the operator's boundary, and 99+ language coverage.
- Hosted providers (e.g. Deepgram Nova-3, AssemblyAI Universal, OpenAI `gpt-4o-transcribe`,
  Groq-hosted Whisper) are **OPTIONAL adapters**, enabled per deployment with an explicit
  configuration flag and a documented data-processing note in `PRIVACY.md`.
- Provider choice is recorded on each job (`provider_id`, `model`, `language_hints`) so a
  transcript's provenance is auditable.
- A **provider registry** allows multiple adapters; jobs may specify a provider override for
  experiments with an explicit `experimental: true` label.

## Alternatives considered

- **Single hosted API as the default.** *Costs:* voice data leaves the boundary by default;
  per-minute cost at 2 h/event with no predictability for a volunteer committee; the vendor's
  language behaviour for our domain is unverified; and lock-in to an evolving pricing model.
  *Rejected as default, retained as an OPTIONAL adapter.*
- **Multiple providers fan-out and pick "the best" output.** *Costs:* doubles cost, creates a
  false sense of accuracy, and encourages publishing machine text — contrary to ADR-0012.
  *Rejected.*
- **Provider SDKs used directly in feature code.** *Costs:* vendor types in the domain, an
  untestable pipeline, and a rewrite per provider. *Rejected* (this is what the port prevents).
- **Realtime streaming transcription during the kajian.** *Costs:* enormous complexity
  (per-chunk context loss, re-transcription of overlaps), poor quality on long-form speech, and
  it tempts live publication of unreviewed text. *Rejected for now* (documented as OPTIONAL in
  `docs/transcription/PIPELINE.md`, gated on review workflow maturity).

## Consequences

**Positive:** provider swaps cost one adapter; the default is privacy-preserving and
cost-predictable; jobs can be re-run against a new provider without changing domain data
(segments are ours); A/B comparisons become possible without contaminating published content.

**Negative:** we own model hosting (GPU or slow CPU), which is real operational work — mitigated
by making the default a *worker* concern with a documented minimum spec
(`DEPLOYMENT.md` §Transcription worker); we must normalize provider quirks (timestamp units,
segment shapes, error codes) in one place.

**Neutral:** output quality will vary by provider and audio; this is expected and is precisely
why the human review gate exists (ADR-0012).

## Enforcement

- No import of a provider SDK outside `src/server/transcription/providers/**` (lint rule +
  review).
- Contract tests: every adapter must pass one shared suite over a fixture audio file asserting
  the neutral segment shape, monotonic timestamps, and error mapping.
- A test asserts that `Transcript.source` is `MACHINE` for provider output and that no code
  path sets `source = HUMAN` or `APPROVED` outside the review workflow.

## Revisit trigger

Reopen if: self-hosted WER/cost is materially worse than a hosted option **for our language
mix** in a measured evaluation; or a deployment lacks the hardware for the default and needs a
supported hosted path; or a provider offers documented, benchmarked Indonesian-Arabic
code-switching.
