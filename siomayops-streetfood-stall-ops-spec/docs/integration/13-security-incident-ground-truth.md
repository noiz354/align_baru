# Page 13 — Security Incident / Pemalakan Report: ground truth audit

**Date:** 2026-09-30 (Asia/Jakarta)  
**Canonical prompt:** `docs/product/end-to-end-pages/13-security-incident.md`  
**Target:** `/operator/incidents/new`  
**Baseline:** inspected before Page 13 changes; Page 12 remains a separate not-done pilot slice.

## Capability inventory

| Capability | Status | Code/runtime truth |
| --- | --- | --- |
| Operator incident-report page | `MISSING` | No `/operator/incidents/new` route or client exists. An HQ aggregate page exists at `/hq/incidents`; it does not provide operator capture. |
| Authenticated self context/current outlet | `PARTIAL` | `getOperatorLocationContext` derives active shift/current site for a self scope and includes precise GPS in its Page 10 read model; Page 13 must project only the site name/status and shift context, never GPS. |
| Incident categories | `PARTIAL` | `INCIDENTS.md` documents category codes and neutral language. The runtime has no configured category catalog; the existing request contract instead accepts an arbitrary UUID `categoryId`. |
| Submit boundary / authorization | `PARTIAL` | `POST /api/v1/incidents` parses a request and calls `handleWithIdempotency`, but does not call `authorize` or validate operator self scope. Client `shiftId`, `stallId`, and `sellingLocationId` are passed through. |
| Incident service | `PARTIAL` | `src/features/incidents/index.ts` writes a minimal row and an audit event, but ignores severity, people note, evidence IDs, device time, and client incident ID. It uses a fabricated fallback actor ID when none is supplied. |
| Incident persistence | `PARTIAL` | `memoryStore.incidents` is file-backed across restart; `StoredIncident` has only org, optional shift, actor, category, description, status, and created/updated timestamps. The Drizzle catalogue likewise has only those fields and no deployed migration. |
| Amount and event chronology | `MISSING` | Neither `StoredIncident` nor the incident schema stores an amount or occurred-at time. `recordedAtDevice` exists in the API contract but the service drops it. |
| Location linkage | `PARTIAL` | The store can link a shift but has no incident selling-location field. The route trusts client shift/location IDs instead of deriving the active context. |
| Evidence upload/references | `UNSUPPORTED` | The incident contract accepts `evidenceAssetIds`, but submit ignores them. The generic `EvidenceStore` is an in-memory fake presigner; there is no incident upload/download route, durable object store, or persisted evidence asset access check. Do not present this as working upload support. |
| Idempotency | `PARTIAL` | The shared handler can replay an `Idempotency-Key`, but the route allows missing keys through the helper, does not require equality to `clientIncidentId`, and the incident service does not index the client incident ID. |
| Status workflow | `PARTIAL` | Memory rows use `SUBMITTED|ACKNOWLEDGED|INVESTIGATING|RESOLVED|ESCALATED|CLOSED`; the feature returns `REPORTED` and its transition map starts from `REPORTED` and includes `IN_PROGRESS|REOPENED`. The mismatch needs an additive, explicit mapping for this slice; full HQ lifecycle remains separate. |
| Analytics | `MISSING` | No Page 13 incident reporting event family is emitted. Existing write auditing records `incident.submitted` but no page-start/submit-failure/evidence-added event exists. |
| Offline sync | `PARTIAL` | `src/features/offline` calls the shared `submitIncident` feature; changes must keep that call path compatible. Its current payload does not carry evidence, event chronology, or amount. |
| Production auth/storage | `UNSUPPORTED` | Auth is a development fake and returns null in production; the memory store is a local pilot, with no production SQL migration/repository or media provider. |

## Baseline data contract and scope

| UI field/action | Existing domain source | Existing persistence source | Existing server entrypoint | Scope | Baseline status |
| --- | --- | --- | --- | --- | --- |
| Operator / outlet / shift | `getOperatorLocationContext` | operators, shifts, location reports, selling locations | `GET /api/v1/operators/me/location` | authenticated self | `PARTIAL`; service exists, no incident-page projection |
| Category | `INCIDENTS.md` only | none/configuration absent | none | N/A | `PARTIAL`; runtime accepts arbitrary category UUID |
| Occurred-at chronology | request contract `recordedAtDevice` | none | `POST /api/v1/incidents` | unvalidated client field | `MISSING` as persisted event time |
| Amount | none | none | none | N/A | `MISSING` |
| Description | request contract | `memoryStore.incidents.description` | `POST /api/v1/incidents` | session org/actor, but route does not authorize | `PARTIAL` |
| Evidence references | request contract `evidenceAssetIds` | no durable incident evidence relation | `POST /api/v1/incidents` | no access check | `UNSUPPORTED` |
| Status | `transitionIncident` map | `memoryStore.incidents.status` | no operator status/read endpoint | inconsistent vocabularies | `PARTIAL` |
| Recent reporter history | none | incident map includes `operatorId` | no self-scoped list endpoint | N/A | `MISSING` |

## Persistence facts

```text
AUTHORITATIVE STORE: file-backed memoryStore at ignored data/db.json (development/test pilot)
READ PATH: no operator incident read model; HQ endpoint only returns org-level category/status aggregates
WRITE PATH: POST /api/v1/incidents → submitIncident → memoryStore.incidents + writeAuditEvent
PRIMARY KEYS: generated server UUID incident id; clientIncidentId currently unused
FOREIGN/DOMAIN RELATIONSHIPS: optional shiftId, operatorId, organizationId; sellingLocationId/evidence links are not persisted
INDEX/LOOKUP NEEDS: self history by organization/operator and occurredAt; idempotency by organization/operator/clientIncidentId
RESTART DURABILITY: memoryStore maps serialize/reload in local file store; there is no production migration or deployed media store
```

## Neutrality and privacy constraints

The canonical page is a place to record what the operator says happened, not a legal finding. Use neutral category/field labels, keep any amount as an operator-reported integer IDR amount, do not add a named-party/accused/person-identification field, do not infer criminality or guilt, exclude free-text from analytics and logs, and tell operators the app is not an emergency channel. Evidence upload is explicitly unsupported until a durable private store, scoped access, retention, and deletion are implemented and approved.
