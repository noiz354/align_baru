# Page 17 — Settings & access analytics contract

**Status:** No Page 17 analytics are emitted. `/settings` is a static unavailable explanation with no authenticated account read, settings read, or supported write action.

## Required event families

| Event | Intended trigger (future; not active) | Current properties | Prohibited properties | Current downstream use |
|---|---|---|---|---|
| `settings_viewed` | An authenticated user successfully reads authoritative settings | **Not emitted** | Secrets, raw settings payloads, unnecessary user/org/outlet identifiers | None |
| `settings_changed` | A supported settings mutation succeeds | **Not emitted** | Secret values, raw free-text, unnecessary identifiers | None |
| `access_change_attempted` | An authenticated access mutation is submitted | **Not emitted** | Passwords, OTPs, tokens, secret values, raw personal data | None |
| `access_change_succeeded` | A persisted and authorized access mutation succeeds | **Not emitted** | Credentials, unnecessary subject/actor personal identifiers | None |
| `access_change_failed` | A supported access mutation fails validation/authorization/persistence | **Not emitted** | Credentials, secrets, raw request bodies, sensitive free text | None |

## Rationale and activation gate

The page neither resolves a real account session nor reads a durable settings resource. The current development session is fabricated, production session resolution returns `null`, and the thresholds endpoint is hard-coded. Page-view or mutation events from this explanatory page would imply unsupported account/configuration behavior.

After production authentication, authoritative settings and user-access data, scoped use cases, persisted mutations, and audit semantics are approved and implemented, instrument these events via the existing structured logging/telemetry mechanism. Use stable setting/action identifiers and safe outcome codes; avoid values for secrets and minimize personal/scope identifiers according to telemetry policy.
