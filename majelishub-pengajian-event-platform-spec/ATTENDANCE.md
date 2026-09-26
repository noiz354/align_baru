# ATTENDANCE

The durable record of who came, how the numbers are reported, and how to correct mistakes without
destroying evidence.

Requirements: FR-ATTEND-001…008 · ADR-0025 · States: `STATE_MACHINE.md` §10

---

## 1. What attendance is (and is not)

| Attendance **is** | Attendance **is not** |
|---|---|
| One immutable record per person per event | A mutable counter on the event |
| Established by QR scan, short code, name lookup, walk-in, or a reasoned manual correction | A guess derived from registration |
| Reported with a stated window and method mix | A source of truth about a person's religious practice |
| Correctable with a reason, auditable | Deletable to make a number look better |

**Never** does attendance become a participant-level metric (no "attendance streak", no
per-person history visible to anyone outside the organizers of that event). This is a deliberate
limit (`PRD.md` NG-8, `NFR-ETH-001`).

## 2. The five numbers, defined precisely

| Number | Definition | Source | Honesty rule |
|---|---|---|---|
| **Registered** | Active registrations (`REGISTERED`) at the time of reporting, counted as **codes** and as **people** (`sum(participantCount)`) | `registrations` | Both numbers are shown when they differ; a group of 4 is 1 code, 4 people |
| **Checked In** | Attendance records created via QR/short code/name lookup | `attendance_records` where `method ∈ {QR, SHORT_CODE, NAME_LOOKUP}` | — |
| **Walk-In** | Attendance records created at the entrance without a prior registration | `attendance_records` where `method = WALK_IN` | Shown separately because it changes planning meaning |
| **No Show** | Active registrations with no attendance record, computed **after** the check-in window closes | derived | Labelled "belum check-in" until the window closes; never shown as a fact before then |
| **Cancelled** | Registrations cancelled before the event | `registrations` | Excluded from no-show |
| **Total attendance** | Checked In + Walk-In (+ manual corrections) | `attendance_records` | The number the organizer reports; each contributor is traceable to a method |

Worked example (mirrors the brief):

```
Registered        320 codes  (348 orang)   ← group registrations
Checked In        278
Walk-In            32
No Show            42   (window closed 06.45; derived)
Cancelled          17
Total attendance  310   = 278 + 32
Attendance rate   310 / 348 = 89%   ← denominator is people registered, not codes
```

Additional reporting rules:

- The **attendance rate** denominator is stated on screen (people vs codes) and never shown
  without it.
- A `NO_REGISTRATION` event reports only an estimate, explicitly labelled `perkiraan`, with the
  method used ("penghitung manual di pintu", "kursi terisi"). The product does not pretend to know.
- If manual corrections exceed a threshold (default 10% of check-ins), the report shows a data
  quality note: "banyak check-in manual — angka ini kurang dapat diverifikasi".
- If the check-in window was never opened, `NO_SHOW` is not computed at all; the report says
  "jendela check-in tidak dibuka".

## 3. Derivation of `NO_SHOW`

```
Closed(window) → for each registration where status = 'REGISTERED'
                   and no attendance_record exists
                 → count as NO_SHOW
              → emit AttendanceSummaryFinalized
```

Constraints on the derivation:

1. It runs **only** after the window closes (`STATE_MACHINE.md` §10).
2. It is a **report computation**, never written back onto the registration row (no
   `status = NO_SHOW` persisted for participants — the brief's candidate state is deliberately not
   stored; see `DOMAIN.md` §5 `I-ATT-5`). Rationale: a "no-show" is a statement about a report, not
   about a person, and persisting it creates a de-facto participant behaviour record.
3. If the window is reopened (late arrivals), the computation is rerun and the summary is
   versioned in `event_daily_stats`.
4. Late arrivals after the window close are admitted via the **manual correction** path with a
   reason ("datang terlambat, pintu samping"), and the report shows them under
   "check-in manual (di luar jendela)".

## 4. Corrections

Corrections exist because reality is messy (dead phones, one door unstaffed, a volunteer who
forgot to scan).

| Action | Effect | Required | Audit |
|---|---|---|---|
| `MARK_PRESENT` (create attendance for a registration) | Creates an attendance record with `method = MANUAL_CORRECTION` | reason (≥ 8 chars) | yes, with actor + before/after |
| `FIX_TIME` | Corrects `checked_in_at` | reason | yes |
| `FIX_VENUE` | Corrects venue/entrance attribution | reason | yes |
| `MARK_ABSENT` | Sets `presence_state = ABSENT` on the record (row remains, `is_corrected = true`) | reason | yes |

Rules:

- **Attendance records are never deleted** by an organizer. Deletion happens only through retention
  or a data-subject request, both audited.
- A correction cannot create a duplicate: `MARK_PRESENT` on a registration that already has a
  record returns `CONFLICT` with the existing record (`ADR-0025`).
- Bulk corrections ("semua yang terdaftar di pintu utara hadir") require an explicit reason and
  produce one audit event per affected record plus one summary audit event.

## 5. Reporting surface (conceptual dashboard)

```
Kajian: Kajian Ba'da Subuh — Minggu, 11 Okt 2026 · Masjid Al-Ikhlas · Ruang Utama
Jendela check-in: 05.45–06.45 (dibuka 05.42, ditutup 06.47)

Terdaftar           320 kode · 348 orang
Check-in            278  (QR 241 · kode pendek 22 · cari nama 15)
Datang langsung      32
Belum check-in       42   ← dihitung setelah jendela ditutup
Dibatalkan           17
Total kehadiran     310
Per pintu           Pintu utama 214 · Pintu samping 78 · belum teratribusi 18
Catatan mutu data   check-in manual 15 (5%) — masih wajar
```

The UI must let an organizer open any number to see its definition and its contributor rows (with
authorisation), because a number nobody can explain is a number nobody should report.

## 6. Export

- CSV export with a **field-selection step**; default fields: name, status, method, `checked_in_at`.
- Contact details require: role `ORGANIZER`, an explicit toggle, and a stated reason (recorded).
- Export files are generated by the worker, stored privately, delivered as a short-lived presigned
  URL, and **deleted after 7 days** (`RETENTION.md` §Exports).
- Exports are audited with field list, reason, actor and time.
- Exports never contain token values, hashes, or presigned URLs of other assets.

## 7. Reconciliation and integrity checks (planned jobs)

| Check | Frequency | Action on mismatch |
|---|---|---|
| Derived counts vs row counts (`event_daily_stats` vs `attendance_records`) | nightly | alert `ATTENDANCE_STATS_DRIFT`, recompute stats |
| Attendance without a registration and without a walk-in identity | nightly | alert (data integrity bug), block reporting until resolved |
| Registrations in `ATTENDED`-like inconsistency (attendance exists but registration cancelled) | nightly | alert; report shows the record but flags the inconsistency |
| Duplicate-scan rate per event | per event | alert if > 5% (possible token sharing) |
| Manual-correction share | per event | data-quality note in the report (> 10%) |

## 8. Concurrency and integrity guarantees

- One attendance per registration per event — enforced by a unique constraint, not by application
  logic (ADR-0025).
- One attendance per walk-in identity — same mechanism.
- Corrections are serialised on the attendance row (single-row update) and are idempotent by
  `Idempotency-Key`.
- Concurrent `MARK_PRESENT` and QR scan for the same registration: whichever commits first wins;
  the second receives the existing record (`ALREADY_CHECKED_IN` semantics for the QR path, and
  `CONFLICT` for the manual path with a clear message).

## 9. What attendance must never do

1. Never store a "was present" flag on a registration as the source of truth (the attendance
   record is the fact).
2. Never claim precision it does not have: no projected attendance, no "estimated 310" without the
   word estimate, no rounding up.
3. Never derive attendance from notification delivery, page views, or "opened the QR page".
4. Never expose an individual's attendance history to anyone except the organizers of that event
   (and platform admins in an incident/moderation context, audited).
5. Never turn attendance into a public metric of a speaker, mosque or participant (`NFR-ETH-001`).

## 10. Acceptance criteria for this module

1. 500 arrivals across 3 devices produce ≤ 500 attendance records with zero duplicates and a
   complete per-entrance attribution (concurrency + load test).
2. `NO_SHOW` is never displayed before the window closes (UI test).
3. A correction without a reason is rejected; a correction with a reason is visible in the audit
   query (integration test).
4. An export without a reason/role is rejected; an export's file disappears after its retention
   window (retention test).
5. The report labels every number with its definition, and shows a data-quality note when manual
   corrections exceed the threshold (UI assertion).
