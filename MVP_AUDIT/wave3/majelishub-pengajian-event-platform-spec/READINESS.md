# MajelisHub Wave3 READINESS

**Project:** `majelishub-pengajian-event-platform-spec`
**Implementation commit:** `5f52802`.
**Wave2:** `RUNNABLE_DEMO` — tenant-scoped org→mosque→event slice.
**Wave3:** `MVP_PARTIAL` — attendee registration and idempotent attendance are implemented; final auth gates are in place, but logged-in route-level verification is still blocked by the local PGlite/Better Auth adapter mismatch.

## Implemented attendee boundary

- Registration stores a token hash and short code; a unique `(event_id, attendee_email)` constraint deduplicates guest self-registration.
- Attendance has a unique registration constraint. Check-in verifies event/organization matching and returns the existing attendance record for duplicate scans.
- Guest self-registration is explicitly classified in `PUBLIC_ROUTES`; it returns only the registrant's capability and does not expose attendee lists.
- Check-in now requires a verified session, active organization membership, and `checkin.validate`; summary requires `attendance.read` before returning attendee details. The handler does not invent a volunteer device binding from caller input, so volunteers remain denied until that separate binding flow exists.
- Organization listing derives the actor from the verified session, ignores request-supplied identity, filters through active memberships, and scopes each organization lookup. Mosque listing is session/membership/`mosque.read` protected.

## Final verification state

- No-session requests to organization list, mosque list, check-in summary, and check-in validation returned `401 UNAUTHENTICATED` in the PGlite runtime, including forged user identity headers/query parameters.
- PGlite's dev DB adapter has no Better Auth `pg` pool. Identity initialization therefore fails closed and the auth sign-up endpoint cannot be exercised in this local runtime. A logged-in staff scan and summary were not re-proven after the final permission gates; the older unauthed run is historical only.
- Final `npm run typecheck` passed; `npm test` reported **125 passed, 281 todo** (20 passing files, 77 skipped). Targeted security/isolation/identity run reported **19 passed**.
- Static permission analysis requires every data route to call `requirePermission` or appear in the reasoned public-route allowlist.

## Readiness boundary

Keep `MVP_PARTIAL`; media/recording, transcripts, feedback, notifications, and exhaustive PostgreSQL RLS/runtime coverage remain outside the attendee slice. No broad admin/upload features were added.

## Evidence

`MVP_AUDIT/wave3/majelishub-pengajian-event-platform-spec/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md}`. No actual browser screenshots were captured; prior deterministic placeholder images were removed.