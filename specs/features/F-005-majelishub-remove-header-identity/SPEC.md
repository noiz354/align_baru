# F-005 — majelishub: remove the request-header identity

## User problem
Anyone who knows a user id can act as that user, with no credential of any kind. Measured:
`POST /api/majelishub/organizations/<org>/events` with `x-majelishub-user: organizer-1` and no cookie
passes authentication *and* the `event.write` permission check.

## Actor
Any HTTP client. Victim: an organizer whose id appears in a log line, a URL, or a screenshot.

## Current behavior
Three handlers resolve the caller as:
```ts
const userId = request.headers.get("x-majelishub-user")
            || url.searchParams.get("userId")
            || "majelishub-jakarta-admin";
```
- `src/app/api/majelishub/organizations/[orgId]/events/route.ts` (GET, POST)
- `src/app/api/majelishub/organizations/[orgId]/events/[eventId]/route.ts` (GET)

Their siblings `organizations/route.ts` and `organizations/[orgId]/mosques/route.ts` were already
corrected to use `getSession()`. `MVP_AUDIT/wave3/…/IMPLEMENTATION.md` claims all four were hardened;
only two were.

The static gate passed them because `tests/integration/security/permissions.test.ts` classifies a
route as protected with `source.includes("requirePermission(")`.

## Desired behavior
Every handler resolves the caller through `getSession(request.headers)`, exactly as its siblings do.
A request with no session is `401`. There is no default identity anywhere in the codebase.

## Scope
- The three handlers.
- Replace the string-search route gate with a behavioural one.
- Delete the `x-majelishub-user` demo client (`src/app/dasbor/majelishub-client.tsx`) or convert it to
  use a real session.
- Delete the hardcoded `"majelishub-jakarta-admin"` fallback.

## Explicit non-goals
- Sign-in UI (`T-ORG-004`).
- Fixing the audit-chain `500` that the header path currently trips over. **Important:** that `500` is
  the only reason the bypass does not become a silent write. Fix this feature *before* that `500`.
- The four public pages (`F-006`).
- The test harness (`F-007`).

## User flow
1. Organizer signs in; the session cookie is set by Better Auth.
2. Organizer opens `/dasbor`; the client calls the API with `credentials: 'include'`.
3. The server resolves the session, loads ACTIVE memberships, checks `event.read`/`event.write`.
4. No cookie → `401`, with no tenant read.

## Business rules
- Identity comes from `getSession()` and nowhere else.
- A role is read from `organization_members` on every request, never from the session payload
  (`session.ts` already documents this invariant).
- A caller with no ACTIVE membership in the org gets `404`, not `403`.

## API contract
The two query parameters `userId` and the `x-majelishub-user` header are **removed**. A request that
supplies them is treated as a request with no session.

```
POST /api/majelishub/organizations/<orgId>/events
  no session                        → 401 { error: "Unauthenticated", code: "UNAUTHENTICATED" }
  session, no membership            → 404 { code: "NOT_FOUND" }
  session, membership, no event.write → 403
  session, membership, event.write   → 201
  x-majelishub-user: <any id>, no session → 401   ← was: reached the write path
```

## Data model changes
None.

## Authorization rules
Unchanged. `requirePermission` with `event.read` / `event.write` against `organizationScope(orgId)`.

## Validation rules
The existing `title`/`mosqueId`/`slug` checks stay. `title.length < 3` is suspiciously short for a
real product but is not a security defect; leave it and raise it as a separate question.

## Error behavior
`401` with the project's typed error shape. Never include the caller-supplied id in the response.

## Idempotency / concurrency
**Not delivered in this slice.** `POST .../events` currently accepts a request with no
`Idempotency-Key` and performs the write. ADR-0015 requires idempotency on mutations. Record this as
a known gap in the SPEC rather than pretending it is handled; a follow-up slice adds it.

## UI behavior
`src/app/dasbor/majelishub-client.tsx` cannot function once the header is gone, because
`getSession()` returns `null` under PGlite. Two honest options, and the second is preferred:
1. Keep the client and give it a real sign-in path.
2. **Delete the demo dashboard.** It exists to demonstrate a demo, it renders raw UUIDs and inline
   styles in violation of the project's own "components read tokens, never literals" rule, and its
   green "RLS proof" panel asserts a property the runtime does not have. `PRODUCT.md` lists
   organization dashboard as a *core job*; it will be rebuilt properly in Wave 2 against a real
   session.

Recommendation: delete it now, rebuild it in Wave 2. Carrying a demo UI that only works with a
forged header is how the header survived.

## Observability
Unchanged. `requirePermission` already emits `authorization.denied` with reason class.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None. Root of the majelishub chain.

## Impacted files/modules
- `src/app/api/majelishub/organizations/[orgId]/events/route.ts`
- `src/app/api/majelishub/organizations/[orgId]/events/[eventId]/route.ts`
- `src/app/dasbor/majelishub-client.tsx` (delete) and `src/app/dasbor/page.tsx`
- `tests/integration/security/permissions.test.ts` — replace the string search
- new: `tests/integration/security/identity-comes-from-session.test.ts`
- `README.md:12` ("Still prohibited everywhere: production UI") — becomes true again

## Migration strategy
None. Behavioural change only.

## Rollback considerations
Rolling back re-opens the P0. There is no partial state in which the header is acceptable.
