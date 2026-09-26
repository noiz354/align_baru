# ADR-0022 — Recording client architecture: MediaRecorder + analyser + persisted upload queue

- Status: Accepted · Date: 2026-09-26 · Deciders: Media architect, UX engineer, SRE
- Requirements affected: FR-AUDIO-002…008, NFR-PERF-010, NFR-MOB-002 · Related: ADR-0008, `AUDIO.md`, `docs/media/CHUNK-PROTOCOL.md`

## Context

The recorder is the most stateful client in the product and must survive real-world hostility:
a volunteer taps start 5 minutes before the talk; the phone may get a call, the screen may lock,
Wi-Fi may drop, the tab may be refreshed by accident, and the session may run for 2.5 hours.

Browser realities (2026): `MediaRecorder` is available everywhere, Opus-in-WebM is supported in
Chrome/Firefox/Safari 18.4+, `getUserMedia` requires a secure context and a user gesture,
background tabs may be throttled or suspended, and a page reload destroys all JS state.

## Decision

Client architecture in four separated concerns, each independently testable:

1. **Capture** — `getUserMedia({ audio: { channelCount: 1, echoCancellation: false,
   noiseSuppression: false, autoGainControl: false, deviceId } })`, then
   `new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond })`,
   started with a **timeslice** (default 10 s) so chunks arrive continuously.
2. **Health & metering** — a Web Audio graph (`MediaStreamSource → AnalyserNode`) drives the
   level meter and silence/clipping warnings, plus an `AudioContext`-based watchdog that fires
   if the analyser reports pure silence for > 20 s while recording (indicating a muted or lost
   device). The analyser never feeds the encoder (no gain processing by default —
   ADR-0009).
3. **Durable local queue** — every chunk is written to **IndexedDB** (`{sessionId, sequence,
   blob, sha256, durationMs, createdAt, uploadState}`) *before* any upload is attempted. The
   queue is the source of truth for "what is still pending"; the UI reads its counts, so the
   displayed backlog is honest even after a reload.
4. **Uploader** — a serial-with-bounded-parallelism uploader (default 2 in flight) with
   exponential backoff + jitter per chunk, resumable across reloads. On `CompletionRequested`,
   it flushes the queue, then calls the completion endpoint and only then marks the session
   locally complete.

Additional rules:

- **Session identity** is server-issued (`recordingSessionId`) and resumable: on load, the
  client calls `GET /api/recordings/{id}/state` to reconcile local queue vs. server ack, and
  re-sends only missing sequences (`FR-AUDIO-008`).
- **Recovery on reload** is automatic and silent for resendable chunks, but the UI *states* what
  happened ("Terputus. 4 potongan belum terunggah — mengirim ulang."). No false success.
- **Device change / track ended** handlers surface a blocking warning with an explicit
  "lanjutkan" — the recorder never silently continues recording silence.
- **Visibility/background handling:** recording continues while the tab is backgrounded where the
  platform permits; the UI tells the operator that keeping the screen awake is recommended and
  shows a wake-lock request button (`navigator.wakeLock` with graceful absence handling).
- **No long-running in-memory arrays.** The only blob held is the chunk currently being written
  and at most a small retry window.
- **Testability:** capture, metering, queue and uploader are separate modules behind ports
  (`CaptureEngine`, `LevelMeter`, `ChunkQueue`, `ChunkUploader`) so they can be exercised
  independently with synthetic streams in Vitest browser mode and Playwright.

## Alternatives considered

- **Keep chunks in a React state array and upload at stop.** *Rejected:* memory risk, total loss
  on reload (violates `NFR-REL-001`), and no honest backlog display.
- **Upload directly from `ondataavailable` without a durable queue.** *Costs:* a crash loses
  un-uploaded chunks; no offline tolerance; retries impossible. *Rejected.*
- **Service worker–driven upload (Background Sync).** *Gains:* uploads continue with the tab
  closed. *Costs:* Background Sync is unavailable in Safari, semantics differ across browsers,
  and it obscures the operator's mental model of what is uploaded. *Deferred* (OPTIONAL
  enhancement layered on the queue, since the queue design already supports it).
- **AudioWorklet + WASM Opus encoder.** *Costs:* significant client complexity; see ADR-0008
  (kept as the documented escape hatch behind `CaptureEngine`).
- **Recording in a dedicated native app / operator station.** *Rejected:* the whole point is a
  browser-first, no-install workflow (`ADR-0027`).
- **Keeping the microphone stream alive without recording during pause.** *Costs:* privacy
  confusion (mic indicator on while "paused") and battery. *Rejected:* pause stops the recorder
  and the UI indicates the paused state clearly; on resume a new MediaRecorder is started into
  the **same session** with the next chunk sequence.

## Consequences

**Positive:** bounded memory; honest state after crashes; a resumable session; the backlog is
visible to the operator; the pieces are individually testable; the design anticipated a
service-worker uploader without redesign.

**Negative:** two storage locations for the same chunk briefly (memory + IndexedDB) with
integrity checks needed; IndexedDB quota can be exhausted on a low-end phone over 2.5 hours
(~30–40 MB is usually fine, but the UI must warn and offer to reduce the timeslice/bitrate);
pause/resume creates a chunk boundary that may produce a small audible discontinuity (accepted,
documented, and noted on the session).

**Neutral:** the audio graph adds a small CPU cost, but avoids the "recording silence" failure
that has no other reliable detector.

## Enforcement

- The client must never construct a `Blob` from all chunks; a review checklist item plus a test
  asserting peak in-memory buffered bytes ≤ 3 × chunk size.
- IndexedDB writes must precede upload attempts; a unit test asserts ordering.
- Uploader must be idempotent per sequence and must reuse the same idempotency key on retries;
  a test asserts duplicate sends produce one server-side chunk.
- A Playwright test performs: start → 3 chunks → reload → assert state reconciliation → resume
  → stop → assert server has a contiguous sequence.
- Wake-lock absence must not break anything (feature-detected).

## Revisit trigger

Reopen if: IndexedDB quota exhaustion is observed in the field; MediaRecorder chunk gaps exceed
the telemetry threshold in ADR-0008's revisit trigger; or Background Sync becomes uniformly
available and materially improves recovery for closed tabs.
