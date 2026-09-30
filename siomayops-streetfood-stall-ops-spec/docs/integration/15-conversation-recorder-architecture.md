# Page 15 — Conversation recorder architecture

**Status:** Capability blocked; the route is an informational no-capture boundary only.
**Canonical prompt:** `docs/product/end-to-end-pages/15-conversation-recorder.md`
**Ground truth:** `docs/integration/15-conversation-recorder-ground-truth.md`

## Current safe route

```text
GET /operator/recordings/new
  → static Next.js Server Component
  → informational unavailable state only
  → no session/profile/incident query
  → no browser client component, microphone API, upload form, audio bytes, transcript or analytics
  → inherited global Permissions-Policy keeps microphone=()
```

This route deliberately stops before the authenticated use-case/repository layers: it reads and mutates no protected or personal record. The route does not imply that an authenticated operator has consented, that every conversation participant consented, or that an audio purpose is lawful.

## Field/action truth

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Capability availability | Static product/policy boundary | none | `/operator/recordings/new` | no protected data | **UNSUPPORTED**; explains why capture is unavailable |
| Operator/outlet/current shift | No recorder-specific read model | existing operator/shift rows only for other pages | none from recorder route | no query | **Not shown** |
| Retention choices | none; no approved schedule | none | none | none | **UNSUPPORTED**; no arbitrary duration choices |
| Related incident picker | reporter-self incident read exists separately; no recording linkage | incident rows, no media relation | none from recorder route | no query | **Not shown** |
| Start/stop recording | none; microphone is prohibited | none | none | no audio capture | **UNSUPPORTED**; no control is rendered |
| Upload/audio metadata | generic fake image/document presigner is not valid for audio | no recording/audio table or object adapter | none | no upload | **UNSUPPORTED** |
| Transcript/transcription | no adapter/job/record | none | none | no processing | **UNSUPPORTED** |
| Speaker labels/tags | no annotation model | none | none | no mutation | **UNSUPPORTED** |
| Link recording to incident | no relationship | none | none | no mutation | **UNSUPPORTED** |

## Security and privacy boundary

- No microphone permission is requested. The global `Permissions-Policy` header is not modified. No `getUserMedia`, `MediaRecorder`, audio file input, upload route, or audio object key is introduced.
- No consent checkbox is presented as a substitute for a lawful basis and participant-wide notice/consent policy. No audio consent is stored or inferred from page access.
- No audio, transcript, names/speaker identities, incident links, or notes are accepted. The page sends no API request and emits no recorder analytics.
- Existing `EvidenceStore` supports only JPEG/PNG/WebP/PDF and returns fake presigned URLs; existing Task 11 video storage is a separate silent-video-only pilot. Neither is called by Page 15.
- No recording data model, schema, migration, audit action, or retention schedule is added.

## Future activation requirements (not implemented)

Before any real recording flow can be designed or enabled, the responsible product/privacy/security owners must resolve: legitimate purpose and legal basis; non-coercive worker safeguards and participant notice/consent/refusal; recording length/format/size limits; retention and deletion including replicas/backups; transcription provider/data residency/no-training rules; speaker-label semantics; access/download authorization; DSAR/withdrawal; incident linkage limits; production storage and incident response; DPIA approval and explicit microphone policy/header change. These are governance and product decisions, not values to invent in the UI.

## Persistence truth

```text
AUTHORITATIVE STORE: none for recordings
READ PATH: none for this route
WRITE PATH: none for this route
PRIMARY KEYS / RELATIONSHIPS: none
AUDIO/TRANSCRIPT STORAGE: none
RETENTION / PURGE: undefined; capture remains prohibited
RESTART DURABILITY: not applicable
```
