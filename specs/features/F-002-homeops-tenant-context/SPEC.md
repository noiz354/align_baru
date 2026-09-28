# F-002 — homeops: tenant context derived from the session (stop the ?householdId= bypass)

## User problem
A household's private data is served to anyone who knows or guesses its id. Verified: with no cookie
and no session, `GET /api/homeops/rooms?householdId=<any>` returns that household's rooms with `200`.

## Actor
Any HTTP client. Victim: a household member.

## Current behavior
All four data routes take the tenant from caller input:
```
rooms/route.ts:7               req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId')
today/route.ts:7               identical
chores/route.ts:8 and :19      identical, plus body.householdId
chores/[id]/complete/route.ts:15  three sources, first non-null wins
```
`src/server/auth/authorize.ts` throws `Not implemented: T-AUTH-005` and has **zero** importers
(`grep -rn "authorize" src/app/api` → nothing). `SECURITY.md:12` P-1 and P-2 both state the opposite
of what the code does.

## Desired behavior
One helper, `requireHousehold(request)`, resolves the session cookie → session row → membership →
`{ householdId, memberId, role }`. Every data route calls it. No route reads a tenant id from
caller input. A household that is not the caller's returns `404` without disclosing existence.

## Scope
- New `src/server/auth/require-household.ts`.
- Rewrite the four data routes to call it; delete every header/query/body tenant fallback.
- `authorize.ts`: implement the role check it declares, for the operations that need one.
- Add behavioural tests for isolation (the class that does not exist today).
- `SECURITY.md` P-1/P-2 updated in the same change.

## Explicit non-goals
- Sign-in UI (pages exist and work — this is about wiring them to the data layer).
- RLS. That is `F-003`, which depends on this.
- Repairing `migrations/0001` — that is `F-004`. **Note: until F-004 lands, the routes will still
  `500` on a properly migrated database. That is expected and is the correct failure.**

## User flow
1. Member signs in at `/sign-in`; the server sets an `HttpOnly` session cookie.
2. Member opens `/today`.
3. The page calls `/api/homeops/today` with no tenant parameter.
4. The server resolves the session, verifies ACTIVE membership, and returns that household's chores.

## Business rules
- A tenant id is never read from a request.
- Membership must be `ACTIVE`; `INVITED`/`REMOVED` are not access.
- A cross-household request is `404`, never `403` (existence privacy, matching majelishub's rule).
- A missing or invalid session is `401` and reads no tenant row.

## API contract
No endpoint paths change. The **request shape** changes: `householdId` is no longer accepted and must
be ignored if present. Responses keep their current shape.

```
GET /api/homeops/today
  no cookie                       → 401 UNAUTHENTICATED
  valid cookie, member of A       → 200 { items: [...] }  (A's chores only)
  valid cookie, member of A, ?householdId=B → 200 with A's chores (B ignored)
  valid cookie, not a member      → 404 NOT_FOUND
```

## Data model changes
None. `session`, `account`, `verification`, `household_member` already exist and are populated by the
existing auth pages.

## Authorization rules
`authorizeOperation(ctx, operation, target)` becomes real for the operations the four routes perform.
`HOUSEHOLD_MEMBER` may read their own household; `HELPER` additionally may not remove members or
change roles; the last `OWNER` cannot be removed. Denials emit the existing security-event sink with
ids and outcome only — never content.

## Validation rules
Household/member ids must be UUIDs. A malformed id in the *path* is `422`; a malformed id in a query
parameter is ignored entirely (it is not an input any more).

## Error behavior
`401` / `404` / `403` / `422` through one typed error shape. **Never** a raw Drizzle error: the room
route currently returns the full SQL text and bound parameters in the response body.

## Idempotency / concurrency
Out of scope. `POST /chores/:id/complete` gains a membership check only.

## UI behavior
- Delete `const HOUSEHOLD_ID = '…'` from every page and the `x-homeops-household` header from every
  `fetch`.
- Render the four honest states the spec already requires: loading, empty, error, degraded. In
  particular an error must not render as an empty list.

## Observability
`auth.context.resolved` (memberId, role), `auth.context.rejected` (reason class). Inside the existing
allow-list; no household content.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None for the API half. `F-003` (RLS) depends on this. `F-004` (migration journal) is independent.

## Impacted files/modules
- new: `src/server/auth/require-household.ts`
- `src/server/auth/authorize.ts`
- `src/app/api/homeops/rooms/route.ts`
- `src/app/api/homeops/today/route.ts`
- `src/app/api/homeops/chores/route.ts`
- `src/app/api/homeops/chores/[id]/complete/route.ts`
- 32 page files (remove the hardcoded id and the header)
- `SECURITY.md` P-1, P-2
- new: `tests/integration/security/household-isolation.test.ts`

## Migration strategy
None. Behavioural change only; no schema change.

## Rollback considerations
Rolling back re-opens the P0 immediately. If a partial rollback is needed, keep the removal of the
header/query fallbacks even if `authorize` is temporarily stubbed — the header is the hole, the role
check is the refinement.
