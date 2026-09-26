# NOTIFICATIONS AND ALERTS

**Document ID:** DOC-NOTIFICATIONS
**Status:** Phase 0 (specification; **no delivery implemented**)
**Related:** FR-NOTIF-*, ADR-0021, `OBSERVABILITY.md`, `COMMUNICATION.md`, `RUNBOOK.md`

---

## 1. Two different things (keep them apart)

| Concept | Nature | Storage | Audience |
| --- | --- | --- | --- |
| **OperationalAlert** | Domain object: an actionable condition about the business | Table, mutable, resolvable, owned | HQ roles, sometimes an operator |
| **Infrastructure alert** | Technical condition (latency, error rate, job failure) | Monitoring system | Engineering |

This document covers **operational alerts**. Infrastructure alerting lives in
`OBSERVABILITY.md` and `RUNBOOK.md`. A business condition must never be discovered only in a
Prometheus graph, and a server problem must never appear in an operator's task list.

---

## 2. Alert catalogue

| Alert | Trigger (condition) | Severity | Audience | Expected action | Channel (planned) |
| --- | --- | --- | --- | --- | --- |
| `SHIFT_NOT_STARTED` | Planned shift not started by +X min | P2 | Supervisor, Ops | Contact operator / reassign | In-app, push |
| `SHIFT_NOT_CLOSED` | Shift open past expected end +X min | P2 | Ops, Finance (after hours) | Prompt closing; investigate exceptions | In-app |
| `STALL_LOCATION_UNKNOWN` | Active shift with no location report > 90 min | P2 | Supervisor, Ops | Ask for a location update | In-app |
| `PRICE_NOT_ACKNOWLEDGED` | Effective price change unacknowledged > 24 h | P2 | Ops | Follow up with operators | In-app |
| `STOCK_LOW` | Position ≤ low threshold | P3 | Ops, warehouse | Plan restock | In-app |
| `STOCK_CRITICAL` | Position ≤ critical threshold | P2 | Ops, warehouse, supervisor | Immediate restock or reroute | In-app, push |
| `PAYMENT_PENDING_TOO_LONG` | Digital payment PENDING > TTL | P2 | Finance | Verify with provider / expire | In-app |
| `PAYMENT_RECONCILIATION_REQUIRED` | Amount mismatch, duplicate, or unmatched deposit | P2 | Finance | Manual reconciliation with evidence | In-app |
| `CASH_VARIANCE` | Closing variance beyond tolerance | P2 | Finance (+Ops for patterns) | Review reason; follow up neutrally | In-app |
| `EXPENSE_REVIEW_REQUIRED` | Expense flagged (manual or rule) | P3 | Finance | Review within SLA | In-app |
| `UNUSUAL_EXPENSE` | Aggregated pattern across shifts/locations | P3 | Finance, Ops | Investigate pattern; protect operators | In-app |
| `INCIDENT_OPEN` | Incident in OPEN beyond SLA, or any P1 | P1/P2 | Ops, supervisor | Acknowledge, assign, resolve | In-app, push, WhatsApp (config) |
| `OFFLINE_DATA_NOT_SYNCED` | Stall/operator has queued records > X min | P3 | Ops, support | Contact if prolonged; check app version | In-app |
| `STOCK_VARIANCE_REPEATED` | Same item/location beyond tolerance N times | P3 | Ops | Investigate systemically | In-app |
| `PRICE_OVERRIDE_FREQUENT` | Overrides above configured rate | P3 | Finance, Ops | Review policy fit | In-app |
| `SETTLEMENT_MISSING` | Expected settlement not observed within window | P2 | Finance | Chase provider / escalate | In-app |

Every alert must specify in its definition: trigger condition, severity, audience, **one clear
action**, and de-duplication window.

---

## 3. Delivery channels

| Channel | Class | Use for | Notes |
| --- | --- | --- | --- |
| In-app inbox + badge | **SELECTED** | Everything | Works offline (queued read), auditable, free |
| Web Push (VAPID) | PLANNED | P1/P2 where timely action matters | Permission-based; unreliable on aggressive OEM battery savers ⇒ never the only channel for money-critical items |
| WhatsApp Business Cloud API | OPTIONAL | Supervisors/HQ for P1/P2; customer receipts | On-Prem API deprecated (Oct 2025); Cloud API only; per-message pricing and template approval; WABA ownership required; 24 h service window |
| SMS | OPTIONAL | Fallback for P1 when push fails | Cost per message; SIM-swap caution for authentication use |
| Email | OPTIONAL | HQ report delivery, auditor invites | No operator role |
| Domain event → job queue | SELECTED (internal) | Alert generation | At-least-once, idempotent |

---

## 4. Alert object

```ts
interface OperationalAlert {
  alertId: string;
  organizationId: string;

  alertCode: AlertCode;             // e.g. "CASH_VARIANCE"
  severity: "P1" | "P2" | "P3";

  subject: { type: "SHIFT"|"STALL"|"OPERATOR"|"LOCATION"|"PAYMENT"|"EXPENSE"|"INCIDENT"|"AREA"; id: string };

  raisedAt: Date;
  data: Record<string, unknown>;    // enough context to act without extra lookups
  actionHint: string;               // "Review closing for shift …"

  audience: AudienceRef[];          // role/scope selectors
  state: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "SUPPRESSED" | "EXPIRED";
  ownerId?: string;
  acknowledgedBy?: string;          // role-scoped: only one role acks for that role
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNote?: string;

  dedupeKey: string;                // prevents alert storms
  occurrences: number;              // count while suppressed
  lastOccurrenceAt: Date;
}
```

---

## 5. Rules

1. **Actionability is mandatory** (FR-NOTIF-002): an alert that cannot be acted on must be a
   metric, not an alert.
2. **Deduplication**: same `dedupeKey` inside the window increments `occurrences` instead of
   creating a new alert.
3. **Rate limits**: per audience (e.g. ≤ 20 alerts/hour to one supervisor); overflow is
   summarised, not dropped silently.
4. **Acknowledgement** is per role where relevant (Ops ack ≠ Finance ack).
5. **Quiet hours** for P3 only; P1/P2 always break through (FR-NOTIF-005).
6. **No money state depends on delivery** (FR-NOTIF-007): an undelivered alert never changes a
   sale, payment, or closing.
7. **No public naming**: alerts never expose an operator as a suspect; they name *objects*
   (shift, payment, location) with neutral wording (FR-NOTIF-008).
8. **Escalation**: unacknowledged P1 escalates to the next role after a configured timeout.
9. **Auto-expiry**: condition-based alerts expire when the condition clears; manual ones must
   be closed by a human with a note.
10. **Language**: operator-facing alerts use field language without jargon (e.g. "Setoran belum
    selesai" instead of "reconciliation pending").

---

## 6. Notification preferences (planned)

| Preference | Scope | Notes |
| --- | --- | --- |
| Channel per severity | Per role/user | P1 always includes push if permitted |
| Quiet hours | Per user | P3 only |
| Digest mode | Per user | "Everything not urgent, at 08:00 and 17:00" |
| Language | Operator UI vs HQ | Indonesian default |
| Aggregation | Per user | "Combine all stock alerts for my area into one" |

Defaults are conservative: few alerts, high signal. Every alert that proves unactionable in
practice should be deleted from the catalogue, not tolerated.

---

## 7. Anti-patterns

- Alert fatigue by design (e.g. notifying HQ every 15 minutes that a shift is unclosed).
- Alerts that require three screens of context to understand.
- Alerts that punish: "Operator X has not sold in 30 minutes" is **not** an alert type here.
- Alerting on metrics that have no owner.
- Using alerts as a substitute for a missing operational process.
