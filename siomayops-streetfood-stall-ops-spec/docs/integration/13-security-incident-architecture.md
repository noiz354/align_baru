# Page 13 — Security incident report architecture

**Status:** Partial local pilot; not accepted or production-ready.  
**Canonical prompt:** `docs/product/end-to-end-pages/13-security-incident.md`  
**Ground truth baseline:** `docs/integration/13-security-incident-ground-truth.md` (recorded before the implementation delta)

## Implemented flow

```text
/operator/incidents/new (client form)
  ├─ GET /api/v1/incidents
  │    ├─ resolveSession → OPERATOR + self scope check → authorize(incident:view)
  │    ├─ getOperatorIncidentsPage → active shift/site via getOperatorLocationContext
  │    └─ bounded self-only latest 10 → no-store JSON + incident_report_started
  └─ POST /api/v1/incidents
       ├─ resolveSession → OPERATOR + self scope check → authorize(incident:submit)
       ├─ strict Zod input; Idempotency-Key must equal clientIncidentId
       ├─ server derives actor/org/active shift/site; client cannot submit protected scope
       ├─ handleWithIdempotency (operator-keyed route)
       ├─ submitIncident → scoped client-id replay check → memoryStore row → audit summary
       ├─ getOperatorIncident self projection → incident_submitted (coarse event)
       └─ response; client reloads authoritative list

GET /api/v1/incidents/{incidentId}
  → session + operator self check → authorize(incident:view)
  → getOperatorIncident(orgId, operatorId, incidentId) → 404 outside reporter scope
```

The page is a client component because submission and refresh need browser state; the route handlers remain the authenticated boundary. Domain rules and query projections live in `src/features/incidents/index.ts`, not in React. There is no evidence-storage flow.

## Field-to-source map

| UI field/action | Domain/read source | Persistence | Server entrypoint | Scope / status |
| --- | --- | --- | --- | --- |
| Operator name | `getOperatorIncidentsPage` → session operator lookup | `memoryStore.operators` | `GET /api/v1/incidents` | self; name is returned only to that operator |
| Current shift/stall and current site | Existing `getOperatorLocationContext` | shifts/location reports/selling locations | `GET /api/v1/incidents` | derived from authenticated operator's active context; response exposes names/code, not IDs or GPS |
| Categories/help | `INCIDENT_CATEGORIES` in `src/domain/incident/index.ts` | source-code catalog (not configurable DB data) | `GET /api/v1/incidents` | neutral presentation; static pilot catalog |
| Occurred-at | Jakarta-local browser field → ISO instant; bounded future validation | `incidents.occurred_at` / `StoredIncident.occurredAt` | `POST /api/v1/incidents` | user-provided chronology; reported time is server receipt |
| Optional urgency hint | `IncidentSeverityHint` | `severity_hint` | `POST /api/v1/incidents` | operator's self-assessment only; no system severity or SLA claim |
| Narrative | strict bounded contract | `description` | `POST /api/v1/incidents` | reporter's words; excluded from audit summary and analytics/log payloads |
| Optional amount/context | integer IDR + paired context | `amount_minor`, `amount_context` | `POST /api/v1/incidents` | operator-reported, unverified; no money workflow |
| Evidence attachment | explicitly unavailable | none | none | unsupported; no upload, asset reference, or fabricated evidence state |
| Recent report/status | self-only `getOperatorIncidentsPage` projection | `memoryStore.incidents` | GET list; POST refresh; direct GET detail | latest 10; actor IDs omitted; initial state `SUBMITTED` only |
| Submission | `submitIncident` and same-ID replay check | `incidents` + `incidentByClientId` maps; audit event | `POST /api/v1/incidents` | org/operator/client idempotency; current active context linked only when available |

## Request and persistence contract

- The online JSON schema is strict: `clientIncidentId`, `categoryCode`, `description`, `occurredAt`, and optional `severityHint`, `amountMinor`, `amountContext`. It rejects unknown scope/evidence fields.
- `amountMinor` is a positive integer capped at 1,000,000,000 and must be paired with `REQUESTED`, `PAID`, or `UNCLEAR`.
- Event time must parse and may be at most five minutes in the future. There is no upper bound on past chronology in this pilot.
- The initial report status is `SUBMITTED`. The submitted category/hint does not cause legal classification, assigned severity, escalation, notification, or owner assignment.
- If no active shift/current location is found, submission remains possible and stores no shift/location link.
- Audit action `incident.submitted` stores category/status/hint and a boolean amount-present marker, never the narrative or amount value.
- Online idempotency requires the header to exactly equal the client UUID. Reusing the same key/body replays; using changed body is rejected. The UI also retains that key for same-form retry until success or payload change.

## Persistence truth and limitations

```text
AUTHORITATIVE STORE (current pilot): file-backed memoryStore at ignored local db.json
READ PATH: getOperatorIncidentsPage / getOperatorIncident (self-filtered projections)
WRITE PATH: submitIncident → memoryStore.incidents + incidentByClientId + writeAuditEvent
PRIMARY KEY: generated server incident UUID
NATURAL IDEMPOTENCY KEY: organizationId | operatorId | clientIncidentId
RELATIONSHIPS: required operator/org; optional active shift/site; no evidence relation
INDEX NEEDS: org+operator+createdAt for history; unique org+operator+clientIncidentId for replay
RESTART DURABILITY: file store serializes both maps locally; not production durability evidence
```

`src/server/db/schema.ts` now describes the additive incident fields and unique lookup index, but this repository has no deployed migration/repository rollout to prove the database schema is live. Existing old rows remain loadable in the local file store because new fields are optional. Do not treat the Drizzle catalogue as proof of production persistence.

## Authorization boundary

- The route resolves session state server-side and requires an `OPERATOR` role plus a matching `self` scope whose organization/operator IDs equal the session.
- Write authorization is checked with `authorize(session, "incident:submit", selfTarget)` before payload processing reaches the use case.
- Read list/detail use `incident:view`; list query filters by both organization and operator. Detail lookup filters by both and returns 404 for absent/out-of-scope records.
- The client cannot choose organization, actor, shift, site, stall or evidence references.
- Current authentication is the repository's development fake; production session resolution fails closed. Authorization correctness in the fake-backed tests is not production identity verification.

## Offline compatibility

`src/features/offline/index.ts` still calls the shared `submitIncident`. The call now passes `recordedAtDevice` through as `occurredAt`, preserving the queued device event time. A focused sync test covers that code path. The offline payload retains its legacy `categoryId` field and does not use the new online strict JSON contract; category migration/validation and end-to-end client outbox UX remain open.

## Explicitly out of scope / unsupported

- Durable SQL migration, production auth/session, tested transaction/concurrency guarantees, retention/deletion and backup controls. Local JSON restart persistence was verified but is not production durability.
- Evidence upload/private object storage/access/deletion; no `incident_evidence_added` emission.
- Full lifecycle, reviewer/HQ detail workflow, severity assignment, escalation/SLA/notifications, linked finance/stock records.
- User-browser acceptance remains pending; localhost HTTP smoke/restart evidence is tracked separately.
