# Page 16 — Recordings library analytics contract

**Status:** No Page 16 analytics are emitted. The route is a static unavailable explanation; there is no recording library resource, search, detail read, or metadata mutation.
**Existing mechanism:** structured logger via current feature analytics modules; no new SDK is introduced.

## Required event families from the canonical prompt

| Event | Intended trigger (future, not active) | Current properties | Prohibited properties | Current downstream use |
|---|---|---|---|---|
| `recordings_viewed` | Authorized scoped library records successfully returned | **Not emitted** | Recording IDs, transcript, audio/object URLs, user/operator names, unnecessary org/outlet identifiers | None |
| `recording_detail_viewed` | Authorized detail metadata returned | **Not emitted** | Raw audio, transcript, speaker names/identity, incident narrative, private URLs | None |
| `recording_search_used` | A real scoped search/filter is executed | **Not emitted** | Search text, transcript terms, participant names, recording IDs or arbitrary query contents | None |
| `recording_metadata_updated` | An authorized persisted metadata/annotation update succeeds or fails | **Not emitted** | Raw notes/tags, transcript, audio, participant identity, arbitrary IDs | None |

## Rationale and activation gate

No real recordings exist in the app, and Page 15 cannot capture or upload audio under current policy. Emitting a page-view/search/detail/update event from the explanatory page would misstate capability usage. In particular, the page performs no recording query, so even `recordings_viewed` would be misleading.

Only after Page 15's lawful purpose, participant safeguards, DPIA, storage/retention/deletion, transcription rules, recording access policy and actual persisted library are approved and implemented should these events be wired. Future telemetry must use stable action/outcome codes and safe correlation IDs; never record raw audio, transcript/search text, speaker identity, private object URLs, or unnecessary personal IDs.
