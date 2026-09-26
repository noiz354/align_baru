# Shifts — Operator Walkthroughs

**Document ID:** DOC-PRODUCT-SHIFTS
**Status:** Phase 0 specification (nothing implemented; `startShift` throws `Not implemented: T-SHIFT-001`)
**Related:** `OPERATORS.md`, `LOCATIONS.md`, `SALES.md`, `SETTLEMENT.md`, `OFFLINE.md`, `STATE_MACHINE.md` §1,
`TASKS.md` (T-SHIFT-001/002, T-LOC-004/005, T-CLOSE-001/002/003), `docs/product/HQ-DASHBOARD.md`

---

## 1. Why the shift is the centre of the system

A shift is one operator, one stall, one bounded working session. It is the unit of **cash
accountability**: expected cash, expenses, handovers and the closing all resolve against it. That is
why a shift cannot be deleted, why it carries the business day from its start, and why the handover
is a first-class operation rather than an edit.

## 2. Start shift (target: 4 taps)

```text
1. Beranda → "Mulai shift"
2. Konfirmasi uang awal  (prefilled with the previous closing's counted cash; editable)
3. Konfirmasi lokasi jualan (planned location; can be changed later with a reason)
4. "Mulai"  → shift OPEN
```

Captured at start: operator, stall, planned selling location, opening cash (optional but
recommended), starting stock (quick list from the stall's usual issue), business day (server-derived),
`clientShiftId` (offline-creatable), device timestamp as metadata only.

Rules:

- Works fully offline. The shift is `DRAFT_OFFLINE` locally, `OPEN` after acceptance; the operator
  sees an honest sync state, never a fake success.
- A second active shift for the same stall is refused unless a handover happens or a supervisor
  override with a reason is recorded (FR-SHIFT-002).
- A stall in `MAINTENANCE`, `RETIRED` or `IN_TRANSIT` cannot start a shift without a recorded
  supervisor override (FR-STALL-005).
- The business day is fixed at start and never moves, even if the shift runs past midnight
  (ADR-0033).

Failure cases and what the operator sees: no assignment for that stall ("Kamu belum ditugaskan ke
gerobak ini — hubungi pengawas"), suspended operator status, stall already selling (offers handover),
no configured price for the stall's items (see §5).

## 3. Report where I am selling (target: 3 taps)

| Trigger | Meaning | Required input |
| --- | --- | --- |
| `ARRIVED` | First report of the shift at a location | Location (list or new proposal), optional one-shot position prefill |
| `CONFIRM_UNCHANGED` | Still at the same place later in the shift | One tap |
| `MOVE_SITE` | Moved to another selling point | New location + reason chip (crowded, permission issue reported, weather, competition, customer flow, equipment, personal, other) |
| `STEPPED_AWAY` | Temporarily away (e.g. buying ice) | Optional note |
| `DEPARTED` | Left the location for the day | One tap |

Rules: reports exist **only** while the shift is active; there is no background or timed capture
(ADR-0007); a move closes the previous report rather than editing it, so history keeps both windows;
a location marked `RESTRICTED` or `TEMPORARILY_UNAVAILABLE` produces a warning, never a block — the
operator knows the field better than the app, and the record notes the state at the time.

## 4. During the shift

- **Sales** (`/sell`): the POS grid shows only what the server says is sellable at that location;
  the price shown is the resolved price and the snapshot is taken at acceptance.
- **Selling while suspended**: refused with a clear message; resumes with one tap.
- **Long shift**: past the configured maximum the supervisor sees an alert — the operator sees a
  prompt to close or hand over, never a penalty.
- **Cash on hand check**: the operator can view expected cash at any time; this is informative, not a
  request.
- **Requests** (2 taps): "Butuh bantuan", "Tidak bisa jualan", "Alat rusak", "Stok habis",
  "Masalah uang". These are operational messages attached to the shift, not a chat.

## 5. Problems and the exact wording

| Situation | Operator sees | System does |
| --- | --- | --- |
| No price configured for an item | "Harga belum diatur untuk item ini. Hubungi pengawas." | Item shown as not sellable; HQ alert raised (FR-PRICE-006) |
| Two equally specific price policies | "Ada 2 harga aktif untuk item ini. Hubungi pengawas." | Resolution fails loudly; sale blocked; HQ alerted |
| Price changed since the device last synced | "Harga baru tersedia" (digest-bound) | Price acknowledgement required before selling that item |
| Offline while starting a digital payment | "Tanpa sinyal. Pembayaran digital butuh koneksi. Gunakan tunai." | No queue entry created for a digital success (ADR-0033) |
| Stock item not counted at closing | "Belum dihitung" | Recorded as `UNCOUNTED`, retried or flagged — never treated as zero |

## 6. End shift and closing (target: 8 taps)

```text
1. Beranda → "Tutup hari"
2. Hitung stok       (per item: jumlah; or "Belum dihitung")
3. Alasan selisih    (only when beyond tolerance; chips + optional note)
4. Hitung uang       (keypad with presets + "uang pas"-style quick values)
5. Ringkasan         (expected vs counted, neutral variance, unresolved verifications)
6. Konfirmasi        →  kirim
```

Closing content: gross sales by method, cash expenses, expected cash, counted cash, variance with
reason, stock variances with reasons, unresolved digital verifications, open incidents, departure
location report.

Rules:

- Offline: stored as `PENDING_SYNC`, visibly editable until the server accepts it (FR-SHIFT-009).
- Submitting twice for one shift returns the existing closing with a replay indicator (FR-SETTLE-010).
- On acceptance the closing is immutable; a later correction is a new audited record (FR-SETTLE-002).
- The expected cash figure is computed from records: opening cash + cash sales − cash expenses − cash
  removals. Digital amounts never enter this arithmetic.
- A closing with a variance beyond tolerance needs a reason and a supervisor review; the wording is
  neutral ("Selisih Rp25.000") and `UNKNOWN` is always available.

## 7. Handover (relief operator, unplanned cover)

```text
outgoing operator: "Serah terima" → confirm cash counted + unsold stock note + open issues
incoming operator: "Terima"       → confirms the same numbers
server:            transfers accountability, snapshots carry-over values, splits sales by time
```

Rules (FR-HANDOVER-001..005):

- Both confirmations are required; accountability does not move on one side's word.
- The snapshot is immutable: carry-over cash, unsold stock note, pending verifications, open incidents.
- Sales before the handover belong to the outgoing operator, after it to the incoming operator, using
  the server-accepted handover time.
- A carry-over cash difference is flagged for supervisor review and does **not** block the handover —
  work continues, the discrepancy is handled by a human.
- Outcomes: `COMPLETED`, `CANCELLED` (with reason), `DISPUTED` (with note) — all audited.

## 8. What the product never does at shift level

No forced photographs of the operator, no location pings between reports, no shift-level leaderboard,
no app-usage telemetry, no automatic suspension, no "productivity" scoring from shift data, and no
way to close a shift by erasing an inconvenient record.

## 9. Test and QA anchors

`tests/unit/shift-expected-cash.test.ts`, `tests/integration/closing-immutability.test.ts`,
`tests/e2e/offline-day.spec.ts`, QA scenarios QA-S-01..QA-S-07, QA-O-01..QA-O-05 (see `QA.md`).
