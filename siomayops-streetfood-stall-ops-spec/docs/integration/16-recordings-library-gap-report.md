# Page 16 — Recordings library gap report

**Decision:** NOT DONE. The application has no operational recording records to list; Page 15 capture is prohibited under current privacy/security policy. `/recordings` is informational only and exposes no data or controls.
**Ground truth:** `docs/integration/16-recordings-library-ground-truth.md`
**Architecture:** `docs/integration/16-recordings-library-architecture.md`

## Acceptance matrix

| Requirement | Result | Evidence | Remaining work / impact |
|---|---|---|---|
| `/recordings` route | Informational no-library page only | Static Server Component; targeted UI test passed (3/3); optimized build includes static `/recordings`; local HTTP GET returned 200 with microphone denied in `Permissions-Policy` | Canonical authorized list/search/detail flow not delivered. |
| Scoped recordings/search | **MISSING** | No recording record, repository/read model, route or database relation | Cannot present real rows/search results. Do not fabricate a placeholder recording or claim empty query results. |
| Metadata/transcription status | **MISSING** | No record/transcription model or provider | Must be defined only after Page 15 processing is approved. |
| Audio playback/download | **UNSUPPORTED** | No audio storage/route; microphone is denied; Page 15 has no audio writes | No URL, player, thumbnail, or download control may be exposed. |
| Transcript/manual speaker labels | **MISSING** | No transcript or annotation model | Requires privacy-approved purpose, role/access rules, notice, speaker-label semantics and durable edits. |
| Incident linkage | **MISSING** | No recording-to-incident relation or link mutation | Decide least-data relation and access constraints before creating a schema/API. |
| Retention/access controls | **UNSUPPORTED** | No approved audio schedule, retention job or access model | Define and verify primary plus backup deletion before any audio record exists. Do not copy incident-photo or traffic-video lifetimes. |
| Delete/archive | **UNSUPPORTED** | No recording object or delete boundary | Define lawful erasure, holds, audit, object deletion, backup expiry and recovery behavior first. |
| Authorization | **MISSING for recordings** | Generic evidence permissions exist, but no recording action/object scope | Production auth and tenant/outlet/owner checks must be implemented and tested after policy approval. |
| Analytics | **NOT EMITTED** | No list/detail/search/metadata action exists | `recordings_viewed`, `recording_detail_viewed`, `recording_search_used`, and `recording_metadata_updated` remain absent; emitting them from the static info page would misrepresent capability use. |
| Audit/observability | No recording events | No recording mutations or media access | Do not write fake audit rows or raw content logs. |
| Persistence/restart proof | Not applicable to current page | No recordings can be created | Must prove real scoped records, mutations, reload/restart and deletion if a future capability is approved. |
| CI/runtime | Static route checks only | UI assertion, build and HTTP/header smoke planned | Cannot run list/search, retention/delete, scope, or recording browser flows. No actual browser acceptance claimed. |

## Blocking dependency

The library depends on a recorder that does not exist and may not be activated: `PRIVACY.md` prohibits microphone access; the global Next.js `Permissions-Policy` denies it; Task 11 permits only a separate silent short traffic video, with no HQ media read. There is no approved audio legal basis, participant notice/non-coercion model, DPIA, storage/transcription vendor, retention period, backup deletion proof, recording-specific authorization, or incident linkage policy.

## Stop conditions

- Do not seed fake recordings or imply a database query returned no rows.
- Do not reuse incident narratives/audit logs, silent traffic clips, or generic fake evidence assets as recordings.
- Do not show transcript text, speaker identity/labels, incident links, retention settings, or audio playback.
- Do not enable search/edit/delete endpoints until there are authorized persisted recording resources.
- Do not emit Page 16 analytics events until real list/detail/search/mutation behavior exists.
- Do not change the global microphone denial or mark Task 15/16 complete by UI presence alone.
