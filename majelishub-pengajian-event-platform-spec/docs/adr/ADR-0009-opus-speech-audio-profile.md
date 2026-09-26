# ADR-0009 — Opus speech profile, canonical archive + derived assets, ffmpeg normalisation

- Status: Accepted · Date: 2026-09-26 · Deciders: Media architect, SRE
- Requirements affected: FR-AUDIO-010/012, FR-AUDIO-016 · Related: ADR-0008, ADR-0020, `docs/media/AUDIO-QUALITY.md`

## Context

The audio is **speech**: a single speaker (occasionally a second), a room with reverberation
and possibly a PA system, recorded on a phone or laptop at a mosque, and expected to remain
intelligible for years. It will be streamed to participants on mobile data, and fed to a
speech-to-text provider.

Constraints: browsers can encode only what they support (Opus-in-WebM universally by 2026);
storage cost is the operator's money; and the flow from record → publish should not require a
media engineer.

## Decision

**Capture:** Mono, 48 kHz sample rate, **32 kbps** target Opus in WebM (`audio/webm;codecs=opus`),
`echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false` by default (a
phone's aggressive DSP damages speech for ASR; a deployment may enable them for
speakerphone-only setups and the choice is recorded on the session). Stereo is not used: the
speaker is one source and stereo doubles storage for no intelligibility gain.

**Archive master:** after assembly, ffmpeg remuxes the concatenated stream into a **seekable**
container (Ogg/Opus) at the same nominal bitrate — bit-preserving where possible, no
re-encoding unless required for correctness. This is the immutable artefact of record.

**Published derivative:** loudness-normalised Opus (EBU R128 / `loudnorm`, −16 LUFS integrated
target for speech) with silence-trimmed edges, mono, 32 kbps, seekable. This is what
participants stream.

**Transcription derivative:** 16 kHz mono, PCM WAV or lossless FLAC, decoupled from the master
(ASR models are trained at 16 kHz; resampling must not be repeated per provider request).

**Processing location:** ffmpeg runs **only in the worker container** with a pinned version and
a per-job CPU/time limit. Browser-side encoding beyond MediaRecorder is out of scope.

**Never:** re-encode a master into a lossy format and delete the master; store only "the final
MP3"; apply aggressive noise reduction (it damages ASR accuracy and can make a Qur'anic
recitation sound wrong — an unacceptable artefact in this domain).

## Alternatives considered

- **Uncompressed WAV/PCM capture in the browser.** *Costs:* ~690 MB per 2 h at 48 kHz stereo /
  ~115 MB at 16 kHz mono; upload cost on 3G; browser memory pressure. *Rejected* as the capture
  format (kept as the transcription derivative format server-side).
- **64–128 kbps Opus/Vorbis.** Diminishing intelligibility return for speech, doubled storage.
  *Rejected* as default; allowed per deployment for high-value archives (e.g. Qur'anic
  recitation quality recordings) with a documented cost implication.
- **MP3/AAC derivatives for compatibility.** Not needed: every target browser (2026) plays Opus;
  producing MP3 also costs a second processing pass. *Rejected* (documented as an OPTIONAL
  export if a deployment needs it for editing software).
- **Cloud media transcoding service.** *Costs:* egress of voice data to a third party,
  per-minute pricing, another vendor. *Rejected.*
- **Normalising in the browser.** *Costs:* CPU on a volunteer's phone, inconsistent results,
  and it destroys the raw master. *Rejected:* the master stays raw, normalisation happens
  server-side and is a separate asset.

## Consequences

**Positive:** ~28 MB per 2-hour session (raw) + ~28 MB (derivative) + ~230 MB (16 kHz WAV
transcription derivative, deletable after transcription — see `RETENTION.md`); intelligibility
optimised by avoiding destructive DSP; a single pinned ffmpeg version makes output
reproducible; the master is preserved for future re-processing.

**Negative:** Opus support in some desktop audio editors is weaker than WAV (mitigated by the
optional export); a loudness-normalised derivative can slightly raise room noise between
sentences (documented, and the master is retained); ffmpeg is a large binary that must be
pinned and patched in the worker image.

**Neutral:** the transcription derivative is the single largest storage item per session, which
is why its retention is short by default (`RETENTION.md` §Audio derivatives).

## Enforcement

- A processing test asserts: derivative is seekable, mono, ≤ 1.2× the master's size, and within
  ±1 LU of the target loudness on a fixture file.
- A test asserts the master is **not** deleted when a derivative is produced.
- The worker's Dockerfile pins ffmpeg by version and digest; CI fails if the digest changes
  without an ADR amendment.
- Recording sessions with `echoCancellation`/`noiseSuppression` enabled must record that fact
  in session metadata (so a future investigation can explain ASR quality).

## Revisit trigger

Reopen if: (a) ASR accuracy analysis shows systematic failure attributable to capture
configuration; (b) storage cost per event exceeds the documented ceiling in `OPERATIONS.md`;
or (c) a deployment needs lossless masters for recitation (then introduce a per-event
`captureProfile: SPEECH | RECITATION`).
