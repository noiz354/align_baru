# Page 13 — Incident reporting analytics contract

**Status:** Coarse structured events implemented for the local pilot. No separate analytics SDK is wired; events use the existing structured logger abstraction.  
**Implementation:** `src/features/incidents/analytics.ts`, called from `src/app/api/v1/incidents/route.ts`.

## Event catalog

| Event | Trigger | Allowed properties | Prohibited properties | Downstream use |
| --- | --- | --- | --- | --- |
| `incident_report_started` | Successful `GET /api/v1/incidents` that provides the page's self context/history | `eventName`, stable `page=operator-incident-report`, request correlation ID, coarse `outcome=SUCCESS` | Organization/operator/incident IDs, site name/address, coordinates, narrative, amount, category, evidence metadata | Count page-context requests; diagnose access/load volume |
| `incident_submitted` | New report persisted, or idempotent replay returned | `eventName`, stable page, request correlation ID, `outcome=CREATED\|REPLAYED` | Narrative, amount/value/context, IDs, category, location, evidence, legal/urgency inference | Count report writes/replays; measure rough funnel completion |
| `incident_submit_failed` | Auth, schema, idempotency, domain/time, or server failure | `eventName`, stable page, request correlation ID, coarse `reason=UNAUTHENTICATED\|FORBIDDEN\|VALIDATION\|CONFLICT\|SERVER` | Request body, narrative, amount, identifiers, category, location, evidence, raw exception text | Diagnose failure classes and authorization/validation issues |
| `incident_evidence_added` | No trigger in this pilot | Not emitted: evidence upload is unavailable | Do not create a synthetic event, fake asset ID, or success outcome | Explicit capability gap; add only after upload, scoped access and retention/deletion are real and tested |

## Privacy and semantics

- Events are not legal, safety, severity, performance or operator-score determinations.
- `severityHint` remains a user-selected form field and is intentionally not sent to analytics.
- `incident_submitted` means the local use case wrote or replayed a record; it does not mean the report was reviewed, delivered to a responder, or acted upon.
- Request IDs are operational correlation tokens, not user/entity identifiers. No cookies, tokens or raw request payloads are logged by this event family.
- Structured logger output is not a durable analytics warehouse or proof of downstream consumption. Production telemetry governance/retention is still to be verified.

## Evidence

Route tests spy on the existing logger and assert the page-start/submitted events and absence of narrative from event calls. A focused runtime/curl event proof will be added to `docs/integration/13-security-incident-runtime-evidence.md` only after it is actually run. Evidence-added remains deliberately unsupported.
