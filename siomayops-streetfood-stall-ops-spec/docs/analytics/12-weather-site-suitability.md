# Page 12 analytics — Weather & Site Suitability

**Status:** Pilot instrumentation in structured Pino logs only; there is no analytics warehouse or dashboard in this checkout.

| Event | Trigger | Allowlisted properties | Prohibited properties | Downstream use |
| --- | --- | --- | --- | --- |
| `site_condition_viewed` | Successful self-scoped Page 12 read | `page`, safe `requestId`, `outcome=SUCCESS` | Organization/operator/shift/location IDs or names, GPS, notes, sales amounts, traffic counts, weather measurements | Coarse page availability/usage only |
| `site_observation_saved` | New observation saved or idempotent replay accepted | `page`, safe `requestId`, `outcome=CREATED\|REPLAYED` | Free text, actor/scope IDs, exact location, raw form payload | Coarse write/replay reliability only |
| `site_observation_save_failed` | Invalid input, authorization/scope, no active shift, conflict, or server failure | `page`, safe `requestId`, enum `reason`, `outcome=FAILURE` | Raw exception/body, notes, session or location IDs | Diagnose coarse failure categories |
| `relocation_recommendation_viewed` | GET returns the fresh observation-only `REVIEW_SHELTER` cue | `page`, safe `requestId`, `cue=REVIEW_SHELTER` | Operator/shift/location IDs, notes, weather or exact condition values | Count how often a human-review cue is presented; not an individual performance signal |

Weather fields are not logged because no weather source exists. Traffic estimates and sales values are not used to derive the cue and are not properties of these events. Logging uses the existing Pino abstraction; events are not sent to a third-party analytics SDK or persisted in a reporting warehouse.
