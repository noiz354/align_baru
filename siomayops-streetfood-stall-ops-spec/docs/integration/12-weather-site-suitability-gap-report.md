# Page 12 — Weather & Site Suitability: gap report

**Status: NOT DONE.** This checkout has an evidence-backed manual observation slice, not an integrated weather/suitability product.

| Gap | Impact | Current handling | Required before completion/production |
| --- | --- | --- | --- |
| No weather provider/source, source timestamp, forecast, or persisted weather observation | The page cannot truthfully display weather or combine weather with site conditions. | UI/API explicitly return `UNAVAILABLE / PROVIDER_NOT_CONFIGURED`; no fake values, location forwarding, or outbound calls. The cue says it is observation-only. | Select an approved provider, document data/recipient/retention and legal basis, implement source/freshness validation, failure fallback, and adapter tests; privacy review must approve any location disclosure. |
| Suitability is only a simple manual-observation cue | No calibrated score, meteorological risk model, or site-level recommendation is implemented. | Deterministic 60-minute freshness plus wet/dry and shelter rules; cue is human-review-only, not an instruction or safety guarantee. | Product/safety owner must approve rules and wording, evaluate false positives/negatives, and specify when weather data is required. |
| Existing transaction projection omits stored selling-location ID | Site-specific recent sales are bounded to the newest 100 authorized operator transactions in the business-day query, then Page 12 internally rechecks persisted shift and site keys. | Show at most five rows for the persisted active shift + selling location without adding location IDs to general transaction responses; never use them in the cue. | Consider a dedicated indexed site/shift query if the read volume exceeds the 100-row cap; do not infer location from a later move. |
| Page 11 traffic data is production-gated | Recent traffic may be absent even when historical sample rows exist. | Display as optional manual traffic estimate, or an explicit disabled/empty state; never use it as weather evidence. | Complete Task 11's privacy, actual-media validation, production storage, and retention gates independently. |
| Pilot persistence only | `memoryStore`/`data/db.json` and schema catalogue are not a deployed production database. | Local file-backed durability; schema definition only, no migration. | Production identity, SQL repository/migration, backup/restore and deletion verification. |
| Site-condition retention is provisional | Local read/write-triggered 90-day purge can be delayed indefinitely when the page is unused and does not cover backups. | R-28 working maximum; no scheduled job or verified backup expiration. | Privacy-owner review, durable scheduled retention, measurable deletion evidence, and backup expiry before production. |
| Authentication is development fake | No real browser identity or production authorization proof. | API scope and permissions are exercised with the existing fake OPERATOR in development; production auth currently fails closed. | Implement/use the production session adapter and test its current-outlet scope. |
| Browser and production-runtime evidence | A local file-backed development server restart was verified, but unit/API and curl checks do not establish browser UX or browser-console behavior and do not prove production persistence. | Runtime proof records the local read/write, file-backed restart, invalid-input, unauthorized, and structured-log checks actually completed. | Browser save/reload and console review; production database persistence/restore, real identity scope, and retention/backup deletion evidence. |
| Analytics warehouse absent | Events can be inspected in structured Pino logs only; no downstream dashboard is supported. | Safe allowlisted Pino events; no external SDK or reporting claim. | Keep this explicit unless an approved analytics sink is added. |

## Validation snapshot (2026-09-30)

- `corepack pnpm typecheck`, `corepack pnpm lint`, full `corepack pnpm test` (38 files, 191 tests), and `corepack pnpm build` passed.
- `corepack pnpm check:docs` still fails for missing ground-truth artifacts for Pages 01–04 and 13–17. Page 12's own linked artifacts now exist; no Page 12 dangling-reference error was reported.
- `corepack pnpm check:stubs` fails repository-wide on its Phase 0-marker/NotImplemented rules, including many unchanged implemented files and the new Page 12 implementation; it is not a passing CI gate for this checkout.
- Browser acceptance was not completed because Chromium could not be downloaded (`ECONNRESET`); see runtime evidence.

## Explicitly unsupported

- Live current weather, forecast, temperature, rainfall, alerts, and provider freshness.
- A numeric suitability score, site ranking, predictive weather/traffic model, or automated relocation.
- Full site/shift sales history beyond the bounded current-day transaction read; the current view is a recent slice, not a full business aggregate.
- Production-grade database migrations, scheduled retention, backup deletion, and production auth.
