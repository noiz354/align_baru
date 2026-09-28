# MajelisHub Wave3 RUNTIME PROOF

**DB:** `pglite:///tmp/majelis-pglite` (`/tmp/majelis-pglite` FS) — `isPgliteDb()` dev fallback, RLS session variables skipped, advisory lock skipped, otherwise pg path intact.
**Server:** `npm run dev -- --port 3104 --hostname 0.0.0.0` PID 3311 → killed → PID 3472 `Ready 486ms` (proper restart, not npm wrapper).
**Env:** `DATABASE_URL=pglite:///tmp/majelis-pglite BETTER_AUTH_SECRET=f39b6001e... NODE_ENV=development RATE_LIMIT_STORE=memory`

## Happy path

```bash
JAKARTA_EVENT=594f4d49-2b86-7ce8-2999-946bb0e99101
BANDUNG_EVENT=594f4d49-0923-7f65-5fda-35c84014c48c

# 1. Register Jakarta attendee
curl -s -X POST http://localhost:3104/api/v1/events/$JAKARTA_EVENT/registrations \
  -H "Content-Type: application/json" \
  -d '{"attendeeEmail":"attendee@majelis.demo.test","attendeeName":"Demo Attendee"}'
# → {"registrationId":"01a0e659-1506-7000-9a6c-dd659873083e","eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","organizationId":"594f4d49-4437-7762-5259-01d691fba3c5","attendeeEmail":"attendee@majelis.demo.test","attendeeName":"Demo Attendee","accessToken":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15","shortCode":"3TZ-KJ2","state":"REGISTERED","created":true,"qrPayload":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"} 201

# 2. Register attendee2 distinct token
curl ... -d '{"attendeeEmail":"attendee2@majelis.demo.test","attendeeName":"Attendee Two"}'
# → {"registrationId":"01a0e659-15e4-7000-aa58-df314d387a04","accessToken":"367c8272ee831bb228a50dfb993730636eeb49cf1578a9703402c31d6d192a64","shortCode":"V98-CPT","created":true} 201

# 3. Check-in first time VALID
curl -s -X POST http://localhost:3104/api/v1/checkin/validate \
  -H "Content-Type: application/json" \
  -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","token":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"}'
# → {"kind":"VALID","code":"VALID","message":"Check-in berhasil.","displayName":"Demo Attendee","groupSize":1,"checkedInAt":"2026-09-28T04:49:56.398Z","registrationId":"01a0e659-1506-7000-9a6c-dd659873083e","attendanceId":"01a0e659-22cc-7fff-a0c6-4201fe2a17b1"} 200

# 4. Duplicate scan same token ALREADY_CHECKED_IN (idempotent)
curl ... same body
# → {"kind":"ALREADY_CHECKED_IN","code":"ALREADY_CHECKED_IN","message":"Peserta sudah check-in sebelumnya.","displayName":"Demo Attendee","checkedInAt":"2026-09-28T04:49:56.398Z","registrationId":"01a0e659-1506-7000-9a6c-dd659873083e","attendanceId":"01a0e659-22cc-7fff-a0c6-4201fe2a17b1"} 200 (same attendanceId)

# 5. ShortCode duplicate also ALREADY
curl -s -X POST http://localhost:3104/api/v1/checkin/validate -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","shortCode":"3TZ-KJ2"}'
# → ALREADY_CHECKED_IN same attendanceId

# 6. Summary after duplicate scans still exactly one attendance
curl -s http://localhost:3104/api/v1/events/594f4d49-2b86-7ce8-2999-946bb0e99101/checkin/summary
# → {"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","organizationId":"594f4d49-4437-7762-5259-01d691fba3c5","totalRegistered":2,"totalCheckedIn":1,"registrations":[...],"attendances":[{"id":"01a0e659-22cc-7fff-a0c6-4201fe2a17b1","registrationId":"01a0e659-1506-7000-9a6c-dd659873083e","checkedInAt":"2026-09-28T04:49:56.398Z"}]}
```

## Restart durability

Killed PID 3311 → `SELECT pg_advisory_xact_lock` path skipped on PGlite, PGlite FS preserved. Restart `npm run dev --port 3104` PID 3472 Ready 486ms:

```bash
curl -s http://localhost:3104/api/v1/events/594f4d49-2b86-7ce8-2999-946bb0e99101/checkin/summary
# → same totalRegistered 2 totalCheckedIn 1, registrations include 01a0e659-1506..., attendances include 01a0e659-22cc...

curl -s -X POST http://localhost:3104/api/v1/checkin/validate -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","token":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"}'
# → ALREADY_CHECKED_IN same attendanceId (not new row)
```

Direct PGlite query:

```
PGlite('/tmp/majelis-pglite').query("SELECT chain_position, action_key, hash FROM audit_events WHERE organization_id='594f4d49-4437-7762-5259-01d691fba3c5' ORDER BY chain_position")
→ 1 event.write b1da4c47...
  2 registration.create 440d80c5... prev b1da...
  3 registration.create d8d2c81f... prev 440d...
  4 attendance.checkin 6d851d92... prev d8d2...
```

Token stored as `token_hash = sha256('9a7e532...') = hex` (64), never plain; shortCode stored, index unique.

## Tenant isolation

Bandung event `594f4d49-0923-7f65-5fda-35c84014c48c` belongs to `594f4d49-fbab-794b-d259-de7233c666d0` distinct from Jakarta org.

- Jakarta token validated against Bandung event returns `WRONG_EVENT` 409 (not 404 leak).
- Bandung registrations for same email independent (unique per eventId+email).
