# CHECK-IN

The entrance workflow: the highest-frequency, most failure-sensitive path in the product.

Requirements: FR-CHECKIN-001…016 · Security: `docs/security/QR-SECURITY.md`, ADR-0006 ·
Performance: `PERFORMANCE.md` §Entrance · Concurrency: `docs/architecture/CONCURRENCY.md`

---

## 1. What check-in is

Check-in is the **admission and validation** act performed by a volunteer at the entrance. Its
output is an `AttendanceRecord` (owned by the attendance module) and a durable audit entry. It is
not registration, and it never invents attendance.

```
Volunteer Opens Scanner → Context Verified → Participant Shows QR → Scan
→ Validate (server, committed) → Attendance Confirmed → Immediate Feedback → auto-resume
```

## 2. Operator console (screen contract)

| Region | Content | Rule |
|---|---|---|
| Context bar (always visible, non-dismissible) | Event title · venue · entrance name · device label | Binding the device to one event is what prevents wrong-event scanning (`FR-CHECKIN-002`) |
| Viewfinder | camera preview, QR frame, hint | 60% of the viewport on a phone held vertically |
| Result panel | large state: ✓ / ⚠ / ✕ + first name + count + time | ≥ 40% of the viewport; readable at 1 m; never colour-only |
| Running totals | checked-in / capacity, per-entrance throughput | visible, non-dominant |
| Fallback strip | "Cari nama" · "Datang langsung" · manual code field | one tap away at all times |

Rules: no navigation, no menus, no dialogs during scanning; the operator cannot leave the screen by
accident (navigation requires an explicit action and warns if a check-in is in flight); the
operator's own contact details are never displayed.

## 3. Scanning sequence (target: ≤ 5 s per participant, p95)

1. Decode a QR locally (`ADR-0026`): Tier 1 native `BarcodeDetector`, Tier 2 `zxing-wasm`,
   manual entry always available.
2. Parse strictly to an expected payload shape. Anything else → `INVALID_FORMAT`, rejected locally
   (no server call, no queue stall).
3. Pause decoding for this code until the result arrives (prevents double-fire).
4. `POST /api/v1/checkin/validate` (single round trip that **commits** on success), carrying
   `eventCheckinId` + `Idempotency-Key`.
5. Render the result, then resume scanning automatically (≤ 400 ms).

Timeouts: client waits 4 s (3G) / 2 s (4G-detected) before showing "belum tercatat — coba lagi".
A timeout is **not** a failure state and **not** a success state; it is "unknown" with a retry.
The participant is asked to hold the screen until a definitive result appears.

## 4. Result vocabulary (rendered states)

| Result | Visual | Sound | Operator action offered |
|---|---|---|---|
| `VALID` | Green ✓, first name, count, time | short success tone | continue (auto) |
| `ALREADY_CHECKED_IN` | Amber ⚠, "Sudah check-in pukul 06.02" | short neutral tone | continue; optional "tandai perlu diperiksa" |
| `INVALID_TOKEN` / `INVALID_FORMAT` | Red ✕, "Kode tidak dikenali" | short failure tone | Cari nama · Datang langsung |
| `WRONG_EVENT` | Red ✕, "Kode ini milik kajian lain" | failure tone | verify context; Cari nama for **this** event |
| `EXPIRED` | Red ✕, "Kode sudah tidak berlaku" | failure tone | Cari nama (registration may be valid) |
| `CANCELLED` | Red ✕, "Pendaftaran ini dibatalkan" | failure tone | Datang langsung (if attendance mode allows) |
| `WINDOW_CLOSED` | Red ✕, "Check-in belum dibuka / sudah ditutup" | failure tone | contact organizer; manual correction later |
| `UNAVAILABLE` | Grey ⟳, "Belum tercatat — periksa koneksi" | none | retry · paper/manual fallback |

**Rule:** only `VALID` and `ALREADY_CHECKED_IN` are ever presented as positive. No state may be
ambiguous about whether attendance was recorded (`NFR-REL-002`).

## 5. Walk-in registration at the entrance

- Two fields: name (required), contact (optional, encouraged for archive access later).
- The operator's client generates a stable `walkInRef` (UUIDv7) so a duplicate submission (retry,
  double tap, second volunteer) converges to one attendance record (ADR-0025, `I-ATT-2`).
- If the contact matches an existing registration for the same event → the operator is told
  ("Terdaftar sebelumnya sebagai …") and can check them in instead of creating a walk-in.
- A short code is issued so the walk-in can later reach the archive/feedback; it is displayed
  large with a copy action and delivered by the notification channel when available.
- Walk-ins are permitted only when the event's attendance mode allows it; otherwise the operator is
  told exactly why not and who to ask.

## 6. Manual fallback paths (always available)

| Situation | Path |
|---|---|
| Camera unavailable / permission denied | Replace the viewfinder with the **name search** + short-code field (never an empty black box) |
| Participant has no phone / dead battery | Name search → the operator confirms by asking the participant's name and their declared participant count (no additional PII is requested or displayed), then records `NAME_LOOKUP` with a reason |
| Screen cracked / QR too dim | Manual short code entry (32 px tabular) |
| Participant is a walk-in | Walk-in registration (§5) |
| Elderly/unfamiliar participant | Operator performs the check-in on their behalf; the method is recorded |

Every manual path records `method` (`SHORT_CODE`, `NAME_LOOKUP`, `WALK_IN`, `MANUAL_CORRECTION`) so
the attendance report can distinguish how attendance was established (`ATTENDANCE.md` §Honesty).

## 7. Edge cases (explicit product behaviour)

| Case | Behaviour | Why |
|---|---|---|
| Already checked in (same event) | `ALREADY_CHECKED_IN` with the first scan time; **not** an error | Duplicate scans are normal (two entrances, re-showing the code); blocking would slow the queue |
| Wrong event | `WRONG_EVENT`, name of the event withheld | Prevents leaking other mosques' event names to a stranger's screen |
| Expired token (event long past, token retention window passed) | `EXPIRED` + manual lookup if the registration still exists | Never claim a check-in that cannot be recorded |
| Invalid QR (a random QR code, a poster QR, a WiFi QR) | Local `INVALID_FORMAT`; no server call | Protects the API and the operator's time |
| Cancelled registration | `CANCELLED` + offer walk-in if mode allows | A cancelled participant at the door is a real person who is present |
| Walk-in at a registration-required event | Allowed if `attendanceMode = REGISTRATION_OPTIONAL`; otherwise the operator sees who to ask for an override | Policy is explicit, not the volunteer's problem |
| Scanner offline / network unstable | `UNAVAILABLE`, never success; the console shows the last-confirmed count and how long ago it synced | Truthfulness over apparent progress (`ADR-0007`, `CHECKIN.md` §8) |
| Duplicate scan concurrently from two devices | One `VALID`, one `ALREADY_CHECKED_IN` (constraint-level convergence) | `CONCURRENCY` C2 |
| Multiple entrances | Each device is bound to one entrance; attendance records the entrance; totals aggregate | Enables per-entrance throughput and reconciliation |
| Simultaneous scans of different participants | Independent transactions; no shared lock beyond the row | Throughput target ≥ 20/min per device |
| Event capacity reached | Check-in continues for registered participants; capacity affects registration, not admission of people already registered | Turning people away at the door is not the software's decision |
| Participant's token shown from a forwarded screenshot | Indistinguishable from a legitimate scan at the operational level: the first scan wins; the second is `ALREADY_CHECKED_IN`; an abnormal duplicate rate raises an alert (`QR replay`) | Honest tradeoff documented in `docs/security/QR-SECURITY.md` §Residual risk |
| Two kajian happening at the same mosque simultaneously | Device binding chooses one; an operator can switch with an explicit, warned action (audited) | Prevents silent mis-attribution |
| Check-in window not open (arrivals an hour early) | `WINDOW_CLOSED` with the window times shown; an organizer can open early (audited) | Organizers control their own doors |

## 8. Offline behaviour (current decision)

**Not implemented; fully evaluated in `docs/attendance/OFFLINE-EVALUATION.md` and ADR-0007.**

The supported degraded modes today:

1. **Organizer opens the window and counts on paper**, then uses manual attendance correction or a
   bulk "semua hadir" action per entrance (P2, audited, with a reason).
2. **Name search without camera** works as long as the network works.
3. If the network is entirely down, **no attendance may be claimed as recorded.** The console
   displays a clear instruction and the operator's device refuses to fabricate success.

Reason for the decision: an offline "success" that is later revealed to be duplicate or invalid is
worse than an honest "belum tercatat" — the attendance number is used for planning and reporting at
a mosque, and a wrong number is a trust failure (`ADR-0007`).

## 9. Performance and capacity

| Target | Value | Source |
|---|---|---|
| Server validation p95 | ≤ 300 ms | NFR-PERF-002 |
| End-to-end scan → confirmation p95 (4G) | ≤ 1 s | NFR-PERF-003 |
| End-to-end p95 (3G) | ≤ 2.5 s | NFR-PERF-003 |
| Per-device sustained throughput | ≥ 20 check-ins/min | NFR-PERF-004 |
| Per-event sustained throughput | ≥ 200 scans/min across devices | NFR-PERF-004 |
| Queue handling | 500 arrivals in ≤ 15 minutes with 3 devices | Acceptance criteria §17.1 |

Design consequences: no queueing on this path (`ARCHITECTURE.md` §7.1), no notification work inside
the transaction, indexed lookup by token hash, and a bounded response size.

## 10. Security (summary; see `docs/security/QR-SECURITY.md`)

- Tokens are opaque, hashed at rest, never logged, never in notifications on an uncontrolled channel.
- The QR payload contains no PII and no database ids (ADR-0006).
- Device binding, rate limiting per device, and anomaly detection on duplicate scans.
- The validation response reveals only the first name (for human confirmation).
- Operator permissions are scoped to the event/mosque; a volunteer from another mosque cannot scan
  into someone else's event.
- Manual check-in methods are audited and visible in reports, so a "manual-only" event is visibly
  different from a QR-verified one.

## 11. Operational guidance for organizers (documented, not implemented)

- Print or display a **fallback list** (names + short codes) at the entrance for a total network
  failure — generated by the organizer before the event from an authorised export. This is an
  operational procedure in `RUNBOOK.md`, deliberately outside the software's offline scope.
- Assign one device per entrance and label the devices ("HP panitia 2") — the label is recorded on
  attendance records, which makes reconciliation possible.
- Open the window 15 minutes before the session; close it when the khutbah/session begins to keep
  `NO_SHOW` meaningful.
