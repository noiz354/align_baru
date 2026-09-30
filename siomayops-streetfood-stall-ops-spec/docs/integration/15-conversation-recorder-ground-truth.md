# Page 15 — Conversation recorder ground truth

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/15-conversation-recorder.md`
**Target:** `/operator/recordings/new`
**Audit boundary:** repository/code/schema/docs inspected before Page 15 source changes.

## Current implementation truth

| Capability | Status | Evidence / boundary |
|---|---|---|
| `/operator/recordings/new` page | **MISSING** | No matching route/page/client exists under `src/app`. The `/operator/traffic-sampling` capture page is a distinct Task 11 video-only flow. |
| Browser microphone capture | **UNSUPPORTED — explicitly prohibited** | `next.config.mjs` sets global `Permissions-Policy: microphone=()`; the traffic-sampling override also keeps `microphone=()`. `SECURITY.md` §1 says microphone is denied globally. `PRIVACY.md` §2 says no microphone access. No `getUserMedia({audio:true})` or audio `MediaRecorder` exists. |
| Consent/notice for conversation audio | **MISSING** | No purpose-specific participant-consent record, notice version, consent withdrawal/rejection behavior, employment-safeguard policy, or legal/privacy approval exists. Loyalty consent is purpose-specific and cannot be reused for audio. The Task 11 video notice is not an audio-consent model. |
| Audio upload/storage/read | **MISSING / UNSUPPORTED** | `src/server/storage/evidence-store.ts` is an in-memory fake presigner limited to JPEG/PNG/WebP/PDF; it returns fake URLs and simulates deletion. It is not audio storage. `src/server/storage/traffic-video-store.ts` only accepts `.webm` traffic-video keys and does not authorize/read clips; Task 11 requires silent video. Neither adapter can be repurposed as audio storage. |
| Recording metadata/record model | **MISSING** | No `StoredRecording`, recording map, recording table, audio asset relation, or recorder domain exists in `src/server/db/memory-store.ts`, `src/server/db/schema.ts`, `src/domain`, or `src/features`. |
| Transcript and transcription job | **MISSING** | No transcript model, transcription adapter/provider, job, queue, status, consent semantics, or retention mechanism found. Do not fabricate transcript text or a completed transcription event. |
| Manual speaker labels/tags | **MISSING** | No recording annotation schema/service exists. Speaker identity and labels would require an approved, purpose-limited data model; no such permission is present. |
| Recording retention options/purge | **MISSING** | `RETENTION.md` has no audio or transcript row and states production-grade scheduled retention is not implemented. No approved audio duration, deletion workflow, backup expiry or deletion proof exists. A retention choice must not be invented. |
| Operator/session context | **PARTIAL** | Existing `SessionContext`, development fake auth, `/api/v1/operators/me`, shift/location context and self-scoped incident reads exist. Production authentication/session resolution is not available and fails closed. No recorder-specific authorized query exists. |
| Related incident candidates | **PARTIAL** | `GET /api/v1/incidents` returns up to 10 reporter-self incidents. No recording-to-incident foreign key, linkage mutation, or scoped recording relation exists. Incident linkage is unsupported. |
| Recording API authorization | **MISSING** | No recording route/action, recording-specific permission, object ownership check, cross-scope tests, or upload/download route exists. Generic `evidence:upload` does not authorize an audio purpose. |
| Recording analytics | **UNSUPPORTED** | No recorder analytics. Required event names are specifications only; no real record/start/upload/transcription/link action exists to emit them. Do not emit success events for blocked operations. |
| Audio/transcript audit trail | **MISSING** | Existing append-only `AuditEvent` is generic, but no audio-specific action or approved consent/audit semantics exist. Do not store audio-related free text in generic audit summaries. |
| Database/restart durability | **MISSING for recording data** | Runtime writes use a local JSON-backed `memoryStore`; Drizzle schema describes PostgreSQL, but there is no recording table/migration or deployed DB proof. No recording data exists to verify after restart. |
| Product/task tracking | **MISSING** | `TASKS.md` has `T-REC-001/002` for operator recognition only; there is no conversation-recorder task. Do not conflate recording with recognition. |

## Required page-data matrix (current state)

| UI field/action from prompt | Current domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Operator/session | `SessionContext`; `/api/v1/operators/me` (existing generic endpoint) | operator row in memory store | `GET /api/v1/operators/me` | session actor; endpoint does not establish recorder policy | **PARTIAL**, not recorder integration |
| Current shift/outlet context | location/shift use cases | shifts, location reports | existing operator location/incidents APIs | self + active shift | **PARTIAL**; recorder route absent |
| Retention options | none | none | none | not defined | **MISSING — policy approval required** |
| Related incident choices | `getOperatorIncidentsPage` | incident records | `GET /api/v1/incidents` | operator-self | **PARTIAL** read only |
| Start/stop microphone | none; microphone denied by policy/header | none | none | no audio capture allowed | **UNSUPPORTED** |
| Audio file metadata/upload | none | no audio row/object | none | no upload allowed | **UNSUPPORTED** |
| Recording record | none | no table/map | none | no record allowed | **MISSING** |
| Transcript/transcription result | none | none | none | no transcription allowed | **MISSING** |
| Manual speaker labels/tags | none | none | none | no annotation allowed | **MISSING** |
| Link a recording to incident | no relationship | no FK/link table | none | no linkage allowed | **MISSING** |

## Policy conflict and safe boundary

The Page 15 product prompt describes visible-consent audio capture, but current binding privacy/security policy explicitly denies microphone access globally. Consent UI alone cannot override that policy or establish legal basis, purpose, notice for every participant, non-coercive employment safeguards, data minimization, storage, retention, backup deletion, transcription-provider restrictions, rights handling, and production authorization. `PRIVACY.md` also requires DPIA review for new device capabilities/third-party processing; no audio DPIA or decision exists.

**Until those approvals and controls exist, do not request microphone permission, start `MediaRecorder`, accept audio bytes, create transcript/annotation rows, link media to incidents, enable audio analytics, or present sample/placeholder recordings.** A safe Page 15 route may only explain that the capability is unavailable and that no microphone is accessed; it cannot claim to complete the requested recording workflow.

## Authoritative persistence inventory

```text
AUTHORITATIVE STORE: none for conversation recordings/audio/transcripts
READ PATH: none; only existing operator and reporter-self incident reads are adjacent capabilities
WRITE PATH: none for recording/audio/transcript/annotation/linkage
PRIMARY KEYS: none defined
FOREIGN/DOMAIN RELATIONSHIPS: none defined; no Recording → Incident relationship
INDEX/LOOKUP NEEDS: not designed; should follow scoped approved model if authorized
RESTART DURABILITY: not applicable; no recording data exists
MEDIA ADAPTERS: image/document fake presigner; separate silent-traffic-video local disk pilot only
RETENTION: no audio/transcript schedule or purge proof; microphone policy remains denied
```

## Evidence boundaries

This is a repository/docs inspection, not a legal opinion or production security assessment. A development fake session, generic audit log, local disk media adapter, or configured upload permission is not proof of participant consent or authorization to record. Do not mark Page 15 or any project task done from this baseline.
