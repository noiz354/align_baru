# Page 15 — Conversation recorder analytics contract

**Status:** Recording analytics are unsupported and no Page 15 recorder events are emitted. The route is a static unavailable message only; no capture, upload, transcript, annotation, or incident-link action exists.
**Existing analytics mechanism:** structured logger via feature analytics modules; no competing SDK is needed or added.

## Required event families from the canonical prompt

| Event | Intended trigger (future, not active) | Current properties | Prohibited properties | Current downstream use |
|---|---|---|---|---|
| `recording_started` | Authorized capture starts after approved participant safeguards | **Not emitted** | Raw audio, participant/operator names, transcript/free text, device identifiers, unsupported consent claims | None |
| `recording_stopped` | Capture stops and an approved metadata record is persisted | **Not emitted** | Raw audio, participant/operator names, transcript/free text, device identifiers | None |
| `recording_uploaded` | Validated audio bytes durably stored under approved retention policy | **Not emitted** | Audio bytes/object URL, transcript, participant/operator names, arbitrary metadata | None |
| `transcription_completed` | An approved transcription job completes and persists a transcript | **Not emitted** | Transcript text, raw audio, participant/speaker identity, provider payload | None |
| `recording_linked` | Authorized recording-to-incident relationship is persisted | **Not emitted** | Incident narrative, recording URL/audio/transcript, names or other unnecessary IDs | None |

## Rationale and activation gate

These events describe operations the application does not perform. Emitting them from a static unavailable page or a consent click would falsely imply capture, durable upload, transcription, or linkage. No `recordings_viewed` event is added either; this route does not read or return a recording resource.

Only after the microphone policy, lawful purpose, participant notice/consent, worker safeguards, retention and backup deletion, storage, transcription provider, authorization, and audit controls are approved and implemented should the analytics contract be revisited. The future contract must use stable outcome/status codes and safe request correlation only; never audio, transcript text, names, or unnecessary personal IDs. No analytics SDK, event, or data flow is added in this blocked slice.
