# F-008 — manga: close the admin authorization boundary before the first admin write

## User problem
The editorial admin surface is open to anyone on the internet. Today it only shows structure, because
no admin write exists yet. The first person to implement "upload a chapter" will inherit a page that
renders for everyone, and that is how a publishing pipeline gets exposed.

## Actor
Content administrator (legitimate). Anyone with a browser (currently, also illegitimate).

## Current behavior
Five pages under `src/app/admin/**`:
`page.tsx`, `manga/page.tsx`, `manga/[id]/page.tsx`, `manga/[id]/chapters/page.tsx`,
`uploads/page.tsx`.

`grep -rln "auth\|session\|role" src/app/admin/` matches one file, and only on the word "role" in
unrelated copy. `src/app/admin/page.tsx` is a plain `export default function` with no check.

Verified on a production build:
```
GET /admin        (no cookie)  → 200, body contains "Admin Portal" / "Catalog Management"
GET /admin/manga   (no cookie)  → 200
```

There are **no admin mutation endpoints** yet (`find src/app -path '*admin*' -name route.ts` → nothing),
so the current blast radius is disclosure of editorial structure, not content tampering.

`README.md:6` states this correctly — *"authorization is not enforced on admin routes"* — and is the only
project document in the workspace that volunteers a security gap about itself. Keep that honesty; the
code should catch up to it.

## Desired behavior
Every `/admin/**` page and any future admin route requires a session with an admin or editor role, and
refuses otherwise with `401` (no session) or `403` (wrong role). The check is server-side and shared.

## Scope
- One `requireAdmin()` helper, mirroring the shape that already works in
  `src/app/api/v1/progress/route.ts` (`getSessionUser` + explicit 401).
- Guard all five pages.
- Extend `getSessionUser` with a role check, or add `requireRole` beside it.
- Add the unauthenticated-admin regression test.
- Move sessions out of memory so the check is meaningful across a deploy (`F-017`; note the dependency
  direction below).

## Explicit non-goals
- The upload pipeline, image processing, moderation workflow, or any admin write API. Those are
  Wave 2 and must not start before this lands.
- The design system.
- Migrating progress to PostgreSQL (`F-017`).

## User flow
1. Administrator signs in at the existing login route.
2. `/admin` renders for that session.
3. An anonymous visitor gets `401`; a signed-in reader without an admin role gets `403`.
4. An admin navigates to the catalog and sees the real structure.

## Business rules
- Absence of a session is `401`; presence without the role is `403`. Both are server-side.
- The role comes from the stored user record, never from a query parameter or a client-held flag.
- No admin page may be linked from public navigation while it is unguarded.

## API contract
No API change. Page routes keep their paths and return `401`/`403` instead of `200`.

```
GET /admin        no session           → 401
GET /admin        session, role=reader → 403
GET /admin        session, role=admin  → 200
```

## Data model changes
None. `db.getUserById` already returns a `role`.

## Authorization rules
`requireAdmin()` = session valid **and** `role ∈ {admin, editor}`. Single function, no per-page
variation, so the check cannot be forgotten on the fifth page.

## Validation rules
n/a.

## Error behavior
Reuse the project's existing shape: `NextResponse.json({ code: "AUTH_REQUIRED" | "FORBIDDEN", message })`.
Never redirect an unauthenticated visitor to the admin page after login — that preserves the
escalation. A `notFound()` for the whole `/admin` subtree when the caller is unauthenticated is
acceptable and arguably better (no existence disclosure); pick one and state it in the implementation
notes.

## Idempotency / concurrency
n/a.

## UI behavior
Show an honest "sign in to continue" state for `401`, and a "you do not have access" state for `403`.
Neither may render the admin markup first and hide it client-side.

## Observability
`auth.admin.denied` with the session id and the role found — ids and outcome only, no content.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None for correctness. **Note the honest limitation:** sessions are in-memory today, so after a deploy
every administrator is signed out and must sign in again. That is a usability wrinkle, not a security
hole — the check is still enforced on every request. `F-017` fixes the durability.

## Impacted files/modules
- new: `src/server/auth/require-admin.ts`
- `src/server/auth/guard.ts` (add the role check)
- 5 files under `src/app/admin/**`
- new: `tests/integration/auth/admin-boundary.test.ts`
- `src/app/admin/README.md` — a note that the boundary is enforced and must not be bypassed
- `SECURITY.md` — add the admin-surface rule

## Migration strategy
None.

## Rollback considerations
None acceptable. This feature has no non-guarded intermediate state; land it in one change.
