# Transactions page analytics

**Transport:** privacy-minimal structured events via the existing Pino server logger (`product_analytics` message). This is not a connected product analytics warehouse or durable event bus.

| Event | Trigger | Properties | Prohibited properties | Downstream use |
|---|---|---|---|---|
| `transactions_viewed` | Unfiltered list read succeeds | `page=transactions`, `requestId` | User/operator PII, sale ID, line data, notes, payment reference, credentials | Confirm page usage and diagnose request path |
| `transaction_filter_changed` | Filtered list read succeeds | `page`, `requestId`, coarse `filter` category (`businessDay`, `stallId`, or `status`) | Filter value, outlet/org ID, sale ID, search/free text | Assess filter usage without retaining operational identifiers |
| `transaction_detail_viewed` | Authorized detail read succeeds | `page`, `requestId`, coarse transaction `status` | Transaction/payment IDs, outlet/operator/customer identifiers, line contents | Confirm detail access and diagnose status distribution |
| `transaction_created` | Cash sale and payment use cases both succeed | `page`, `requestId`, coarse payment result `status` | Amount, menu lines, outlet/org/operator, client IDs, payment references | Confirm completion of the main task |
| `transaction_create_failed` | The create endpoint returns a failed response after idempotent handler evaluation | `page`, `requestId`, HTTP status | Error body/free text, submitted values, identifiers | Detect create-path failure rate and correlate with safe request ID |

Events are emitted only server-side after the relevant boundary. Client-side events are not trusted for writes. The existing logger does not persist an analytics event store; local logger output is the current evidence mechanism. No raw notes, customer data, credentials, location coordinates, or payment provider data are added.
