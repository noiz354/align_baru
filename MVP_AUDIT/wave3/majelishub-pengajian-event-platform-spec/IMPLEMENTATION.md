# MajelisHub Wave3 IMPLEMENTATION

**Narrow fix:** replace stub `POST /api/v1/events/[eventId]/registrations` and `POST /api/v1/checkin/validate` with real tenant-scoped, idempotent registration and attendance.

## Changed files
- `src/server/db/schema/registrations.ts` — new: `event_registrations` (`id uuid PK uuidv7`, `organization_id FK`, `event_id FK`, `attendee_email text`, `attendee_name text`, `status DEFAULT REGISTERED`, `token_hash unique`, `short_code unique`, `event_id+attendee_email unique`, `created_at/updated_at`) and `event_attendance` (`id uuid PK`, `organization_id FK`, `event_id FK`, `registration_id FK unique`, `checked_in_at`, `checked_in_by`, `created_at`). Indexes on org/event and registration.
- `drizzle/0005_registrations.sql` — generated migration for above, FK cascade, unique indexes `event_registrations_token_hash_unique`, `event_registrations_short_code_unique`, `event_registrations_event_email_unique`, `event_attendance_registration_unique`.
- `src/server/db/schema/index.ts` — barrel now exports `registrations`.
- `src/server/db/repositories/registrations.ts` — new: `hashToken(token)=sha256 hex`, `generateShortCode()=6 alnum XXX-YYY`, `createRegistration(db, {orgId,eventId,email,name})` checks duplicate `eventId+email` → throw `DUPLICATE` with existing, otherwise `randomBytes(32).hex` token, hash, retries shortCode uniqueness, `insert .returning()`. `hashTokenForLookup`, `findRegistrationByTokenHash/ShortCode/Id`, `createAttendanceIfNotExists` checks existing by `registrationId` → returns existing `{created:false}`, else `insert`, `findAttendanceByRegistrationId`, `countAttendancesForEvent`.
- `src/app/api/v1/events/[eventId]/registrations/route.ts` — real: validates `eventId` uuid else 422, parses `{attendeeEmail|contactValue, attendeeName|fullName}`, validates email regex and name 2..80 else 422, looks up `kajian_events` by id else 404 (tenant isolation: unknown event = 404 even cross-org), then `withTransaction(organizationScope(orgId), ...)` → `createRegistration` → `writeAuditEntry(actionKey: registration.create)` → 201 `{registrationId, eventId, orgId, attendeeEmail, attendeeName, accessToken, shortCode, qrPayload}`. Duplicate → 200 `{code: ALREADY_REGISTERED, registrationId existing, shortCode, created:false}` (idempotent).
- `src/app/api/v1/checkin/validate/route.ts` — real: validates `eventId` uuid else 422, requires `token` or `shortCode` else 400 `INVALID_FORMAT`, validates token length ≥8 and hex else 400, shortCode `^[A-Z0-9]{3}-[A-Z0-9]{3}$` else 400, looks up `kajian_events` else 404, hashes token or looks up shortCode, `findRegistrationBy*` → if null 404 `INVALID_TOKEN` (does not disclose existence), if `registration.eventId != eventId` or `registration.organizationId != orgId` → 409 `WRONG_EVENT`, if `status==CANCELLED` → 409 `REGISTRATION_CANCELLED`, then `withTransaction(scope, ...)` → `findAttendanceByRegistrationId` → if exists return 200 `ALREADY_CHECKED_IN` same `attendanceId/checkedInAt`, else `createAttendanceIfNotExists` + `writeAuditEntry(actionKey: attendance.checkin)` → 200 `VALID` `{displayName, checkedInAt, registrationId, attendanceId}`. Unique constraint `event_attendance.registration_unique` guarantees exactly one row even under concurrent duplicate scans.
- `src/app/api/v1/events/[eventId]/checkin/summary/route.ts` — real: validates uuid, looks up event else 404, lists `event_registrations` and `event_attendance` for event → `{totalRegistered, totalCheckedIn, registrations[], attendances[]}`.
- `src/server/audit/writer.ts` — adapted for PGlite dev fallback: `isPGliteDb()` → skips `pg_advisory_xact_lock(hashtextextended(...))` which PGlite lacks; on pg still takes transaction-scoped advisory lock per org and head `FOR UPDATE`, hash chaining unchanged.
- `scripts/pglite-migrate.mjs` — PGlite-only migrator splitting `drizzle/*.sql` by `-->` breakpoint, skipping `CREATE EXTENSION`, `DO $$`, `GRANT/REVOKE/ALTER ROLE/ENABLE RLS/CREATE POLICY`, logging already-exists, ensuring `event_registrations`/`event_attendance` created even though RLS policies skipped.
- `scripts/seed-wave3-majelishub.mjs` — inserts `attendee@majelis.demo.test` (`majelishub-attendee`) and Bandung event `594f4d49-0923-7f65-5fda-35c84014c48c` (Kajian Bandung Demo, org Bandung) for cross-tenant tests, clears previous registrations/attendance for deterministic token `9a7e532...` replay.

## Reused architecture
- `organizations`, `organization_members`, `mosques`, `kajian_events`, `audit_events`, `users` tables (0000-0004), PGlite `pglite:///tmp/majelis-pglite` (Wave2) plus `pglite-migrate.mjs` handling.
- Drizzle `withTransaction` + `organizationScope` (ADR-0017) layered: repo scoped WHERE + RLS backstop on pg, transaction-scoped audit `prev_hash` chaining.
- `writeAuditEntry` hash `sha256(JSON canonical v=1 org, pos, prevHash, action, scope, actor, target, occurredAt)`; positions contiguous.
- No new dependencies beyond existing `drizzle-orm`, `@electric-sql/pglite`, `pg` (audit/migrate).

## Seeded identities
- Jakarta org `594f4d49-4437-7762-5259-01d691fba3c5` slug `majelis-demo-jakarta`, Bandung org `594f4d49-fbab-794b-d259-de7233c666d0`
- Jakarta mosque `594f4d49-9e3d-7166-911a-0bf67baa1d46` Masjid Al Demo, Bandung mosque `594f4d49-9e3d-7166-911a-0bf67baa1d46`? Actually `594f4d49-9e3d-7166-911a-0bf67baa1d46` is Jakarta, Bandung mosque from seed `majelis-demo-bandung` `Masjid Demo Bandung`
- Jakarta event `594f4d49-2b86-7ce8-2999-946bb0e99101` Kajian Akhir Pekan SCHEDULED, Bandung event `594f4d49-0923-7f65-5fda-35c84014c48c` Kajian Bandung Demo SCHEDULED
- Users `majelishub-jakarta-admin` `admin@majelis.demo.test`, `majelishub-jakarta-organizer` `organizer@majelis.demo.test`, `majelishub-bandung-admin` `admin@bandung.demo.test`, `majelishub-attendee` `attendee@majelis.demo.test`
- Runtime seed generated a participant token and short code; raw capability values are intentionally omitted from this evidence file.

## Final security-review additions

- `src/app/api/majelishub/organizations/route.ts` now derives the caller from `getSession()`, uses active memberships, checks `organization.read`, and performs scoped organization reads. It does not accept `userId` from a header or query string.
- `src/app/api/majelishub/organizations/[orgId]/mosques/route.ts` now requires a session, active organization membership, and `mosque.read` before listing tenant data.
- `src/app/api/v1/events/[eventId]/checkin/summary/route.ts` now requires a verified session, active membership, and `attendance.read` before returning attendee details.
- `src/app/api/v1/checkin/validate/route.ts` now requires a verified session, active membership, and `checkin.validate` before reading event/registration state.
- `src/server/auth/session.ts` fails closed under the local PGlite fallback because the Better Auth runtime adapter requires a PostgreSQL pool; it never substitutes a caller-supplied user identity.
- `src/server/auth/public-routes.ts` explicitly lists public guest registration with its event-scoped capability rationale. Check-in and attendee summary are not public.
- `src/server/db/client.ts`, `src/server/db/repositories/registrations.ts`, and the static permission test also contain narrow TypeScript/test-count corrections made during final verification.
- The lockfile was refreshed so `npm ci` can install the current Vitest/esbuild tree; clean install, full test suite, and typecheck were then re-run.

**Implementation commit:** `5f52802 feat(majelishub): secure event registration and check-in routes`.
