# CHUNK PROTOCOL

Requirements: FR-AUDIO-004…010 · ADR-0008 (10 s chunks, 5–30 s configurable), ADR-0015 (idempotency) ·
API: `API.md` API-031 · Implementation: `src/features/media/upload-chunk.ts`

---

## 1. Why chunks

A two-hour kajian must not depend on one enormous in-memory browser blob. Chunking gives us: bounded
memory, incremental upload during the event, recoverable sessions, and a resumable transfer over a bad
venue network. It costs us one hard constraint that shapes everything below:

> **Chunks are not independently playable.** In a MediaRecorder WebM stream only the first cluster
> carries container metadata; later chunks are raw continuation. The server must assemble and remux
> before anyone can listen (`docs/media/AUDIO-PIPELINE.md`).

## 2. Capture parameters

| Parameter | Value | Rationale |
|---|---|---|
| Chunk interval | 10 s default (configurable 5–30 s) | 10 s ≈ 16–24 KB @ Opus 24 kbps; small enough to re-send, large enough to not flood |
| Container | `audio/webm;codecs=opus` (negotiated) | Cross-browser since Safari 18.4; Firefox may return Ogg/Opus — the protocol is container-agnostic |
| Channels / rate | Mono, 48 kHz | Matches the source (one microphone/PA feed) |
| Bitrate | 24 kbps (speech) with a documented range | Speech intelligibility, small size |
| Sequence | Monotonic integer starting at 0 | Ordering authority; never reused, never renumbered |
| Hash | SHA-256 of the chunk bytes | Idempotency and integrity |
| Naming | `audio/{organizationId}/{eventId}/{sessionId}/{sequence}.part` | Derived from ids only; no filenames from clients |

## 3. Upload contract (summary — full shapes in `API.md` API-031)

```
POST /api/v1/recordings/{sessionId}/chunks
  headers: Idempotency-Key: <ulid>, Content-Type: application/octet-stream
  body: raw chunk bytes
  query/body metadata: sequence, durationMs, hash, capturedAt, recorderVersion

201 { sequenceAccepted: 12, acceptedUpTo: 12, stored: true }
200 { sequenceAccepted: 7,  acceptedUpTo: 12, stored: true, duplicate: true }
409 { code: "CHUNK_SEQUENCE_CONFLICT", acceptedUpTo: 12 }
413 { code: "CHUNK_TOO_LARGE", maxBytes: 8388608 }
422 { code: "CHUNK_VALIDATION_FAILED", reason: "MAGIC_BYTES" }
503 { code: "UNAVAILABLE", retryAfterMs: 2000 }
```

Rules:

1. **Success means durable.** A success response may only be returned after the bytes exist in object
   storage **and** the chunk row is committed. No optimistic acknowledgements.
2. **Idempotent by (sequence, hash).** Same sequence + same hash → success, `duplicate: true`, no new
   object. Same sequence + different hash → `409`; the server never overwrites silently, and the client
   must fetch state to reconcile.
3. **Order-independent.** Out-of-order arrival is normal; assembly sorts by sequence (C7).
4. **`acceptedUpTo` is the reconciliation primitive.** The client prunes its IndexedDB queue based on
   `acceptedUpTo`, not on its own belief about what was sent.
5. **No filename ever influences storage.** Keys come from ids and sequence.
6. **Caps are enforced server-side:** per-chunk (default 8 MB) and per-session (default 500 MB, ≈ 3 h of
   speech at 48 kbps with headroom); exceeding them is a validation error, not silent truncation.

## 4. Client state machine (recorder)

```
IDLE → RECORDING ⇄ PAUSED → STOPPING → FLUSHING → COMPLETE
                       ↘ GAP_DETECTED (warning, recording continues)
                       ↘ DEVICE_LOST  (warning; may auto-recover)
                       ↘ ENCODER_STALLED (fatal for the session)
```

Client rules:

1. Chunk bytes go to **IndexedDB first**, then to the upload queue. Nothing is lost to a page reload
   (ADR-0022).
2. The queue is pruned only on server acknowledgement (`acceptedUpTo`).
3. Retry with exponential backoff (1 s → 30 s cap) plus jitter; a failed chunk never blocks later
   chunks from being attempted, but the queue is preserved in order for assembly clarity.
4. While offline or failing, the UI says **"belum terkirim"** — never a success tick.
5. Nothing is deleted from IndexedDB until the session is confirmed assembled (`COMPLETE` + asset
   `READY`), so a failed assembly can always be retried from the device.

## 5. Server assembly trigger

Assembly is eligible when: the session is stopped, and the accepted sequence set has no gaps ≤ the last
sequence, and the client's final flush acknowledgement is received (or a configurable grace period
elapses after the last accepted chunk — the "device vanished" case). Gaps never block assembly forever;
they are recorded and reported honestly (`docs/media/AUDIO-PIPELINE.md` §5).

## 6. Failure catalogue (client-visible)

| Situation | Client behaviour | Server state |
|---|---|---|
| Network drop mid-chunk | Backoff, keep queue, banner "jaringan bermasalah" | unchanged |
| Venue Wi-Fi off for 5 min | Queue grows; recording continues; on restore, flush resumes in order | catches up |
| Browser tab closed/reloaded | Session recovered from IndexedDB; sequence continues | unchanged; `recoveryCount` incremented |
| Microphone lost | Warning within ~20 s; gap recorded with timestamps | gap metadata |
| Device changed (Bluetooth) | Detect change; warn; continue if the stream resumes | input device recorded per chunk range |
| Storage outage | Chunks rejected with `UNAVAILABLE`; client keeps queue; retries | no rows written |
| Duplicate upload (retry storm) | Server responds `duplicate: true`; queue prunes | one object |
| Session cancelled by organizer | Client stops recording and flushes what exists; server marks incomplete | partial asset possible, labelled partial |
| Device battery dies | **Nothing is preserved beyond the last flush.** The UI warns at 20%/10% and recommends external power — this limit is stated, not hidden |

## 7. Explicit non-goals

1. No resumable protocol (tus/S3 multipart) in the MVP: with 10 s chunks, object-level idempotency is
   simpler and sufficient (see ADR-0008 alternatives).
2. No client-side transcoding or compression beyond what the encoder already does.
3. No background upload after the tab closes (Service Worker background sync is not used; its
   reliability across browsers is insufficient to promise it).
4. No offline assembly (assembly requires the server; paper/manual paths cover the absence of the
   service).
