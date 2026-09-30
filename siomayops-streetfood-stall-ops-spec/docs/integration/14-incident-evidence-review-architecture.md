# Page 14 — Incident evidence review architecture

**Status:** Partial local HQ review pilot; evidence media is explicitly unsupported and production/acceptance gates remain open.
**Canonical prompt:** `docs/product/end-to-end-pages/14-incident-evidence-review.md`
**Ground truth baseline:** `docs/integration/14-incident-evidence-review-ground-truth.md`

## Implemented flow

```text
/hq/incidents (real bounded inbox; legacy ?incidentId redirects to detail)
  → GET /api/v1/hq/incidents/inbox
       → resolveSession → reviewer role + incident:view authorization
       → getIncidentReviewInbox(session) → tenant + derived area filtering → latest 100 summaries

/hq/incidents/{id} (client detail/review UI)
  → GET /api/v1/hq/incidents/{id}
       → resolveSession → OWNER/HQ_OPS/AREA_SUPERVISOR + incident:view authorization
       → getIncidentReviewDetail(session,id) → tenant/area/stall scope check
       → persisted report facts + related operator/shift/stall/site names + ≤50 audit history rows
       → incident_reviewed (coarse event)
       → evidence { status: UNSUPPORTED, items: [] }; no media link/control/event

  → POST /api/v1/hq/incidents/{id}/review
       → resolveSession → incident:resolve authorization before payload/business-state read
       → strict schema + matching Idempotency-Key/clientReviewId
       → reviewIncident(session,id,status?,note?,requestId) re-checks tenant/area scope
       → status transition OR append-only incident.review_note_added audit event
       → incident_status_changed (status only; no narrative)
       → idempotent response → UI reloads detail/history
```

## Field-to-source map

| UI field/action | Domain/read source | Persistence | Server entrypoint | Scope / status |
| --- | --- | --- | --- | --- |
| Inbox category/status/time | `getIncidentReviewInbox` | `memoryStore.incidents` | `GET /api/v1/hq/incidents/inbox` | latest 100 in authorized org/area; no narrative |
| Category label | Existing `INCIDENT_CATEGORIES` domain catalog | source code catalog | same inbox/detail query | unknown legacy code is shown as unknown, not fabricated |
| Report narrative, amount/context, event/received time, severity hint | `getIncidentReviewDetail` projection of Task 13 row | `memoryStore.incidents` | `GET /api/v1/hq/incidents/{id}` | viewer role + tenant/area/stall scoping; no client-supplied query scope |
| Reporter, stall and location display names | related operator + validated shift→stall and selling-location rows | operators, shifts, stalls, sellingLocations | detail/inbox use case | names only if organization/relationship checks pass; no phone or raw actor ID |
| Review chronology | `incidentHistory` filters `auditEvents` by organization/entity type/entity ID; sorts ascending and limits to 50 | existing append-only `memoryStore.auditEvents` / `audit_events` schema | detail query | emits actor kind, action/time/status transitions and follow-up notes; excludes actor IDs |
| Evidence display | explicitly unavailable | no IncidentEvidence relation; generic EvidenceStore is not used | none | response says `UNSUPPORTED`; no thumbnail/link/download/event |
| Follow-up note | `reviewIncident` note-only path | append-only audit summary `incident.review_note_added` | POST review endpoint | 10–1,000 trimmed characters; rendered only to authorized reviewers; never logged/analysed |
| Status mutation | existing transition map, now behind `reviewIncident` | incident row status/update time + `incident.transitioned` audit row | POST review endpoint | allowed transition only; `RESOLVED`/`CLOSED` require a note; idempotent header/body UUID |

## Authorization and data isolation

- Route session roles allowed to read/review: `OWNER`, `HQ_OPS`, and `AREA_SUPERVISOR`. The route also invokes existing `authorize()` for `incident:view` or `incident:resolve`.
- `HQ_FINANCE`, `AUDITOR`, and `OPERATOR` do not get this HQ incident review surface under current permissions. Evidence-view permission alone does not grant access.
- Organization ID is always taken from the session. Service scope checks reject self/unsupported scopes and return no record for other tenants or areas.
- Incident area derives first from a same-tenant/same-reporter shift→stall; if not available it falls back to that same-tenant operator's assigned area. A supervisor without a derivable matching area sees no record. A stall scope must match the incident shift's stall.
- Inbox filters rows server-side. Detail read filters before returning any narrative. Direct cross-tenant/out-of-area/missing detail is `404` to avoid resource enumeration.
- Mutation authorization happens before parsing the report business object into a use case; service repeats ownership/scope validation.

## Write, audit and telemetry contract

- Input is `{ clientReviewId, status?, note? }`, strict; a status change or note is required. `Idempotency-Key` must equal `clientReviewId`.
- A same-key/body replay returns the stored response and does not append another audit event. Changed content under an existing key returns `422`.
- Existing status transition map is authoritative. This pilot exposes it to the client as allowed next statuses, but server validation remains authoritative.
- `incident.transitioned` records before/after status and optional bounded `followUpNote`; note-only writes use `incident.review_note_added`. Audit is append-only. Note contents are intentionally visible in authorized history but never included in analytics or server event logs.
- `incident_reviewed` fires after successful detail read. `incident_review_note_added` records a coarse note-write/replay outcome without note content. `incident_status_changed` fires after status change/replay with coarse from/to state. `incident_review_failed` records only coarse reason. `incident_evidence_opened` is not emitted: no evidence can be opened.

## Persistence truth

```text
AUTHORITATIVE STORE: local file-backed memoryStore (ignored data/db.json)
READ PATH: getIncidentReviewInbox / getIncidentReviewDetail
WRITE PATH: reviewIncident → incident status map and/or append-only AuditEvent
PRIMARY KEY: incident.id
RELATIONSHIPS: incident operator + optional shift/site; derived stall/area from same-tenant relationships
REVIEW HISTORY: generic audit_events (not a new mutable review table)
EVIDENCE RELATIONSHIP: none; generic InMemoryEvidenceStore is not connected
RESTART DURABILITY: local incident/audit JSON serialization; reviewed with local HTTP smoke only
DATABASE MIGRATION: no deployed SQL migration/repository transaction is present
```

No evidence or review table was added: the existing `audit_events` model is sufficient for the limited append-only status/note trail. Production transaction guarantees, real SQL migration, retention and audit-history redaction/authorization remain unproven.

## Frontend state

The HQ inbox no longer uses a hard-coded example card. It renders real server items, an empty state, and auth/server errors. The detail page renders persisted facts, supported audit history, unsupported evidence state, and note/status controls; it refreshes from server after successful writes. Direct `?incidentId=` links are redirected to the detail route.
