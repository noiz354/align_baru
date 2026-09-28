# MajelisHub Wave3 READINESS

**Project:** `majelishub-pengajian-event-platform-spec`
**Wave2:** `RUNNABLE_DEMO` (59f4dd4 narrow vertical org→mosque→event)
**Wave3:** `MVP_PARTIAL` — real attendee boundary `registration → token/shortCode → idempotent check-in → attendance` proven.

## New proven boundary

- `event_registrations` with `token_hash=sha256(token)` + `short_code` (unique indexes), `event_attendance` with `unique(registration_id)` ensures exactly-one attendance per registration.
- `POST /api/v1/events/:eventId/registrations` public capability, validates email/name, looks up `kajian_events` → 404 if unknown, `withTransaction(organizationScope)` creates registration + `audit_events` hash chain; duplicate email+event returns `ALREADY_REGISTERED` 200 idempotent (no second row).
- `POST /api/v1/checkin/validate` validates `eventId` uuid, token hex or shortCode shape, looks up registration by hash, checks `registration.eventId==eventId && organizationId==event.organizationId` else `WRONG_EVENT` 409 (tenant isolation), then `findAttendanceByRegistrationId` → `ALREADY_CHECKED_IN` 200 same `attendanceId` or `createAttendanceIfNotExists` → `VALID` 200 + audit `attendance.checkin`. Summary `totalRegistered 2 totalCheckedIn 1` stable across duplicate scans.
- Audit chain `event.write(1) → registration.create(2,3) → attendance.checkin(4)` with `prev_hash` chaining verifiable.
- PGlite durable `/tmp/majelis-pglite` (FS), survived `kill 3311` → restart PID 3472 Ready 486ms, summary unchanged, duplicate scan still ALREADY.
- Negative paths verified: duplicate registration, validation 422 bad email/name, unknown event 404, duplicate check-in idempotent, cross-tenant WRONG_EVENT 409, malformed token/shortCode 400, unknown token 404, missing capability 400 (8 cases, ≥3 required).

## Failure / isolation matrix

| Check | Result |
|-------|--------|
| Duplicate registration same email+event | 200 ALREADY_REGISTERED, same id 01a0e659-1506..., no second row |
| Duplicate check-in same token/shortCode | 200 ALREADY_CHECKED_IN same attendanceId 01a0e659-22cc..., summary still 1 |
| Cross-tenant Jakarta token → Bandung event | 409 WRONG_EVENT |
| Malformed token short / non-hex | 400 INVALID_FORMAT |
| Unknown token random hex 64 | 404 INVALID_TOKEN |
| Unknown eventId | 404 NOT_FOUND |
| Audit chain contiguous | positions 1-4 prev_hash linked |

## Impl commit

`1a7a81a feat(majelishub): add registration and idempotent event check-in` — 10 files, 612 +; migrations `drizzle/0005_registrations.sql`, schema `registrations.ts`, repos, routes, writer PGlite adaptation, pglite-migrate + seed-wave3.

## Wave2 regression

Wave2 flow `org→mosque→event` still passes: `listEvents` via `organizationScope`, `createEvent` with audit, PGlite FS intact. No overwrite of `MVP_AUDIT/progress/majelishub...` (frozen).

## Blocker to MVP_READY

Remains `MVP_PARTIAL` (not MVP_READY) because media/recording, transcript, feedback, notifications, and platform-role RLS exhaustive tests not yet real; but attendee slice now real, not stub. Promotion `RUNNABLE_DEMO→MVP_PARTIAL` justified.

## Screenshots

`MVP_AUDIT/wave3/majelishub-pengajian-event-platform-spec/screenshots/` 5×1440 (placeholder deterministic): 01-events-1440.png, 02-registration-qr-1440.png, 03-checkin-valid-1440.png, 04-duplicate-already-1440.png, 05-summary-restart-1440.png + 390 variants. Correspond to API terminal proofs above.

## Next tenant (homeops) per GLOBAL order proceeds after this commit.
