# Page 14 — Incident evidence review analytics contract

**Status:** Coarse review/note/status events use the existing structured logger. Evidence-open is intentionally unsupported and is not emitted.
**Implementation:** `src/features/incidents/analytics.ts`, called by the HQ inbox/detail/review API routes. No separate analytics SDK is wired.

## Event catalog

| Event | Trigger | Allowed properties | Prohibited properties | Downstream use |
| --- | --- | --- | --- | --- |
| `incident_reviewed` | Successful authorized detail read | `page=hq-incident-review`, request correlation ID, `outcome=SUCCESS` | Incident/operator/org/area IDs, report narrative, amount/context, site/operator names, review note, evidence media/metadata | Count detail-view requests and help diagnose read failures |
| `incident_review_note_added` | Note-only or status+note write, including idempotent replay | stable page, request correlation ID, coarse `outcome=CREATED\|REPLAYED` | Note text, report narrative, amount, incident/operator/org/area IDs, site/reporter data, evidence metadata/media | Count note-write/replay requests; not measure reviewer performance |
| `incident_status_changed` | Status transition persisted or same review request replayed | stable page, request correlation ID, `outcome=UPDATED\|REPLAYED`, structured `fromStatus`/`toStatus` when known | Note text, report narrative, amount, IDs, category/site/reporter data, evidence metadata/media, legal/safety finding | Coarse transition funnel and replay monitoring; not reviewer performance scoring |
| `incident_review_failed` | Review authorization, validation, transition/idempotency or server failure | stable page, request correlation ID, coarse reason: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, or `SERVER` | Request body, note, narrative, amount, identifiers, category, location, evidence, raw exception | Diagnose failure classes without content inspection |
| `incident_evidence_opened` | No trigger in this pilot | Not emitted: evidence is explicitly unsupported and there is no open/download control | Do not synthesize an event or claim an evidence review occurred | Capability gap only; instrument after an authorized evidence surface exists and is proven |

## Privacy and semantics

- `incident_reviewed` means an authorized API detail projection was returned; it does not mean a human read or agreed with the report.
- `incident_review_note_added` means a write or idempotent replay was accepted; it contains no note content and does not indicate that follow-up was completed.
- `incident_status_changed` means the local status use case wrote or replayed the requested transition; it does not mean an owner was notified or took action.
- Notes are persisted in an audit history for authorized reviewers but are never included in analytics properties. Actor IDs are retained in audit storage under existing audit policy but are omitted from the page projection and telemetry.
- Logger output is not a durable analytics warehouse or proof of downstream delivery. Production telemetry governance and retention remain unverified.

## Evidence

`tests/integration/incident-evidence-review-api.test.ts` asserts view/status/note event emission and verifies report/note/amount content does not enter logger calls. No evidence-open test/event exists because the capability is not present.
