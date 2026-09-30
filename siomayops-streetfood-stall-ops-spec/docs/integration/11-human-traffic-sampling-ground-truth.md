# Page 11 — Human Traffic Video Sampling ground-truth audit

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/11-human-traffic-sampling.md`
**Route:** `/operator/traffic-sampling`
**Audit phase:** completed before any Page 11 code changes.

## Existing capability classification

| Capability | Status | Evidence / notes |
|---|---|---|
| `/operator/traffic-sampling` UI | `MISSING` | No route/page/component exists under `src/app/operator/traffic-sampling`. The route appears only in the page prompt and operator-home navigation requirements. |
| Current operator/shift/location read | `PARTIAL` | The current workspace has Task 10's self-scoped operator location read model, which can return the authenticated operator's active shift and current selling point. No Page 11 read contract or sample history exists. `GET /api/v1/locations` is organization-scoped and must not be reused as the operator's picker. |
| Camera/video capture | `UNSUPPORTED` under current policy/runtime | No `getUserMedia`, `MediaRecorder`, video capture, or traffic sampling implementation exists. The global `Permissions-Policy` disables camera; the only intended camera exception in `PRIVACY.md` is an explicitly captured evidence/incident photo. |
| Video upload/storage | `UNSUPPORTED` | `src/server/storage/evidence-store.ts` accepts only JPEG, PNG, WebP, and PDF. It returns a development-only fake URL and keeps metadata in a private in-memory `Map`; there is no real object-storage upload/download route or durable evidence blob adapter. Video MIME types, size caps, checksums, upload status, and durable deletion do not exist. |
| Anonymous traffic estimate/count/band | `MISSING` | No traffic-sample domain entity, inference/counting service, estimate model, result contract, or persistence exists. `FR-PERF-005` names a traffic band/class as a normalisation factor but does not define a video estimator or sample workflow. |
| Previous samples/read history | `MISSING` | No traffic sample table/map, query, retention schedule, or page history exists. The HQ operations map ground-truth audit explicitly says traffic sample/summary is unsupported and must not be fabricated. |
| Manual notes | `MISSING` for traffic samples | Expense/incident notes exist for separate purposes; no traffic-sample note field or policy exists. |
| Authentication/authorization | `PARTIAL` | `authorize()` and a fake development session exist in the current workspace; production `AuthPort` still returns no session. No traffic-sample action/permission or object-ownership checks exist. |
| Audit/analytics | `MISSING` | No `traffic_sample_started`, `traffic_sample_uploaded`, `traffic_analysis_completed`, or `traffic_analysis_failed` events exist. Existing Pino structured logging is the telemetry abstraction. |
| Retention/deletion policy | `MISSING` for traffic video/sample | `RETENTION.md` has short-retention photo rows for expense/incident evidence but no environmental video sample/count policy. No video purge job exists. |
| Privacy/DPIA approval | `UNSUPPORTED` / not approved | `PRIVACY.md` §2 explicitly disallows camera/microphone access except operator-triggered photo evidence or incident capture. §8 requires DPIA review for new camera capability. No traffic-sampling DPIA or approval exists. |
| Tests/runtime proof | `MISSING` | No Page 11 domain/API/UI/browser tests, upload validations, or runtime evidence exist. |

## Relevant policy conflicts and security/privacy gates

1. The Page 11 prompt asks for a short environmental **video** sample, upload status, video evidence metadata, an anonymous traffic estimate/result, and manual notes.
2. Current policy says there are no camera feeds and no camera/microphone access except a directly captured photo for evidence/incident. The global browser policy disables camera. A video clip of a public environment can contain identifiable faces, clothing, speech, children, vehicle plates, or sensitive context even if the intended output is only a crowd count.
3. Existing evidence storage is a fake in-memory adapter for still images/documents, not a safe video pipeline. It does not provide actual media transfer, inspection, encryption at rest, lifecycle deletion, or production durability.
4. No approved method defines how the system avoids identity/face/demographic inference, whether audio is captured, whether frames leave the device, who may access a raw clip, clip duration/size, or how quickly originals and backups are purged.
5. No stable product requirement specifies sampling interval, minimum/maximum clip duration, estimation method, count/band granularity, confidence/quality threshold, retention period, or whether HQ sees counts only versus media.

This is not safe to implement by extending the photo evidence allowlist or by silently enabling camera access. A separate explicit privacy decision and DPIA/privacy-owner review are needed before capturing or uploading environmental video. Until that decision, do not add browser camera permission, `getUserMedia`, `MediaRecorder`, a video MIME allowlist, or raw-media storage.

## Existing entrypoint/data map

| UI field/action | Current source | Persistence source | Existing server entrypoint | Current scope/status |
|---|---|---|---|---|
| Operator/session | `SessionContext.operatorId` | Fake auth / operator registry | `resolveSession()` | Development only; production auth adapter absent |
| Active shift/current selling point | Task 10 self-scoped read model in the current workspace | `shifts`, `locationReports`, `sellingLocations` | `GET /api/v1/operators/me/location` | Self scope; a possible future context source, not yet connected to Page 11 |
| Record video | None | None | None | Camera disabled by policy/header |
| Upload progress/status | None | None | None | No real upload endpoint or durable object store |
| Video metadata | Generic, volatile evidence adapter shape only | Private in-memory map (not durable); generic memory-store evidence map unused for uploads | No evidence upload route | Still-image/PDF only; no video support |
| Anonymous estimate/count/band | None | None | None | Unsupported; no estimator or result schema |
| Previous traffic samples | None | None | None | Unsupported; no query/store |
| Manual traffic note | None | None | None | No traffic-specific domain field or route |
| Analytics/audit | Pino logger and audit service exist generically | Runtime logs/audit list | No Page 11 events | Missing event contract and privacy allowlist |

## Pre-code conclusion

Page 11 is a prompt-only target with no implementation. The generic evidence adapter is not a production media capability, and the current privacy policy conflicts with environmental video capture. This audit makes no policy exception, adds no camera permission, and does not change any Task 11 status. Implementation should wait until the raw-media handling boundary and privacy/DPIA decision are explicit. Production use would additionally require real storage, a verified deletion/backup lifecycle, and production authentication.


## Policy decision and implementation follow-up (2026-09-30)

The operator approved the narrowly gated design recorded in ADR-0040: explicit-tap silent clips ≤10 seconds; manual count/band; private first-party storage; no recognition/CV/third-party processing/training; raw video deleted within 24 hours with backups; no HQ clip access; result metadata not keyed to operator/shift; production disabled pending DPIA and purge verification.

After that approval, Page 11 code was added. The original inventory above records pre-code ground truth and remains unchanged as a baseline. Current implementation status: UI/API/domain/file-backed sample store and private local media adapter are now present; production auth, PostgreSQL migration/runtime repository, production object storage, verified backup deletion, actual encoded-duration inspection, and browser camera runtime proof remain incomplete. See the architecture, gap, and runtime evidence documents for current status.
