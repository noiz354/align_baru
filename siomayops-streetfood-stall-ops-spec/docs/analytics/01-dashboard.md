# Dashboard Analytics Contract

**Status:** `MOCK_BACKEND` for telemetry only. The page read path is server-backed; analytics delivery is not connected to a real telemetry provider.

## Events

| Event | Trigger | Allowed properties | Downstream use |
|---|---|---|---|
| `dashboard_viewed` | A validated dashboard read renders successfully | `page`, `businessDay`, `status`, optional `outletId`/`areaId`, `hasSearch`, `outcome=success` | Page availability and usage by operational scope |
| `dashboard_filter_changed` | User changes date, outlet, area, status, or search filter | `page`, `businessDay`, `status`, optional `outletId`/`areaId`, `hasSearch` | Identify filter usage and query UX friction |
| `dashboard_outlet_opened` | User opens an outlet detail from the dashboard | `page`, `businessDay`, `outletId` | Drill-down adoption |
| `dashboard_error_shown` | A read or contract/network failure is shown | `page`, `status`, `errorCode`, `outcome=failure` | Diagnose read/authorization/availability issues |

## Prohibited properties

Do not send passwords, auth tokens, raw organization claims, raw free-text expense/incident notes, phone numbers, names not already represented by stable outlet IDs, payment provider secrets, audio/video/photo content, or full server error objects.

Organization and actor identity are derived on the server from the authenticated session. The client may send only stable event identifiers, the selected authorized area ID, and the selected outlet ID for a permitted drill-down.

## Adapter and evidence

The browser calls `POST /api/v1/analytics` with a Zod-validated event. The server logs a bounded structured event through the existing logger. The adapter contains:

```text
// MOCK ONLY — ANALYTICS NOT CONNECTED TO REAL TELEMETRY
```

This marker must remain until a real telemetry sink is connected and delivery is verified. The current runtime evidence proves `202 Accepted` and a structured server log, not external delivery, retries, or retention.
