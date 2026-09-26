# Offline shell (client)

Not implemented in Phase 0. Where it belongs: a client component (or PWA fallback) used by:

1. `/pendaftaran/[token]` - the participant's QR/short code must render from cache with a
   "terakhir disinkronkan" statement (NFR-MOB-004, ADR-0027). It is acceptable to show a stale code;
   it is never acceptable to imply a check-in succeeded.
2. `/kajian/[id]/check-in` - the console states "belum tercatat" when offline and offers the manual and
   paper paths (`docs/attendance/OFFLINE-EVALUATION.md`).

Rules: no offline attendance writes exist in the MVP (ADR-0007). Offline display is read-only.
Task: T-CHECKIN-009 / T-REG-005.
