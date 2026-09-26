# AUDIO

Recording, processing and publishing the audio of a kajian. This is a major subsystem: it must
survive a 2-hour session on a volunteer's phone with unreliable network, and it must never claim to
have saved something it did not.

Requirements: FR-AUDIO-001…017 · ADRs: 0008 (chunking), 0009 (codec/processing), 0022 (client),
0013 (storage) · Pipeline detail: `docs/media/AUDIO-PIPELINE.md`, `docs/media/CHUNK-PROTOCOL.md`,
`docs/media/AUDIO-QUALITY.md`, `docs/media/STORAGE.md`

---

## 1. Conceptual flow

```
Microphone → Recording Session → Audio Chunks → Upload (incremental)
   → Raw Audio (archive master) → Processing (normalise/remux) → Normalized Audio
   → Archive (playback) → Derivative (16 kHz mono) → Transcription
```

Two hard constraints drive the whole design:

1. **Never require the entire recording in browser memory** (`FR-AUDIO-005`, ADR-0008).
2. **Never report success for audio that is not durably stored** (`NFR-REL-002`).

## 2. Roles and policy

| Policy (`recordingPolicy`) | Meaning | Who can listen |
|---|---|---|
| `NONE` | No recording; the operator cannot start one | — |
| `INTERNAL` | Recorded for the mosque's internal use only | Organizers of that event |
| `PUBLISH_AUDIO` | Recording may be published (audio only) | Public, after publication |
| `PUBLISH_AUDIO_AND_TRANSCRIPT` | Audio and transcript may be published (transcript still requires human review) | Public, after publication |

Rules:

- The policy is chosen when the event is published (`I-EVENT-3`) and **snapshotted** onto the
  recording session at start (`I-AUD-1`). Changing the policy mid-session requires an explicit
  acknowledgement and is audited; it never retroactively changes a completed session's obligations.
- The participant-facing event page states the recording intent **before** the event
  (`FR-AUDIO-013`, `PRIVACY.md` §Consent). A participant who attends a session whose policy says
  "recorded and published" has been informed; the product does not claim that attendance alone is
  consent for arbitrary reuse.
- The recorder UI displays the policy in plain language before the start button:
  *"Rekaman ini akan dipublikasikan di halaman umum kajian."*
- `NONE` is a valid and respected choice; the product must not nag organizers to record.

## 3. Recording session states

`PREPARING → RECORDING ⇄ PAUSED → STOPPING → UPLOADING → COMPLETED`
with `RECOVERABLE`, `FAILED`, `ABANDONED` branches. Full transition table:
`STATE_MACHINE.md` §4.

## 4. Operator interface (specification)

`RecordingConsole` (`docs/design/DESIGN-SYSTEM.md` §3.7):

| Phase | What the operator sees | Non-negotiable |
|---|---|---|
| Pre-flight | input device selector, **live level meter**, storage estimate, policy statement, duration estimate, "test level" guidance | Cannot start without a device; can start with a warning if the level is implausible |
| Recording | elapsed time (tabular), level meter, chunk counter, upload state ("Terunggah 34/36 potongan"), connection state, local buffer size, battery/screen-lock warning | Backlog is always visible; a disconnection is never silent |
| Paused | explicit paused panel with the kept duration | Microphone is stopped; the UI says so |
| Stopping | "menyimpan potongan terakhir…" with a countdown of remaining uploads | No navigation away until the queue is flushed or the operator explicitly chooses to leave (with consequences stated) |
| Completed | duration captured, chunks uploaded, gaps (if any), where it went, next step | "Rekaman kosong" is an explicit failure, not a success |
| Failed/Recoverable | what is safe locally, what is uploaded, one action to take | The operator is never told to "try again" when retrying cannot help |

Accessibility: all recorder controls are keyboard-reachable, state changes are announced in a live
region, and the level meter has a **text** equivalent ("level: rendah / baik / terlalu keras") so it
is not colour/visual-only (`NFR-A11Y-006`).

## 5. Microphone permission and devices

| Situation | Behaviour |
|---|---|
| First use | Explain why the microphone is needed **before** the browser prompt (in an operator-facing dialog), then request on an explicit user gesture |
| Granted | Start; show the selected device name |
| Denied (once) | Explain how to re-enable in the browser; offer the device selector refresh; do not loop the prompt |
| Permanently denied | Show a platform-specific instruction (Android/iOS/desktop) and the fallback: use a phone's built-in recorder and upload the file via the "upload existing audio" path (P1) |
| No input devices | Block start with an actionable message |
| Device selected but silent | The watchdog raises `RecordingHealthDegraded { SILENCE }` after 20 s and shows a blocking warning |
| Device disconnected mid-session | `RecordingHealthDegraded { DEVICE_LOST }`; the session stays `RECORDING` but the UI demands attention; on reconnect the operator can continue (a new MediaRecorder instance, same session, next chunk sequence) |
| Device switched (e.g. Bluetooth headset connects) | Detected via `devicechange`; the operator is told and asked whether to continue with the new device (recorded on the session) |
| OS revoked permission mid-session | Treated as device loss; the chunk queue is preserved and uploaded |

**Privacy:** the browser's recording indicator must remain visible; the product never records
without an explicit operator action, never records in the background before the session starts,
and stops tracks on pause/stop/navigation.

## 6. Chunked capture and incremental upload (the resilience core)

- `MediaRecorder.start(chunkSeconds * 1000)` — default 10 s (allowed 3–30 s), so the loss window is
  one chunk.
- Each chunk is written to **IndexedDB before upload** (ADR-0022), with
  `{ sequence, blob, sha256, durationMs, capturedAt, uploadState }`.
- Uploader: ≤ 2 concurrent, exponential backoff with jitter, per-chunk idempotency key, retry
  indefinitely while the session is active (bounded by a max age), surfacing the backlog count.
- Server: `POST /api/v1/recordings/{sessionId}/chunks` (API-031) stores chunk objects under a
  deterministic key and records `recording_chunks` rows with `UNIQUE (session_id, sequence)`.
  Same sequence + same hash = idempotent success; same sequence + **different** hash = `409`
  (never silently overwrite audio).
- Recovery: `GET /api/v1/recordings/{sessionId}/state` returns
  `{ receivedSequences, missingSequences, lastAckAt }`; a reloaded/crashed client re-sends only what
  is missing and reports what was recovered.

Full protocol, key layout and failure behaviour: `docs/media/CHUNK-PROTOCOL.md`.

## 7. Recording health

Health signals (all visible to the operator, all emitting the events in `EVENTS.md` §3.7):

| Signal | Detection | Operator action |
|---|---|---|
| Input too low / silence | analyser RMS below threshold for 20 s | check the microphone position/PA connection |
| Clipping / distortion | peak above threshold repeatedly | move the microphone; check gain |
| Upload backlog growing | pending chunks > N for > 60 s | check connectivity; the audio is still safe locally |
| Connection lost | request failures / `navigator.onLine` | keep recording; the queue will flush |
| Encoder stall | no `dataavailable` for > 3× chunk interval while `RECORDING` | restart the recorder **within the same session**; report the gap |
| Storage pressure | chunk uploads acked but local queue near quota | allow the client to prune acked chunks promptly (never unacked) |
| Screen lock / background | visibility API + wake lock state | the operator is warned that backgrounding may suspend capture on some platforms |
| Duration anomalies | session exceeds 4 h (likely forgotten) | warn; keep recording |

Telemetry (`NFR-OBS-008`): chunk cadence histogram, gap total per session, upload backlog duration.

## 8. Interval, pause, resume, stop

| Action | Semantics |
|---|---|
| Start | `PREPARING → RECORDING`; first chunk scheduled; a policy snapshot is stored |
| Pause | Stops the recorder and the microphone track; the session continues; the UI states the microphone is off |
| Resume | A new MediaRecorder instance in the **same** session; chunk sequences continue; a small boundary discontinuity is expected and recorded as a note on the session |
| Stop | Flush the final chunk, then `UPLOADING`; the session cannot return to `RECORDING` (`STATE_MACHINE.md` §4) |
| Discard | Only before any chunk exists (accidental start); after chunks exist, discarding is a `FAILED`/`ABANDONED` path with a reason and retention consequences |
| Crash / refresh | Server-side session state is authoritative; the client reconciles and resumes uploads |

## 9. Assembly and processing (server side)

Triggered by `CompleteRecording`, executed by the worker (ADR-0020):

1. **Verify** chunk contiguity (sequences 0..N). Gaps are reported, not hidden.
2. **Assemble**: concatenate chunk objects in order into a single stream (server-side, streaming —
   never loading a whole 2-hour file into application memory).
3. **Remux to a seekable container** (ADR-0009): MediaRecorder output has no cues, so seeking in a
   2-hour file would otherwise be unusable. This is mandatory before publication.
4. **Create `AudioAsset(RAW)`** = the archive master (immutable).
5. **Normalise** (`loudnorm`, silence trim) → `AudioAsset(NORMALIZED)` — the playback asset.
6. **Derive** 16 kHz mono → `AudioAsset(TRANSCRIPTION_DERIVATIVE)` — the ASR input, decoupled from
   the master so a provider change does not re-resample audio.
7. Mark the session `COMPLETED` (assembly success is required; processing failures do not un-complete
   a session — they are a separate asset/job state).
8. Emit `AudioProcessingCompleted` → the organizer is told the audio is ready to publish.

Processing is **idempotent per (session, profile, operation)** via job singleton keys and the
`is_current` constraint (`DATA_MODEL.md` §7).

## 10. Publishing and playback

- Publishing is always a human action (`STATE_MACHINE.md` §7). The product never auto-publishes a
  recording after processing.
- Playback uses presigned URLs; the player supports range requests, remembers position locally, and
  offers 0.75×–2× speed.
- Chapters (if provided) appear as markers; chapters may reference transcript timestamps.
- Download is available to organizers/speakers; public download is a per-event policy decision
  (default: streaming only, download disabled for public users — reduces uncontrolled
  redistribution of a speaker's voice).
- An `INTERNAL` policy event never exposes a public player, and any direct link returns an
  explanation, not a 404 (`FR-CONTENT-007`).

## 11. Failure modes (see `docs/architecture/FAILURE-MODEL.md`)

| Failure | Impact | Behaviour |
|---|---|---|
| Microphone permission denied | Cannot record | Instructions + fallback (external recorder + upload) |
| Microphone disconnected | Audio may be silent | Watchdog + explicit warning; recovery via a new recorder instance |
| Network interruption | Chunks queue | Local buffering; backlog visible; flush on reconnect |
| Browser refresh / crash | JS state lost | Chunk queue in IndexedDB + server state reconciliation |
| Tab termination by OS | Recording stops | The session is `RECOVERABLE`; the operator is told exactly what was captured |
| Storage unavailable | Chunks cannot be stored | `DEPENDENCY_UNAVAILABLE`; the client keeps retrying and never claims success; alert `STORAGE_UNAVAILABLE` |
| ffmpeg failure | No playable derivative | Master remains; the job retries; alert `AUDIO_PROCESSING_FAILED` |
| Payload is empty (all silence) | A "recording" of nothing | Health degraded; on completion, a durability check flags a near-silent asset for organizer review before publication |
| Chunk hash mismatch | Possible corruption | `409`; the client re-uploads from local storage; if the local copy is gone, a gap is recorded |
| Clock skew on the client | Wrong `clientCapturedAt` | Server uses its own receive time for `received_at` and derives ordered timing from sequences, not client clocks |

## 12. Multiple sessions and multiple devices

- More than one recording session per event is legitimate (a phone near the pulpit, a PA feed):
  separate sessions, separate assets, **never silently merged** (`FR-AUDIO-015`).
- If two sessions are published, the organizer chooses which is the primary audio; the second is
  offered as an alternative (P2 UI).
- Sessions from the same device for the same event within a few minutes are flagged as likely
  duplicates with an "apakah ini penggantian?" prompt — never auto-deleted.

## 13. Quality guidance (operational, shown in the UI as tips)

- Prefer **line-out/PA feed or a dedicated lavalier** over a phone microphone when available; a
  phone 3–5 m from the speaker in a reverberant hall produces poor ASR input.
- Place the device away from air conditioners, fans, and the PA speaker (feedback and clipping).
- Keep the phone plugged in and the screen-locked behaviour understood; prefer a stable stand over
  a hand.
- Do **not** enable aggressive noise reduction on the phone level if the audio will be transcribed
  (ADR-0009) — the product's default capture config disables it and explains why.

Detail: `docs/media/AUDIO-QUALITY.md`.

## 14. Acceptance criteria

1. A 2-hour session with a 30-minute network outage, one browser crash, and one server restart
   completes with no acknowledged chunk lost (`NFR-REL-001`, Playwright + fault injection).
2. Peak client memory stays bounded (≤ ~3× chunk size) throughout (`ADR-0008` enforcement).
3. Duplicate chunk upload is idempotent; conflicting content for the same sequence is rejected
   (`409`).
4. The recording UI never shows "uploaded" for a buffered chunk (assertion test).
5. The published player streams a seekable asset (remux verified) with chapters navigable.
6. An `INTERNAL` policy event exposes no public audio under any URL (security test).
