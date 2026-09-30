# Page 16 — Recordings library architecture

**Status:** Capability blocked; `/recordings` is an informational no-library boundary only.
**Canonical prompt:** `docs/product/end-to-end-pages/16-recordings-library.md`
**Ground truth:** `docs/integration/16-recordings-library-ground-truth.md`

## Current safe route

```text
GET /recordings
  → static Next.js Server Component
  → explains recordings/library are unavailable under current policy
  → links to Page 15 informational status only
  → no session/profile/recording/incident query
  → no list/search/detail/audio player/transcript/actions/API/analytics
  → inherited Permissions-Policy keeps microphone=()
```

The route contains no operational records. It does not infer that the operator has a recording, nor does it render an empty search result that could be mistaken for a real library response. It does not read protected data, so it does not need a recording-specific authorization boundary; none exists today. Verification: the route is static in the successful production build; its targeted UI test passes; local HTTP GET returned 200 with `microphone=()` and no media or interaction controls in the server-rendered response. This is not browser or production acceptance.

## Field/action truth

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Availability statement | Current app/privacy policy | none | `/recordings` static route | no data scope | **UNSUPPORTED** library explained honestly |
| Recording count/list/search | none | none | none | no recording query | **Not shown** |
| Detail/audio playback/transcript | none | none | none | no recording resource or permission | **Not shown** |
| Incident links | no recording relation | incidents exist independently | none from this route | no linkage | **Not shown** |
| Retention/access state | no approved audio retention/access policy | none | none | no setting or row | **Not shown** |
| Speaker labels/tags/notes | no annotation model | none | none | no mutation | **Not shown** |
| Delete/archive | no recording object | none | none | no delete contract | **Not shown** |
| Search/filter | no repository/read model | none | none | no query | **Not shown** |

## Authorization and privacy boundary

- Page 16 neither lists nor exposes recordings, so there is no API resource against which a recording role/scope can be meaningfully enforced. Do not treat generic `evidence:view` as a recording-library permission.
- No operator, outlet, incident, or transcript metadata is queried or returned.
- The route does not include audio/video/player elements, search form, transcript content, file links, delete controls, or retention selectors.
- Page 15 is blocked by the global microphone denial and current privacy policy. Page 11 traffic media is a separate silent/video-only workflow with its own strict retention and no HQ read endpoint; it is not part of the library.
- Existing generic image/document evidence signing is fake and is never called.

## Persistence truth

```text
AUTHORITATIVE STORE: none for operational recordings
READ PATH: none
WRITE PATH: none
PRIMARY KEYS / RELATIONSHIPS: none
SEARCH INDEX: none
RETENTION / DELETE: none; no recording data accepted
RESTART DURABILITY: not applicable
ANALYTICS: no Page 16 event emitted because no library resource/action exists
```

## Activation dependency

Page 16 requires an approved and implemented Page 15 recording purpose. Before enabling a library, establish lawful purpose, non-coercive participant safeguards and notice, a storage/retention/backup deletion model, transcription rules, recording-specific read/update/delete permissions, incident-link rules and DPIA/security acceptance. This page must remain informational until that work is complete.
