# ADR-0008 — Chunked recording with incremental upload and server-side assembly

- Status: Accepted · Date: 2026-09-26 · Deciders: Media architect, SRE, Principal Architect
- Requirements affected: FR-AUDIO-005…009, NFR-REL-001, NFR-REL-005
- Related: `AUDIO.md`, `docs/media/CHUNK-PROTOCOL.md`, ADR-0022, `docs/architecture/FAILURE-MODEL.md`

## Context

A kajian recording runs 60–150 minutes. The simplest browser pattern — collect every
`dataavailable` blob into an array and `new Blob(chunks)` at the end — has three fatal
properties:

1. **Memory.** Opus at 32 kbps is ~1.4 MB/hour, which is survivable, but browsers buffer
   encoder state and users' devices are 2–4 GB RAM phones with other tabs open. A single
   2-hour `Blob` construction at stop time (copying + container finalisation) is a real OOM
   risk on a low-end Android device, and it fails **at the worst moment** — after the talk.
2. **Total loss on interruption.** A refresh, a crash, a killed tab, or a dead battery
   destroys everything. The teaching is gone and there is no recovery.
3. **Upload at the end.** A 2-hour file uploaded over mosque Wi-Fi at the end of the session
   either fails or blocks the operator from leaving.

## Decision

Record in **short timeslices and upload incrementally**, never holding the full recording in
memory:

- `MediaRecorder.start(10_000)` (10-second chunks; tunable 5–30 s per deployment).
- Each chunk is immediately handed to an **upload queue** persisted in IndexedDB
  (metadata + blob), keyed by `(sessionId, sequence)`.
- The client uploads chunks as independent requests
  `POST /api/recordings/{sessionId}/chunks` with `sequence`, `durationMs`, `contentType`,
  `sha256`, `idempotencyKey`.
- Chunks are stored in object storage under
  `audio/{org}/{event}/{session}/{sequence}.part` and recorded in a `recording_chunks` table
  with `UNIQUE(session_id, sequence)`.
- On `CompleteRecording`, a worker **assembles** chunks in sequence order, verifies contiguity
  and hashes, and produces the canonical asset via ffmpeg (ADR-0009).
- The client's local queue is only cleared after server acknowledgement for that sequence.
- Recording state is recoverable: `GET /api/recordings/{sessionId}/state` returns
  `{receivedSequences, missingSequences, lastAckAt}` so a refreshed/crashed browser can resume
  and re-send only what is missing.

## Alternatives considered

- **Single blob at the end (`ondataavailable` → array → upload).** Simple, widely documented,
  and exactly the anti-pattern the requirements forbid (`FR-AUDIO-005`). *Rejected:* unbounded
  memory, total loss on interruption, upload cliff.
- **WebSocket streaming of raw PCM to the server, recording server-side.** *Gains:* no client
  buffering, gapless audio, seekable output. *Costs:* a stateful long-lived connection per
  session, server-side session storage, reconnect logic that is harder than HTTP retries, and a
  failure mode where a socket hiccup loses audio the client already encoded. *Rejected for
  Phase 1*; kept as an OPTIONAL operator-station feature for a future fixed installation.
- **AudioWorklet + client-side Opus/WASM encoding + PCM fallback.** *Gains:* gapless, no
  container quirks, verifiable chunk boundaries, no encoder stalls. *Costs:* we own an encoder
  wrapper, ~115 MB/hour if we fall back to PCM 16 kHz mono, and materially more client code to
  test on low-end devices. **Evaluated and not selected as the primary path**; the escape hatch
  if MediaRecorder proves unreliable in the field (see Revisit trigger).
- **Record separately on the operator's phone (native recorder) and upload later.** *Gains:*
  reliability of a native app. *Costs:* no lifecycle integration, no live health telemetry, no
  resumable upload, and manual file management by a volunteer. *Rejected as primary; kept as
  the documented manual fallback* (`AUDIO.md` §Fallback).
- **Continuous fragmented MP4/WebM upload to a media server (ffmpeg ingest).** *Costs:* a
  stateful ingest service, harder retries, and an operational dependency we do not want.
  *Rejected.* (Decision recorded despite plausibility because it is the most tempting wrong
  answer for someone who has built streaming pipelines.)

## Consequences

**Positive:** bounded memory (a few chunks in flight, ~1–2 MB); a crash loses at most one
chunk interval; uploads overlap the talk instead of following it; assembly is idempotent and
re-runnable; gap reporting is possible because sequences are explicit.

**Negative:** **chunk N is not independently playable** — WebM/Opus from MediaRecorder is a
continuous stream where only the first chunk carries container headers, so assembly must
concatenate in order and be finalised server-side; MediaRecorder output is **not seekable**
(no SeekHead/Cues), which is why ffmpeg remux is mandatory before publication; and each chunk
is not guaranteed to start on a clean frame boundary, so a naive cut can produce a click —
acceptable for speech, documented in `AUDIO.md` §Quality.

**Neutral:** the 10 s timeslice is a trade-off between upload frequency (battery, requests) and
loss window; it is configurable and measured (`NFR-OBS-008`).

## Enforcement

- The recorder client must never accumulate all chunks in memory: a code review checklist item
  plus a test that asserts the client's total buffered bytes stay below ~3× the chunk size.
- `UNIQUE(session_id, sequence)` makes duplicate uploads harmless; a test uploads the same
  chunk twice and asserts identical resulting asset.
- Assembly refuses to finalise with missing sequences below the highest received sequence
  unless an explicit `allowGaps` flag with a reason is supplied (recorded on the session).
- A Playwright test simulates: refresh mid-session, network loss for 60 s, and duplicate chunk
  delivery, and asserts no acknowledged audio is lost.

## Revisit trigger

Reopen if production telemetry shows **either**: (a) chunk cadence gaps > 500 ms affecting > 5%
of sessions or any sustained encoder stall > 5 s per session; or (b) more than 1 in 50 sessions
losing an acknowledged chunk. The planned response is the AudioWorklet + WASM Opus path with
PCM fallback, delivered behind the same `RecordingTransport` port.
