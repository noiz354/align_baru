# OPERATORS

**Document ID:** DOC-OPERATORS
**Status:** Phase 0
**Related:** `PRD.md` §6.1, `STATE_MACHINE.md` §2, `PERFORMANCE.md`, `PRIVACY.md`, `docs/security/PERMISSIONS.md`

---

## 1. What an operator is (and is not)

An **operator** is the person accountable for a stall's cash and stock during a shift.
Operators are not "users of an app" from the business's point of view — they are the
operational unit of the network, and the platform exists to make their day shorter and their
accountability fairer.

An operator is **not**:
- a surveilled worker (no continuous location tracking, ever — ADR-0007)
- a data-entry clerk expected to understand accounting
- a target of automated punishment (no metric can trigger a sanction — FR-PERF-004)

---

## 2. Operator profile

```ts
interface OperatorProfile {
  operatorId: string;
  name: string;

  assignedStallIds: string[];       // usually one, but relief operators exist
  primaryAreaId: string;
  organizationId: string;

  status: OperatorOperationalStatus; // see §4
  contact: {
    phoneE164: string;               // primary credential (OTP) — PII, access-scoped
    whatsappOptIn?: boolean;         // for future notifications, separate consent
    emergencyContactMasked?: string; // optional, masked by default
  };

  contractType: "EMPLOYEE" | "DAILY" | "FAMILY" | "PARTNER";
  trainingState: "NOT_STARTED" | "BASIC" | "CERTIFIED" | "REFRESHER_DUE";
  startedOn: string;                 // ISO date
  active: boolean;
}
```

Notes:

- `phoneE164` is the primary credential because operators reliably have a phone number and
  reliably do not remember passwords. It is stored once, used for OTP and (optionally)
  notifications, never displayed in full to other operators.
- `contractType` affects **policy and reporting** (e.g. eligibility for recognition
  categories, working-time sensitivity) and never access rights.
- `trainingState` gates only one capability: local price override rights (FR-OPERATOR-003,
  ADR-0009).

---

## 3. Assignment model

```text
Operator ──(OperatorAssignment: valid_from, valid_to, type)──► Stall ──► Area ──► Region
```

| Assignment type | Meaning | Typical use |
| --- | --- | --- |
| PRIMARY | Regular operator of a stall | Most cases |
| RELIEF | Covers someone else's stall | Illness, leave |
| TEMPORARY | Short planned period | Events, trials |
| TRAINEE_ACCOMPANIED | Learning under supervision | Onboarding (cannot sell alone until CERTIFIED) |

Rules:

1. An operator may hold at most one active PRIMARY assignment.
2. Assignments never overlap for the same stall on the same day without an explicit
   supervisor decision (recorded).
3. Historical assignments are preserved; the platform must answer "who was accountable on
   date X for stall Y" at any time (audit requirement).
4. Changing assignment does not retroactively change historical shift attribution.

---

## 4. Operational status and transitions

```text
OFF_DUTY → READY → ON_SHIFT → SELLING ⇄ ON_BREAK
                     │            │
                     │            └──► MOVING ──► SELLING
                     └──► CLOSING ──► OFF_DUTY
SUSPENDED (HQ-set; blocks shift start and sales)
```

| Status | Entry condition | Exit condition | Side effects |
| --- | --- | --- | --- |
| OFF_DUTY | No active shift | Shift started | — |
| READY | Logged in, no active shift, not suspended | Shift start / logout | HQ may prompt unstarted planned shifts |
| ON_SHIFT | Shift status OPEN | Prices acknowledged + first sale intent | HR/ops: shift duration clock starts |
| SELLING | Shift ACTIVE | Break / move / closing | Selling-time metrics accrue |
| ON_BREAK | Operator paused | Resume | Break time excluded from selling-time normalisation |
| MOVING | Location change in progress | Arrival confirmed | Movement time excluded from selling-time normalisation |
| CLOSING | Closing workflow started | Shift CLOSED | New sales locked (queued ones may still land) |
| SUSPENDED | HQ action with reason | HQ unsuspension with reason | Cannot start shifts or record sales; historical data untouched |

**Forbidden transitions:** SUSPENDED → {READY, ON_SHIFT, SELLING}; ON_SHIFT without stall;
SELLING after CLOSING has begun (queued sales are timestamped before the closing and are
accepted or rejected explicitly, never silently).

---

## 5. Operator-facing capabilities (what they can and cannot do)

| Capability | Operator (own) | Relief operator | Supervisor | HQ Ops | HQ Finance |
| --- | --- | --- | --- | --- | --- |
| Start/close own shift | ✅ | ✅ | ✅ (own) | ✅ (any in scope) | — |
| Report selling location | ✅ | ✅ | ✅ | ✅ | — |
| Record sales/payments | ✅ | ✅ | ✅ | ✅ (correction path only) | — |
| Record expenses | ✅ | ✅ | ✅ | ✅ | — |
| Submit stock counts | ✅ | ✅ | ✅ | ✅ | — |
| Use local price override | Per policy + training | Per policy | ✅ (may grant) | ✅ | — |
| View own performance breakdown | ✅ | ✅ | ✅ | ✅ | ✅ |
| View another operator's financials | ❌ | ❌ | ✅ (in area) | ✅ (in scope) | ✅ |
| Void a sale | ❌ | ❌ | Request only | ✅ (audited) | ✅ (audited) |
| Reopen a closed shift | ❌ | ❌ | ❌ | ❌ | ✅ (audited, reason) |

---

## 6. Operator experience requirements (binding on design)

1. **Login is low-friction**: phone number + OTP (planned), long-lived session on a trusted
   device, no password reset dance mid-shift.
2. **Start shift ≤ 4 taps** when the operator sells at the usual location with usual stock.
3. **Never blocked by a form**: any missing optional data is a prompt after the action, never
   a gate before it.
4. **Nothing disappears**: unsynced records are always visible with a count and per-item retry.
5. **No accusation language** anywhere: variance is a question, not a verdict.
6. **Their own data is theirs to see**: shift history, totals, variance history, recognition
   factor breakdown (FR-OPERATOR-010, FR-PERF-003).
7. **Works without a map, camera, or WebGL** (NFR-ACCESS-007).

---

## 7. Onboarding, offboarding, and account lifecycle

| Stage | Actions | Notes |
| --- | --- | --- |
| Pre-onboarding | Interview/reference check (outside system) | No sensitive personal documents stored in the app. |
| Onboarding | Create profile, verify phone, assign area/stall, set training state, record start date | Consent/notice for processing personal data recorded (UU PDP). |
| Training | TRAINEE_ACCOMPANIED assignment; can use a training mode view | Training data must not pollute performance metrics (flag `isTraining`). |
| Active | Normal operation; refresher training when `REFRESHER_DUE`. | |
| Suspension | Status SUSPENDED with reason + actor + date; access blocked for selling, history preserved | Time-bounded by review policy; the operator sees the reason. |
| Offboarding | `active = false`, sessions revoked, assignment closed | Financial history retained per `RETENTION.md`; personal data minimised on lawful request. |

---

## 8. Fairness and dignity requirements

| Requirement | Implementation stance (future) | Source |
| --- | --- | --- |
| Performance is contextual, not sales-only | Multi-factor, normalised metrics | FR-PERF-001/002 |
| No automated punishment | Metrics never trigger sanctions automatically | FR-PERF-004 |
| Recognition is normalised for location traffic | Baseline-relative scoring, published weights | FR-RECOG-004, ADR-0029 |
| Quiet-location operators can win | Explicit factor design (compliance, accuracy, feedback, reliability) | `docs/product/OPERATOR-RECOGNITION.md` |
| Operators can see their own factor breakdown | Operator-visible breakdown screen | FR-RECOG-007 |
| Operator-linked customer ratings are not public | Default private; aggregates only | FR-PERF-006 |
| Suspension requires a stated reason | Reason mandatory in the action | FR-OPERATOR-007 |
| Honest "I don't know" is allowed | `UNKNOWN` variance reason exists | DESIGN.md §6 |

---

## 9. Planned data protection for operator personal data

| Data | Sensitivity | Handling |
| --- | --- | --- |
| Name | Personal | Visible within operational scope |
| Phone number (E.164) | Personal, contact | Masked in list views, full only to self/HQ with role; never in logs |
| Contract type | Personal (employment) | HQ HR-ish roles only |
| Training state | Personal (work) | Supervisor + HQ |
| Shift times | Personal (work) | Operator, supervisor, HQ; used for normalisation, not surveillance |
| Reported locations | Personal (movement) | Shift-bound only; visible to operator, supervisor, HQ Ops |
| Incident involvement | Sensitive | Restricted to responders + HQ; never shown to peers |
| Health/safety incident details | Sensitive | Restricted; retention-limited; no public dashboards |

Full mapping: `PRIVACY.md`, `RETENTION.md`, `THREAT_MODEL.md` (T-03 "operator accessing
another operator's shift").
