# Page 14 — Incident evidence review gap report

**Decision:** PARTIAL / NOT DONE. The current slice is an HQ fact-review and limited status/note pilot, not incident evidence review or a production response workflow.
**Ground truth:** `docs/integration/14-incident-evidence-review-ground-truth.md`
**Architecture:** `docs/integration/14-incident-evidence-review-architecture.md`

## Acceptance matrix

| Requirement | Current result | Evidence | Remaining work / release impact |
| --- | --- | --- | --- |
| Real HQ inbox and direct detail route | Implemented locally | `/hq/incidents` reads bounded API inbox and links to `/hq/incidents/[id]`; route-level tests | Browser/hydration acceptance pending |
| Real incident facts and chronology | Partial | Detail use case reads incident row and joins reporter/shift/stall/location; audit timeline is bounded to 50 | File-backed store only; production query/migration unverified; operator/scope relations may be missing for legacy rows |
| Evidence metadata/photos/video/audio review | **UNSUPPORTED** | Detail explicitly returns `evidence.status=UNSUPPORTED`, empty items; no evidence route, upload reference, thumbnail, download or event | No metadata/media can be reviewed. Must remain disabled until validated private durable storage, object-level auth, integrity/immutability, retention, deletion/backups, privacy approval and tests exist. `incident_evidence_opened` is not emitted. |
| Reviewer authorization and scope | Partial, route-test covered | Role check + `authorize`; service enforces tenant/area/stall; tests for HQ Ops, area supervisor, finance/operator denials, cross-tenant/out-of-area direct IDs | Production auth/session and SQL/RLS/query integration remain release gates; `authorize()` is a fake-backed policy layer |
| Status workflow | Partial | Existing transition map exposed as allowed-next states; strict server mutation rejects invalid moves; resolve/close require factual note | No owner assignment, SLA timers, reopen semantics, escalation/notification, concurrency claim/lock or full HQ lifecycle |
| Follow-up note/history | Partial | Note-only and status-note mutations append audit events; detail returns up to 50 chronological events | Uses generic audit summaries and local JSON, not a production append-only transaction; retention/access and long history pagination remain open |
| Idempotency | Local path covered | Matching `clientReviewId` header, replay/no second audit event, changed content 422 | Memory-store idempotency is not a production transactional/unique-key guarantee; concurrent/recovery behavior needs database proof |
| Audit/telemetry minimization | Local path covered | Tests prove audit action/note trail and no note/report narrative/amount in logger calls | Verify centralized production logs, audit access, retention and response redaction; legacy audit rows may contain old unbounded transition notes |
| Analytics | Partial | `incident_reviewed`, `incident_review_note_added`, `incident_status_changed`, and `incident_review_failed` use existing structured logger; no note/identity/amount fields | Logger is not a warehouse or delivery proof; `incident_evidence_opened` is explicitly unsupported and un-emitted |
| Production persistence and retention | Unsupported for production | Existing memory store/audit schema used; no evidence schema added | No deployed migration, real transaction, incident retention job, DSAR, backup deletion or evidence purge controls |
| Browser/runtime evidence | Pending | Route handler tests only so far | Run app against isolated persisted fixtures, exercise status/note/reload/restart/invalid/unauthorized; no browser acceptance claimed until actually exercised |
| CI checks | Pending for Task 14 | Focused typecheck/unit/integration tests will be recorded in runtime evidence | Run full tests, lint, build, docs/stub checks; report baseline failures distinctly; no remote CI unless available |

## Highest-priority blockers

1. **P0 — No evidence capability:** This page cannot review photos, videos, audio, or immutable evidence metadata. Generic `EvidenceStore` is an in-memory fake and must not be represented as secure upload/download. Keep all evidence controls unavailable.
2. **P0 — Production identity/storage absent:** Current tests and local HTTP use the development auth fake and file-backed JSON store. Do not collect operational incident-review data in production before real auth, migration, transaction and scope-query proofs.
3. **P1 — Browser acceptance:** Browser JS, visible state, keyboard/accessibility, mobile layout and network-failure recovery remain unverified.
4. **P1 — Full responder workflow:** Ownership/assignment, SLA/ageing, safety escalation, alert/notification delivery, reopen reasons and concurrency controls are not implemented.
5. **P1 — Retention and audit governance:** Follow-up notes are stored in audit summary text. Define and verify retention, reviewer/auditor access, DSAR and backup expiry before production use.
6. **P1 — CI/static analysis:** Current lint configuration has no substantive rules; the repository-wide Phase 0 stubs/docs checks have known unrelated failures. They must be reported, not hidden.

## Stop conditions

- Do not show a fake thumbnail, attachment, file size, evidence owner, signature, review verdict, or presigned URL.
- Do not infer guilt, legality, or reliability from category, status, amount, or reporter identity.
- Do not log follow-up note text or report narrative in analytics/server telemetry.
- Do not expose incident details to `HQ_FINANCE`, `AUDITOR`, or `OPERATOR` through the new HQ detail route unless their policy/action grant is deliberately reviewed and tested.
- Do not mark T-INC-002 or Page 14 done based on route tests or local file restart alone.
