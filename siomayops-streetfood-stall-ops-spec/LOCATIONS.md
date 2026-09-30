# LOCATIONS — Selling Points (Mangkal)

**Document ID:** DOC-LOCATIONS
**Status:** Phase 0
**Related:** FR-LOCATION-*, ADR-0007, `PRIVACY.md`, `docs/locations/*`, `COMMUNICATION.md`

---

## 1. Hierarchy

```text
Region              e.g. Jakarta, Bandung, Surabaya
 ↓
Area                e.g. Tebet, Kelapa Gading, Cikini  — owned by a supervisor
 ↓
Selling Point       a specific mangkal spot ("Mangkal Tebet Parkir Timur")
 ↓
Operator / Stall    who is selling there, right now, per shift
```

Rationale: pricing, supervision, stock logistics and performance baselines all need an
**area** level, while the operator's daily reality needs a **specific spot** with a landmark,
a window, and a note about the ground truth (e.g. "after 17:00 the shade moves").

---

## 2. Selling point profile

```ts
interface SellingLocation {
  sellingLocationId: string;
  organizationId: string;
  areaId: string;

  name: string;                 // "Mangkal Tebet Parkir Timur"
  addressText: string;          // human address, no need for perfect geocoding
  lat?: number;                 // optional, operator-confirmed
  lng?: number;
  landmark: string;             // "sebelah gerbang timur, dekat pos"
  windows?: SellingWindow[];    // allowed/typical selling windows
  usualFeeNote?: string;        // free text note ("biasanya ada biaya kebersihan")
  notes?: string;               // operational ground truth
  status: SellingLocationStatus;

  // Provenance — never an assertion of legality
  permissionStatus: "NOT_ASSESSED" | "OPERATOR_REPORTED_VERIFIED_BY_HQ";
  permissionEvidenceNote?: string;
}
```

### Selling windows (optional)

```ts
interface SellingWindow {
  dayOfWeek?: number[];        // 0–6; omitted = every day
  startLocalTime: string;      // "16:00"
  endLocalTime: string;        // "22:00"
  note?: string;
}
```

Windows are **advisory guidance for planning**, never a hard gate: an operator may need to sell
outside a window because the street changed that day, and the platform records reality rather
than enforcing a fiction.

---

## 3. Location status

```text
AVAILABLE ──occupied──► ACTIVE ──departure──► AVAILABLE
     │                     │
     │                     ├──► CROWDED (advisory)
     │                     ├──► TEMPORARILY_UNAVAILABLE (short-term)
     │                     └──► RESTRICTED (HQ-set: do not place here)
     └──► INACTIVE (HQ-set: retired/obsolete)
```

| Status | Meaning | Who sets it | Effect |
| --- | --- | --- | --- |
| AVAILABLE | Fine to use | Any/auto | Selectable |
| ACTIVE | Currently occupied (≥1 stall) | System | Shown occupied; still selectable with a crowding warning |
| CROWDED | Too many stalls / unusable now | Operator report or HQ | Warning to others; HQ advisory |
| TEMPORARILY_UNAVAILABLE | Blocked today (market day, construction, event) | Operator/ HQ | Warning + suggested alternates |
| RESTRICTED | Do not place stalls here (safety, agreement, HQ policy) | HQ only, with reason | Selection discouraged; override requires supervisor |
| INACTIVE | Obsolete record | HQ only | Hidden from default lists; history retained |

**Statuses are operational, not legal.** A `CROWDED` or `RESTRICTED` status says what the
business decided for operations; it never asserts an official permission or prohibition.

---

## 4. Operator location reporting

The single most important location rule: **the operator explicitly reports where the stall is
selling.** No background tracking, no passive telemetry, no "we noticed you moved".

```ts
/**
 * Operational location reported by an operator.
 *
 * This represents where the stall is currently selling.
 * It must NOT become a hidden continuous employee surveillance mechanism.
 *
 * Requirements: FR-LOCATION-001, NFR-PRIVACY-004
 */
interface OperatorLocationReport {
  operatorId: string;
  stallId: string;
  sellingLocationId: string;
  reportedAt: Date;
  reason?: LocationUpdateReason;
}
```

### Report triggers (operator-initiated only)

| Trigger | UI action | Recorded reason |
| --- | --- | --- |
| Start of shift | "Saya mulai di sini" | `SHIFT_START` |
| Confirm unchanged | "Masih di sini" (1 tap) | `CONFIRM_UNCHANGED` |
| Move | "Pindah" → pick spot/reason | `CROWDED` / `ASKED_TO_MOVE` / `CLOSED` / `WEATHER` / `STOCK_OUT` / `BETTER_SPOT` / `OTHER` |
| Temporary pause at another spot | "Selling temporarily at …" | `TEMPORARY_STOP` |
| Stop selling | "Berhenti di sini" | `STOPPED` |

### Optional one-shot position assist

Under ADR-0039, an explicit button may request one GPS fix to help the operator confirm a
selling point. The operator sees the device-reported coordinates, accuracy, and capture time, then
chooses/confirms the selling point before submitting. The optional fix is attached to that explicit
shift-bound location report and retained for at most 14 days. Multiple explicit reports can therefore
form a sparse, short-lived shift-only sequence; this is not continuous tracking and is never used for
attendance, discipline, or performance scoring. It is clearly labelled "posisi perkiraan — mohon
periksa" and can be omitted when permission is denied or unavailable.

---

## 5. Location communication

Operators need to say things about locations quickly, and HQ needs those signals in one place.

```text
Operator Location Update
        ↓
Operations Timeline  (threaded, per area/location)
        ↓
HQ Dashboard         (Location Changes card + alerts)
```

| Operator message | Meaning | HQ reaction (planned) |
| --- | --- | --- |
| "Mulai di lokasi X" | Shift start | Coverage board updates |
| "Pindah ke Y" | Move | Coverage change; check crowding |
| "Lokasi ramai/penuh" | Crowded | Advise alternates; adjust assignments |
| "Lokasi tidak bisa dipakai" | Unavailable | Mark TEMPORARILY_UNAVAILABLE; notify nearby stalls |
| "Diminta pindah" | Asked to move | Recorded neutrally; supervisor awareness; no legal conclusion |
| "Tutup sementara" | Temporary closure | Coverage gap detection |
| "Cuaca" | Weather disruption | Expectations adjusted for performance fairness |
| "Stok hampir habis" | Stock nearly gone | Restock request prompt |
| "Berhenti operasi" | Stopping | Shift closing prompt |

Language rules: neutral verbs, no speculation about who asked the operator to move or why.
The record states what the operator reported, nothing more.

---

## 6. Location history

```ts
interface LocationHistoryEntry {
  operatorId: string;
  stallId: string;
  sellingLocationId: string;
  arrivedAt: Date;
  departedAt?: Date;            // null while still there
  reportedBy: string;           // operator who reported
  reasonForMove?: LocationUpdateReason;
}
```

Rules:

1. History is **derived** from reports, not maintained separately (no drift).
2. Entries are append-only; corrections create a new entry with a note and an audit trail.
3. History is retained per `RETENTION.md` — long enough for operations and disputes, no longer.
4. HQ uses history for coverage, planning, and location performance; it is **not** used to
   reconstruct an operator's non-working movements (it cannot: reports only exist during shifts).
5. Performance normalisation uses **location traffic baselines**, not operator movement trails.

---

## 7. Location performance (how a place is judged, not a person)

| Signal | Meaning | Caveats shown to HQ |
| --- | --- | --- |
| Gross sales per hour present | Demand at that spot | Weather, day-of-week, stock availability |
| Transactions per hour | Customer traffic | Menu availability |
| Move-away frequency | Instability of the spot | Reporting bias |
| Incident frequency | Friction at the spot | Category mix |
| Expense pattern (e.g. recurring site fee) | Cost of operating there | **Not** a legality judgement |

Rankings are presented with confounders visible; a quiet location is not a verdict on the
operator who works it (ADR-0029).

---

## 8. Privacy guardrails (binding)

| Guard | Rule |
| --- | --- |
| Shift binding | Reports exist only while a shift is active (NFR-PRIVACY-003). |
| No background collection | No `watchPosition`, no periodic sync of position, no passive logging. |
| No history inference | The system never derives movement outside reported selling positions. |
| No covert use | Operators can always see their own reported history. |
| Retention | Location reports expire per `RETENTION.md`; aggregates may outlive raw reports. |
| No permission claims | `permissionStatus` defaults to `NOT_ASSESSED` and is only set by explicit HQ verification with a note (FR-LOCATION-010). |
