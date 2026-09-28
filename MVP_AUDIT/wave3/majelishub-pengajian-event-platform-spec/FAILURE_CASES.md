# MajelisHub Wave3 FAILURE_CASES

## Current session-protection outcomes

With no session cookie, the following current routes return `401 UNAUTHENTICATED` and do not disclose their tenant data:

- `GET /api/majelishub/organizations` — verified against local PGlite.
- `GET /api/majelishub/organizations/:orgId/mosques` — verified against local PGlite.
- `GET /api/v1/events/:eventId/checkin/summary` — verified against local PGlite; attendee rows are not returned.
- `POST /api/v1/checkin/validate` — session gate is enforced before event lookup; positive authorized runtime scan is not reverified because Better Auth's local adapter requires a PostgreSQL pool and this environment uses PGlite.

Organization listing ignores caller-supplied `userId`; it derives identity from `getSession()` and then checks active memberships and `organization.read`. Mosque listing and summary/check-in likewise resolve membership and call the permission matrix. The route does not fabricate a volunteer device binding from request fields, so a `VOLUNTEER` role is denied until a real device/event binding exists. Under the PGlite fallback, Better Auth initialization failure is treated as unauthenticated (fail closed), not as a demo identity.

## Public attendee-registration validation (still current)

- Duplicate email for the same event returns `ALREADY_REGISTERED` with the existing registration ID and does not create a second row.
- Malformed email/short name returns `422 VALIDATION_FAILED`.
- Unknown event returns `404 NOT_FOUND`.

Guest self-registration is explicitly listed in `PUBLIC_ROUTES`; it is event-scoped and does not expose an attendee list.

## Historical check-in failure-path observations

Before the final session gate was added, runtime checks observed duplicate check-in returning `ALREADY_CHECKED_IN` with the same attendance ID, cross-tenant token use returning `WRONG_EVENT`, malformed token returning `INVALID_FORMAT`, and an unknown token returning `INVALID_TOKEN`. Those observations are retained as historical implementation behavior; they are not represented as current authenticated end-to-end proof. See `RUNTIME_PROOF.md` for the limitation.