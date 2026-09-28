# MajelisHub Wave3 RUNTIME_PROOF

## Historical attendee-flow observation

The earlier PGlite run created an attendee registration, returned `VALID` then `ALREADY_CHECKED_IN` for duplicate scans with the same attendance ID, rejected a Jakarta token against a Bandung event with `WRONG_EVENT`, and retained the recorded attendance across restart. That run preceded the final session/permission gates below; it is historical behavior evidence, not proof that the current protected endpoints work unauthenticated.

## Final security-gate regression

Using the persisted PGlite runtime at `pglite:///tmp/majelis-pglite`, requests were sent without a session cookie but with forged `x-majelishub-user: majelishub-jakarta-admin` and/or `?userId=majelishub-jakarta-admin`:

- `GET /api/majelishub/organizations` → `401 UNAUTHENTICATED`.
- `GET /api/majelishub/organizations/:orgId/mosques` → `401 UNAUTHENTICATED`.
- `GET /api/v1/events/:eventId/checkin/summary` → `401 UNAUTHENTICATED` before returning attendee details.
- `POST /api/v1/checkin/validate` → `401 UNAUTHENTICATED` before event/registration lookup.
- The local PGlite adapter has no Better Auth `pg` pool; signup cannot be exercised on this runtime, and `getSession` fails closed rather than trusting user-supplied identity or returning tenant data. A logged-in route-level check-in/summary proof against PostgreSQL remains unverified in this environment.

## Automated checks after authorization changes

- MajelisHub `npm run typecheck` → pass.
- Full `npm test` → **125 passed, 281 todo** across 97 test files (20 passing, 77 skipped).
- Targeted security, isolation, and identity run → **19 passed**.
- Permission static analysis now requires every data route to use `requirePermission` or have an explicit public-route rationale. Guest self-registration remains the only public participant capability; attendee summary and staff check-in are session/permission protected.

No runtime DB, access tokens, or generated placeholder screenshots are included. The previous placeholder images were removed; no actual browser screenshots were captured.