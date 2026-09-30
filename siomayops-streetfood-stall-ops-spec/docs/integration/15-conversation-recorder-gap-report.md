# Page 15 — Conversation recorder gap report

**Decision:** NOT DONE. No recording is captured, stored, transcribed, annotated, or linked. The route is informational only because the current privacy/security policy prohibits microphone access.
**Ground truth:** `docs/integration/15-conversation-recorder-ground-truth.md`
**Architecture:** `docs/integration/15-conversation-recorder-architecture.md`

## Acceptance matrix

| Requirement | Result | Evidence | Remaining work / impact |
|---|---|---|---|
| `/operator/recordings/new` route | Informational route only | Static Server Component; no client recorder code | Does not deliver the canonical recording workflow. Browser usability proof remains limited to the blocked informational page. |
| Visible-consent audio recording | **UNSUPPORTED — prohibited** | Global microphone policy/header deny; no audio capture APIs | Do not enable until Privacy/Security policy and approved participant-consent/legal-basis design authorize it. A checkbox cannot override the policy. |
| Operator/outlet/shift context | Not shown on recorder page | Existing data APIs are used by other operator pages only | Build a dedicated self-scoped read model only after policy authorization; don't query personal data for an unavailable feature. |
| Retention options | **UNSUPPORTED** | No audio/transcript retention rule, purge job, or backup expiry | Define, approve, implement, and verify a schedule before accepting bytes. Do not reuse photo/video durations. |
| Audio metadata/storage/upload | **UNSUPPORTED** | Generic evidence presigner is fake and not audio; no audio store or route | Requires private durable storage, validation/scanning as applicable, object-level authorization, backup/delete proof and incident response. |
| Transcript/transcription job | **MISSING** | No transcription provider, queue, job status, transcript model or approved third-party-processing policy | Define no-training/no-retention/data-residency/accuracy limitations, notice and provider contract before implementation. |
| Speaker labels/tags/manual annotations | **MISSING** | No annotation schema or write boundary | Approve identity/pseudonym semantics and scoped update/audit model. Do not infer real-world identity from labels. |
| Incident linkage | **MISSING** | Incident rows exist; no Recording FK/link relation | Determine least-data linkage semantics and access boundaries before any write path. |
| Authorization and ownership | **MISSING for recordings** | No recorder action, route, resource, or tests | Implement production-authenticated operator-self/outlet scope and direct-ID/cross-tenant denial tests if capability is approved. |
| Analytics | Explicitly not emitted | No real page action exists | Required events (`recording_started`, `recording_stopped`, `recording_uploaded`, `transcription_completed`, `recording_linked`) cannot honestly fire. Establish a privacy-approved data contract first. |
| Audit/observability | No recording events | No supported state transitions | Do not log raw audio/transcript/participant text or success for blocked operations. |
| Persistence, retention and restart proof | **Not applicable / missing capability** | No audio records/store/migration/job | Must prove real scoped writes, reload/restart durability, deletion and backup expiry before operational launch. |
| CI/runtime | Static route can be tested/built only | Unit assertion + local HTTP/header check planned | Consent, upload, transcription, retention and scope tests do not exist because their operations must remain blocked. No real browser recording test is permitted under current policy. |

## Blocking policy conflict

The canonical Page 15 purpose requests operational conversation audio, while current `PRIVACY.md` explicitly prohibits microphone access and `SECURITY.md` plus global Next.js `Permissions-Policy` deny it. Task 11's silent video-only exception explicitly forbids audio and cannot be broadened. No approved legal basis, participant-consent mechanics, non-coercion safeguards, DPIA, audio retention period, production object store, transcription-vendor rules, withdrawal/DSAR path, or deletion/backup verification exists.

**Safe implementation boundary:** show an honest unavailable message, do not access microphone or protected data, and keep all recording/write/analytics capabilities disabled. This reduces the chance of an operator expecting a feature that does not exist; it does not satisfy the canonical Page 15 end-to-end acceptance criteria.

## Stop conditions

- Do not change the global microphone policy/header or add a route-specific microphone grant.
- Do not render a consent toggle, start/stop/upload controls, fake retention selector, sample transcript, fake incident link, or success state.
- Do not accept audio through the image/document evidence store or the separate silent traffic-video store.
- Do not repurpose loyalty consent or incident notes as recording consent/transcripts.
- Do not emit any required recorder success event until an authorized recording action actually succeeds.
- Do not mark the Page 15 feature or an unrelated `T-REC-*` operator-recognition task DONE.
