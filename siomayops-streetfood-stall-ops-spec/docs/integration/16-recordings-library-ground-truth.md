# Page 16 — Recordings library ground truth

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/16-recordings-library.md`
**Target:** `/recordings`
**Audit boundary:** repository, schema, storage, authorization, privacy/retention policy, and Page 15 implementation inspected before Page 16 source edits.

## Current implementation truth

| Capability | Status | Evidence / boundary |
|---|---|---|
| `/recordings` library/detail route | **INFORMATIONAL ONLY** | `src/app/recordings/page.tsx` explains the unavailable boundary; no list/detail route or recording API exists. |
| Existing recorder source | **UNSUPPORTED** | Page 15 route `/operator/recordings/new` is informational only and explicitly says no microphone permission, recording, upload, transcript, retention option, or incident link is available. |
| Recording entities and durable metadata | **MISSING** | No `StoredRecording`, recording map, recording table, metadata repository, or audio object relation exists in `memory-store.ts`, `schema.ts`, `src/domain`, or `src/features`. |
| Scoped recording reads/list/search | **MISSING** | No recordings read model, list/search query, detail query, or `GET /recordings` API exists. The UI has no real recording records to render. |
| Transcription status/transcript | **MISSING** | No transcript record, transcription provider/job, job status, or transcript API exists. |
| Incident linkage | **MISSING** | `StoredIncident` and Task 13/14 incident projections have no recording/evidence relation. No recording-to-incident link API or join exists. |
| Retention/access settings | **MISSING / NOT AUTHORIZED** | `RETENTION.md` has no recording/audio/transcript schedule; Page 15 documents no duration and explicitly blocks audio processing pending review. There is no retention setting or deletion workflow for recording assets. |
| Manual speaker-label edits/tags/notes | **MISSING** | No recording annotation schema, use case, API, or audit action exists. Do not invent speaker identity, tags, notes, or update success. |
| Raw media storage/read/delete | **UNSUPPORTED for recordings** | Generic `EvidenceStore` only accepts image/PDF MIME types and returns fake in-memory presigned URLs. `traffic-video-store.ts` stores only separate short silent Page 11 traffic clips; HQ read/download is not implemented and Task 11 privacy controls prohibit repurposing it. Neither is an operational recordings library. |
| Evidence permission | **PARTIAL, not sufficient** | Existing generic `evidence:view`/`evidence:upload` role actions do not authorize audio, transcripts, recording search, or a library. No recording-specific action, resource scope, or policy exists. |
| Authentication/session | **PARTIAL** | Existing development fake `SessionContext` and route auth patterns exist; production session resolution is unavailable/fails closed. No recording-specific authorization boundary exists. |
| Analytics | **MISSING / NOT EMITTED** | Required Page 16 event names are prompt requirements only. No recordings view/search/detail/metadata mutation exists to emit honestly. Page 15 analytics documentation explicitly says no recording data flow exists. |
| Persistence/restart durability | **MISSING for recordings** | App business data uses local JSON-backed `memoryStore`; Drizzle schema describes PostgreSQL, but there is no recording schema/migration, record to persist, or repository path to prove restart durability. |
| Product/task tracking | **MISSING** | `TASKS.md` contains `T-REC-001/002` for operator recognition—not recordings. There is no recordings-library task. Do not conflate recording records with recognition results. |

## Required page-data matrix (current state)

| UI field/action from prompt | Current domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Scoped recording list | none | none | none | no query exists | **MISSING** |
| Transcription status | none | none | none | no query exists | **MISSING** |
| Recording metadata/detail | none | none | none | no query exists | **MISSING** |
| Linked incidents | Incident rows exist independently; no recording relation | incidents only | existing operator/HQ incident APIs do not return recordings | no linkage scope defined | **MISSING** |
| Retention/access settings | none; Page 15 audio retention undefined | none | none | no setting exists | **UNSUPPORTED** |
| Search/filter | none | none | none | no query exists | **MISSING** |
| Edit manual speaker labels | none | none | none | no mutation exists | **MISSING** |
| Edit tags/notes | none | none | none | no mutation exists | **MISSING** |
| Change retention | no approved policy | none | none | explicitly not authorized | **UNSUPPORTED** |
| Delete/archive recording | no recording resource | none | none | no deletion contract | **UNSUPPORTED** |
| Open/play/download raw audio | microphone/audio processing prohibited; no audio object | none | no route | no role allowed by recording policy | **UNSUPPORTED** |

## Page 15 dependency and privacy boundary

Page 16 depends on Page 15 producing approved, persisted recording data. Page 15 currently remains **NOT DONE** and capture is blocked: `PRIVACY.md` prohibits microphone access; `SECURITY.md` and global `Permissions-Policy` keep `microphone=()`; the Page 15 route is informational only. No audio legal basis/participant safeguards/DPIA, retention schedule, backup deletion proof, production object store, transcription processor policy, or recording-specific authorization has been approved.

A library must not be built from fabricated examples, empty placeholder files, incident descriptions, audit strings, traffic-video assets, or generic fake evidence presigners. Do not create list/detail or mutation APIs that imply recordings can exist. A safe Page 16 surface may only communicate that no recordings are available because the capability is not enabled, and must not expose audio playback, transcript, speaker labels, metadata, retention controls, or incident linkage.

## Persistence inventory

```text
AUTHORITATIVE STORE: none for operational recordings
READ PATH: none
WRITE PATH: none
PRIMARY KEYS: none
FOREIGN/DOMAIN RELATIONSHIPS: no Recording → Incident relation
INDEX/LOOKUP NEEDS: not designed; only after policy approval
RESTART DURABILITY: not applicable—no recordings can be created
RETENTION/DELETE: no recording rule or purge; Page 15 capture remains prohibited
```

## Evidence boundaries

This is a code/policy audit, not evidence of a production system, a legal determination, or approval to process audio. Existing generic permissions, incident APIs, file-backed storage, and Page 11 silent-video code are separate capabilities and do not provide recording-library support. Do not mark Page 16 or any project task DONE from this baseline.
