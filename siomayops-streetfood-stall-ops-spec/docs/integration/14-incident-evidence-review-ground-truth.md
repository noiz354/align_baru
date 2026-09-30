# Page 14 — Incident evidence review: ground truth audit

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/14-incident-evidence-review.md`
**Target:** `/hq/incidents/[id]`
**Baseline:** inspected at Task 13 branch head, before Task 14 changes.

## Capability inventory

| Capability | Status | Code/runtime truth |
| --- | --- | --- |
| HQ incident inbox/detail page | `MISSING` | `/hq/incidents` is a client component with one hard-coded `INC-001` card, invented category/site/description, and non-functional Acknowledge/Resolve buttons. There is no `/hq/incidents/[id]` route. |
| HQ incident read boundary | `PARTIAL` | `GET /api/v1/hq/incidents` authenticates and authorizes `hq:view`, but returns only organization-wide category/status counts. Its `drillDown.endpoint` points to `/api/v1/incidents`, which is the operator self-scoped API, not an HQ detail endpoint. |
| Incident detail data | `PARTIAL` | `StoredIncident` contains category, bounded operator report, event/received time, optional reported amount/context, operator, optional shift/site, hint and status. There is no dedicated HQ projection joining operator, stall/outlet, location, or review history. |
| Incident evidence metadata/media | `UNSUPPORTED` | Incident rows have no evidence relation or evidence metadata. `memoryStore.evidenceAssets` is a generic map, but the incident flow does not use it. Generic `EvidenceStore` only fake-presigns in-memory upload/download URLs, does not validate uploaded bytes, persist a reviewable asset, or implement incident access checks/deletion. No evidence routes exist. |
| Existing status transition service | `PARTIAL` | `transitionIncident` supports transitions from `SUBMITTED` through existing statuses and writes `incident.transitioned` audit events. There is no incident route invoking it, no responder ownership/area check inside the service, no state-transition HTTP contract, and no detail history projection. Audit payload may include free-text reason/resolution note. |
| Follow-up note / review history | `PARTIAL` | The generic append-only `auditEvents` map/schema can contain status transition summaries. There is no separately modeled incident review note or read path that returns review events in incident chronology. |
| Authentication and role permissions | `PARTIAL` | The development auth fake and `authorize()` exist. `HQ_OPS` and `AREA_SUPERVISOR` have incident view/resolve and evidence:view capabilities; `OWNER` also has incident/evidence capabilities. `AUDITOR` has evidence:view but not incident:view; `HQ_FINANCE` has evidence:view but not incident:view. `AREA_SUPERVISOR` scope is enforced only when a target includes an area ID. Production auth fails closed. |
| Incident review analytics | `MISSING` | Task 13 emits operator report events only. No `incident_reviewed`, `incident_status_changed`, or `incident_evidence_opened` review events exist. |
| Retention | `UNSUPPORTED` | `RETENTION.md` specifies R-12 incident evidence (e.g. 90 days post-resolution), but no incident evidence is stored and no production purge/deletion job exists. |
| Task 14 tests/runtime | `MISSING` | Existing tests cover Task 13 operator reporting and offline sync. No HQ detail, evidence authorization, review/status, UI or runtime test exists. |

## Baseline data contract and scope

| UI field/action | Existing domain source | Existing persistence source | Existing server entrypoint | Baseline scope | Status |
| --- | --- | --- | --- | --- | --- |
| Incident category, narrative, time, amount, initial status | Task 13 incident service | `memoryStore.incidents`; Drizzle incident catalogue | `GET /api/v1/hq/incidents` only as aggregates | org-filtered aggregate; not detail | `PARTIAL` |
| Operator/outlet/location | Incident operator/optional shift/site IDs; related stores | operators, shifts, stalls, selling locations | no HQ detail handler | no joined read model | `PARTIAL` |
| Evidence list/media | Generic presign interface only | no incident evidence table/relation | no incident evidence route | no incident-specific auth/read | `UNSUPPORTED` |
| Status transition | `transitionIncident()` | incident row + audit event | no route/action | service has no session scope | `PARTIAL` |
| Follow-up note/history | transition `reason` / `resolutionNote` passed to audit writer | audit event summaries | no incident-scoped timeline query | no read projection | `PARTIAL` |
| Acknowledge/resolve controls | Static mock page only | none through UI | no mutation handler | none | `MISSING` |

## Persistence facts

```text
AUTHORITATIVE STORE: local file-backed memoryStore at ignored data/db.json (development pilot)
READ PATH: HQ aggregate API scans memoryStore.incidents by organization; no detail/read-history service
WRITE PATH: Task 13 submitIncident writes incident row + incidentByClientId + audit; transitionIncident writes row + audit but has no route caller
PRIMARY KEY: incident.id; reporter client id index is organization|operator|clientIncidentId
EVIDENCE KEYS/RELATIONSHIPS: none for incidents; generic evidence store is separate ephemeral in-memory state
RESTART DURABILITY: incident/audit maps serialize to local JSON; generic EvidenceStore assets do not
DATABASE SCHEMA: incident and audit catalogues exist; no incident-evidence/review-note table or deployed migration convention
```

## Baseline privacy/security posture

The static HQ page currently displays fabricated incident data and must be removed. A detail page must use a real incident ID, derive organization and reviewer scope from the server session, and return no cross-tenant/out-of-area incident or evidence metadata. Raw media is not available and must not be represented by fake thumbnails, links or presigned URLs. Do not reveal incident narrative in telemetry. If status/follow-up mutations are supported, audit them with bounded structured summaries and avoid logging unbounded note text.
