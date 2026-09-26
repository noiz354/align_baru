# AUDIO PIPELINE

Requirements: FR-AUDIO-010…017 · ADRs: ADR-0008 (capture), ADR-0009 (processing), ADR-0010 (jobs),
ADR-0013 (storage) · Related: `AUDIO.md`, `docs/media/CHUNK-PROTOCOL.md`, `docs/media/STORAGE.md`

---

## 1. Stages

```
capture → buffer → chunked upload → chunk store → assembly → remux/master → normalize/derive → asset
 (device)  (IndexedDB)   (HTTPS)      (S3 partial)   (job)        (job)            (job)         (READY)
```

Each arrow is a **commit point** with an explicit state; nothing is inferred from the presence of bytes
alone, and every stage is idempotent and re-runnable (`docs/architecture/FAILURE-MODEL.md`).

## 2. State model (session and asset)

| Session state | Meaning |
|---|---|
| `IDLE` | Created, nothing captured |
| `RECORDING` / `PAUSED` | Client-side truth mirrored to the server on start/pause/resume events |
| `STOPPING` | Stop requested; client flushing |
| `UPLOADED` | All expected chunks accepted (or the gap-grace period elapsed) |
| `ASSEMBLING` → `ASSEMBLED` | Server concatenation complete, master object exists |
| `PROCESSING` → `PROCESSED` | Normalised seekable master + 16 kHz derivative exist |
| `READY` | Playable asset available for authorized roles |
| `PARTIAL` | Playable but with recorded gaps; labelled honestly |
| `FAILED` | A stage exhausted retries; the reason is stored and surfaced |
| `ABANDONED` | No chunks ever arrived (device never started uploading) |

Machine-defined transitions live in `src/domain/audio/*.transitions.ts`; `FAILED`/`PARTIAL` are
**terminal for the stage**, not for the session — a retry creates a new attempt with the previous
attempt preserved.

## 3. Assembly

1. **Input set:** chunk rows for the session, ordered by `sequence`; each row carries byte size, hash,
   duration and storage key.
2. **Gap handling:** missing sequences are *not* silently concatenated as if continuous. The assembler
   produces the master from the available ranges and emits a gap manifest
   (`[{afterSequence, missingCount, estimatedMs}]`). The session becomes `PARTIAL` when any gap exists.
3. **Concatenation:** raw byte concatenation of the WebM/Opus parts is **not** valid media beyond the
   first part; the assembler therefore hands the ordered parts to ffmpeg's concat demuxer (or an
   equivalent container-aware path) to produce a decodable stream.
4. **Output:** `audio/{org}/{event}/{session}/master.ogg` (Opus in Ogg — seekable), plus a processing
   manifest containing the ffmpeg version, the ordered sequence list, and the gap manifest.
5. **Verification before success:** `ffprobe` duration within one chunk interval of expected; decodable
   first and last 5 seconds; object size > 0; hash of the produced object recorded.
6. **Idempotency:** assembly is keyed by (session, attempt); re-running produces a new attempt and marks
   the newest as current via a partial unique index (`is_current`), so a retry can never leave two
   "current" masters (C11).

## 4. Processing (normalise + derive)

| Step | Operation | Failure mode | Retry |
|---|---|---|---|
| Decode | Decode the assembled stream to PCM | Truncated/corrupt → fail with the offending range | No (bad input) |
| Clean | DC offset removal, 60 Hz high-pass | — | Yes |
| Loudness | Two-pass loudness normalisation to −16 LUFS, true peak ≤ −1.5 dBTP | Encoder limitation → accept nearest, record actual | Yes |
| Master encode | Opus 48 kHz mono into a seekable container | Disk/CPU limits | Yes |
| Derivative | Decode + resample to 16 kHz mono (ASR input, FLAC/WAV per provider contract) | Resampler failure | Yes |
| Manifest | Write config version, versions, durations, hashes | — | Yes |

Rules: processing reads **only** the master; it never reads partial chunks (so the master remains the
single source of truth); the ASR derivative is regenerable at any time; the configuration version is
recorded so a later re-process is explainable.

## 5. Gap and partial handling

1. Gaps are **first-class data**, not errors: `gap_manifest` is stored with the asset and shown in the
   operator summary and on the organizer's event card.
2. A `PARTIAL` asset is playable and publishable **with the gap disclosed** in the published page's
   provenance block ("rekaman memiliki jeda 2 m 10 d pada 00:48:12").
3. The transcription pipeline receives the gap manifest so the provider boundary does not create
   invented words (see `docs/transcription/PIPELINE.md` §4): the segmenter marks gap regions as
   `[jeda]` rather than letting the model hallucinate across silence.
4. A partial recording never blocks attendance, reporting or archives.

## 6. Failure model and recovery

| Failure | Detection | Behaviour | Recovery |
|---|---|---|---|
| Upload never completes | No chunks for > 24 h after a session stop | Session `ABANDONED`; organizer notified | Re-record or accept no audio |
| Chunks missing after flush | Gap manifest non-empty | Assemble what exists, mark `PARTIAL` | Client device may still hold un-flushed chunks: a "resume upload" path exists while the session is not yet assembled |
| Assembly fails | Job error (container malformed) | `FAILED` with reason `ASSEMBLY_INVALID_INPUT`; partial chunks retained | Retry after inspecting; if persistent, the chunks are preserved for manual intervention |
| Processing fails | Job error | `FAILED` with stage and reason; master retained | Retry; if the encoder is the cause, re-process after a worker update |
| ffmpeg missing/misconfigured | Media worker health check | Jobs are not claimed; alert | Fix the image; queued jobs resume |
| Storage full/unavailable | Storage op error | No partial writes; retry with backoff; alert | Restore storage or free space |
| Worker restart mid-job | Job lease expiry | Job re-claimed; idempotent by attempt key (C11) | Automatic |
| Clock skew across workers | Timestamps inconsistent | Timestamps are recorded at stage entry from the DB clock, not the worker clock | — |

## 7. Operability

| Concern | Requirement |
|---|---|
| Progress visibility | Each stage writes progress rows (bytes processed / total) so the UI can show a real percentage, not a spinner |
| Cancellation | An organizer can cancel assembly/processing before `READY`; cancellation is recorded and the master (if produced) is retained for audit unless retention removes it |
| Resource limits | Media worker: CPU/memory/time limits per job; high-pass/loudness work is bounded by audio duration; hard timeout = 4× audio duration |
| Retry policy | 3 attempts with backoff for transient causes; non-retryable causes fail immediately with a classification |
| Cost control | Processing cost is CPU time; the operator dashboard shows hours processed and a monthly estimate (`ANALYTICS` cost card) |
| Version pinning | The ffmpeg build string is recorded on every asset; the image is pinned by digest |

## 8. What the pipeline refuses to do

1. Never modify a master audio after creation (re-processing produces a **new** master version, with the
   old one retained per retention rules).
2. Never assemble from a partial set and present it as continuous.
3. Never run a third-party binary on unvalidated bytes (`T-SEC-005`).
4. Never transcode into a lossy format for archival storage of the master beyond the documented config.
5. Never delete partial chunks before assembly verification succeeds.
