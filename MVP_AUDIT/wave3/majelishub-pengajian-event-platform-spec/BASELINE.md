# MajelisHub Wave3 BASELINE (d5f0974)

**Wave2 state:** `RUNNABLE_DEMO` (feat majelishub narrow vertical org→mosque→event with PGlite+RLS+audit `59f4dd4`)

**Demo boundary at baseline:** attendee registration and check-in were stub shells (`Not implemented: T-REG-001`, `T-CHECKIN-001`). No `event_registrations`/`event_attendance` tables, no token capability, no idempotency guard, no cross-organization rejection, no audit chain for attendance. Event creation worked but participant flow stopped at stub.

**Wave3 target:** `RUNNABLE_DEMO → MVP_PARTIAL` via one real boundary: `registration → QR/token → idempotent check-in → attendance` with tenant isolation.

**Frozen evidence:** `MVP_AUDIT/progress/majelishub-pengajian-event-platform-spec/` (before/after 07 screenshots, pglite:///tmp/majelishub-pglite at baseline, now pglite:///tmp/majelis-pglite).

**Commit:** `59f4dd4` baseline, `d5f0974` WAVE3 lock.
