# MajelisHub Wave3 FAILURE CASES (≥3 verified)

All via `curl` against `http://localhost:3104` after `feat(majelishub): add registration and idempotent event check-in` on PGlite.

## 1. Duplicate registration — idempotent ALREADY_REGISTERED (200)

```bash
curl -s -X POST http://localhost:3104/api/v1/events/594f4d49-2b86-7ce8-2999-946bb0e99101/registrations \
  -d '{"attendeeEmail":"attendee@majelis.demo.test","attendeeName":"Demo Attendee"}'
# → {"code":"ALREADY_REGISTERED","message":"Email ini sudah terdaftar untuk event ini.","registrationId":"01a0e659-1506-7000-9a6c-dd659873083e","eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","organizationId":"594f4d49-4437-7762-5259-01d691fba3c5","attendeeEmail":"attendee@majelis.demo.test","state":"REGISTERED","created":false,"shortCode":"3TZ-KJ2"} 200
```

Duplicate email for same `eventId` does not create second `event_registrations` row (`unique(event_id,attendee_email)`); returns existing `registrationId` and `shortCode`, `created:false`.

## 2. Malformed registration — VALIDATION_FAILED (422)

```bash
curl -s -X POST http://localhost:3104/api/v1/events/594f4d49-2b86-7ce8-2999-946bb0e99101/registrations \
  -d '{"attendeeEmail":"not-an-email","attendeeName":"X"}'
# → {"code":"VALIDATION_FAILED","message":"Data registrasi belum benar.","fields":{"attendeeEmail":"email tidak valid","attendeeName":"nama minimal 2 huruf"}} 422
```

Bad email and short name rejected; no row created.

## 3. Unknown event — NOT_FOUND (404)

```bash
curl -s -X POST http://localhost:3104/api/v1/events/00000000-0000-7000-8000-000000000000/registrations \
  -d '{"attendeeEmail":"test@test.test","attendeeName":"Test User"}'
# → {"code":"NOT_FOUND","message":"Event tidak ditemukan."} 404

curl -s -X POST http://localhost:3104/api/v1/checkin/validate \
  -d '{"eventId":"00000000-0000-7000-8000-000000000000","token":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"}'
# → {"code":"NOT_FOUND","message":"Event tidak ditemukan."} 404
```

Cross-tenant event lookup fails closed (ADR-0017).

## 4. Duplicate check-in — ALREADY_CHECKED_IN idempotent (200) not duplicate row

Second scan with same token:

```bash
curl -s -X POST http://localhost:3104/api/v1/checkin/validate \
  -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","token":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"}'
# 1st → VALID attendanceId 01a0e659-22cc-7fff-a0c6-4201fe2a17b1 200
# 2nd → {"kind":"ALREADY_CHECKED_IN","code":"ALREADY_CHECKED_IN","message":"Peserta sudah check-in sebelumnya.","checkedInAt":"2026-09-28T04:49:56.398Z","attendanceId":"01a0e659-22cc-7fff-a0c6-4201fe2a17b1"} 200
GET /checkin/summary → totalCheckedIn stays 1
```

Unique `event_attendance.registration_unique` prevents second row; concurrency would hit same path and return existing.

## 5. Cross-tenant token — WRONG_EVENT (409)

Jakarta token used on Bandung event:

```bash
curl -s -X POST http://localhost:3104/api/v1/checkin/validate \
  -d '{"eventId":"594f4d49-0923-7f65-5fda-35c84014c48c","token":"9a7e53200003f8de632b613574ed864726696377451f4d6b6907a534a16cbf15"}'
# → {"code":"WRONG_EVENT","message":"Token ini bukan untuk event ini."} 409
```

Tenant/org mismatch rejected; does not reveal whether token exists elsewhere.

## 6. Malformed token/shortCode — INVALID_FORMAT (400)

```bash
curl -s -X POST http://localhost:3104/api/v1/checkin/validate -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","token":"short"}'
# → {"code":"INVALID_FORMAT","message":"Format token tidak valid.","fields":{"token":"terlalu pendek"}} 400

curl -s -X POST ... -d '{"eventId":"...","shortCode":"BAD"}'
# → {"code":"INVALID_FORMAT","message":"Format short code tidak valid (contoh: ABC-123).","fields":{"shortCode":"format salah"}} 400

curl -s -X POST ... -d '{"eventId":"...","token":"gggggggg... (non-hex)"}'
# → INVALID_FORMAT harus hex 400
```

## 7. Unknown token — INVALID_TOKEN (404) not 500

```bash
curl -s -X POST http://localhost:3104/api/v1/checkin/validate \
  -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101","token":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}'
# → {"code":"INVALID_TOKEN","message":"Token tidak valid atau sudah tidak berlaku."} 404
```

Lookup hashes token before disclosing; no stack leak.

## 8. Missing capability — INVALID_FORMAT when neither token nor shortCode supplied

```bash
curl -s -X POST http://localhost:3104/api/v1/checkin/validate -d '{"eventId":"594f4d49-2b86-7ce8-2999-946bb0e99101"}'
# → {"code":"INVALID_FORMAT","message":"Token atau short code harus diisi.","fields":{"token":"wajib"}} 400
```
