# INCIDENTS

**Document ID:** DOC-INCIDENTS
**Status:** Phase 0 (specification; **no incident logic implemented**)
**Related:** FR-INC-*, `STATE_MACHINE.md` §11, `NOTIFICATIONS.md`, `RUNBOOK.md`, `PRIVACY.md`

---

## 1. Purpose

Incidents capture the things that go wrong in the field that today are lost: a broken burner at
07:00, a customer dispute over change, a cart tyre, a flooded spot, a theft, a safety near-miss,
a forced relocation. Recording them turns repeated pain into fixable patterns.

Two things to hold at once:
1. **Fast to report** (an angry operator in the rain will not fill a 12-field form).
2. **Structured enough to act on** (category, severity, location, time, evidence).

---

## 2. Categories (configurable)

| Code | Meaning | Typical severity | Auto-escalation |
| --- | --- | --- | --- |
| `EQUIPMENT_DAMAGE` | Burner, steamer, wheel, cart, cooler | P3 | No |
| `MISSING_STOCK` | Stock unaccounted for | P3 | No (review, not accusation) |
| `CUSTOMER_DISPUTE` | Disagreement with a customer | P3 | No |
| `CASH_DISCREPANCY` | Cash does not match | P2 | Review queue |
| `PAYMENT_PROBLEM` | QRIS/transfer issue, customer claims paid | P2 | Finance queue |
| `LOCATION_DISPUTE` | Conflict about the spot | P2 | Supervisor |
| `ACCIDENT` | Physical accident (self, customer, third party) | **P1** | Immediate |
| `HEALTH_SAFETY_ISSUE` | Hygiene, contamination risk, injury risk | **P1** | Immediate |
| `FORCED_RELOCATION` | Operator reports being made to move | **P1** | Immediate, neutral recording |
| `THEFT` | Theft of money, stock, or equipment | **P1/P2** | Immediate |
| `OTHER` | Anything else (note required) | P3 | No |

Severity: `P1` (safety/loss affecting a person or the day) · `P2` (operational disruption
needing same-day action) · `P3` (record and address in normal flow).

**Neutrality rule:** `FORCED_RELOCATION` records *what the operator reported*. The system does
not conclude who asked, or why, and does not name parties in any automated output.

---

## 3. Incident record

```ts
interface Incident {
  incidentId: string;
  organizationId: string;

  category: IncidentCategory;
  severity: "P1" | "P2" | "P3";
  severityAssignedBy: "SYSTEM_RULE" | "HUMAN";

  reportedByOperatorId: string;
  shiftId?: string;
  sellingLocationId?: string;
  stallId?: string;

  occurredAt: Date;              // device-reported when offline
  reportedAt: Date;              // server receipt
  description: string;           // bounded, plain language

  evidenceObjectKeys?: string[]; // optional photos
  involvedPartyNotes?: string;   // operator's own words; no structured accusation fields

  status: IncidentStatus;        // OPEN → … → CLOSED
  ownerId?: string;              // assigned responder
  resolutionNote?: string;

  linkedExpenseIds?: string[];
  linkedPaymentIds?: string[];

  clientIncidentId: string;      // offline idempotency
}
```

**Deliberately absent fields:** "who was at fault", "was the payment legal", "suspected
offender name". Such fields would encode assumptions the platform must not make.

---

## 4. Lifecycle

```text
OPEN ──ack──► ACKNOWLEDGED ──investigate──► INVESTIGATING ──resolve──► RESOLVED ──close──► CLOSED
  └──► ESCALATED (P1 / safety) ─────────────────────────────────────► CLOSED
CLOSED ──(reason required)──► OPEN   (reopen)
```

| Transition | Requirements | SLA (pilot targets) |
| --- | --- | --- |
| → ACKNOWLEDGED | HQ/Supervisor role; owner assigned for P1 | P1 ≤ 30 min; P2 ≤ 2 h; P3 ≤ next business day |
| → INVESTIGATING | Investigator assigned; plan noted | P1 immediate |
| → RESOLVED | Resolution note required | P1 ≤ 4 h |
| → CLOSED | Closure note; auto-close after N days in RESOLVED with a system note | — |
| → ESCALATED | Automatic for P1 categories; manual otherwise | Immediate notification chain |

Evidence and notes are append-only; edits create new entries with actor + time.

---

## 5. Offline behaviour

| Event | Behaviour |
| --- | --- |
| Report filed offline | Queued with device timestamp; shown as "belum terkirim" |
| P1 filed offline | On reconnect, flagged as "delayed sync" in HQ with the delay measurement; the operator sees a clear instruction for immediate human contact (phone) because the app cannot be the emergency channel |
| Evidence photo offline | Stored locally, uploaded after sync; incident can exist without evidence |
| Duplicate submission | Idempotent by `clientIncidentId` |

**Important:** the app is not an emergency service. Safety instructions in the UI direct the
operator to contact the supervisor/emergency services directly; the incident record is a
follow-up artefact, not a rescue mechanism.

---

## 6. HQ handling surfaces

| View | Contents | Actions |
| --- | --- | --- |
| Incident inbox | P1/P2 at top, ageing visible | Acknowledge, assign, escalate |
| Incident detail | Timeline, evidence, linked records, communications | Investigate, resolve, close |
| Trends | By category, area, location, time-of-day | Feed operational fixes (e.g. equipment replacement) |
| Equipment watchlist | Equipment incidents grouped by stall/item | Maintenance planning |
| Safety board | P1 health/safety history for an area | Policy and training response |

Aggregations never name operators as suspects; operator involvement is visible within the
incident scope only (privacy, dignity).

---

## 7. Evidence handling

| Aspect | Rule |
| --- | --- |
| Upload | Pre-signed URL; client-side compression; size/type limits |
| Access | Access-controlled; scoped to responders + HQ in scope; auditors read-only |
| Retention | Short (per `RETENTION.md`) unless linked to a legal/financial process |
| Third parties in photos | Guidance: avoid capturing faces/plates where not needed; store minimally |
| Deletion | Lawful deletion requests handled per `PRIVACY.md`; financial linkage may require retention of the incident record without the photo |

---

## 8. Interaction with other domains

```text
Incident ──may create──► Expense (e.g. repair cost)
Incident ──may link──► Payment problem / cash discrepancy review
Incident ──may adjust──► Performance expectations (documented disruption)
Incident ──may trigger──► Stock adjustment (wasted/damaged stock with reason)
Incident ──may inform──► Location status (e.g. temporarily unavailable)
```

Every such link is explicit, audited, and never automatic in a way that fabricates data.
