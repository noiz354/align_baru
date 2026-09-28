# F-001 — siomayops: real session resolution (remove the production fake-auth default)

## User problem
Nobody can be told apart from anybody else. An unauthenticated client can create business records
and read the audit log, so the operator cannot trust a single number the system reports.

## Actor
Stall operator · Area supervisor · HQ finance. All 78 route handlers.

## Current behavior
`src/server/auth/port.ts:44-52`:
```ts
if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") throw …
const role = (process.env.FAKE_AUTH_ROLE as Role) || "HQ_OPS";
```
The guard fires only when the opt-in flag is ON. In production with the flag unset — the normal case —
`resolveSession()` returns a full `HQ_OPS` session to every caller. Verified: `GET /api/v1/sales` → 200,
`GET /api/v1/audit` → 200 with rows, `POST /api/v1/incidents` → 201.

## Desired behavior
`resolveSession()` returns a session derived from a verifiable credential, or `null`. The 78 call
sites' `if (!session) return 401` branches become reachable. The permission matrix in the same file
is correct and must keep working unchanged.

## Scope
- Invert and harden the guard so production cannot fall through to a default identity.
- Introduce a real session lookup behind the existing `AuthPort` interface.
- Provide a local development path that is explicit, opt-in, and loud in logs.
- Add the missing regression test class (unauthenticated → 401) for every mutating route.

## Explicit non-goals
OTP/SMS delivery, SSO, refresh-token rotation, MFA, device management. `AuthPort` already declares
`issueOtpChallenge`/`verifyOtpChallenge`/`revokeSession`/`revokeDevice`; this slice implements
`resolveSession` honestly and leaves the rest as explicit `NotImplemented` throws with a task id.

## User flow
1. Operator signs in (existing `/shift` and `/operator` pages; a real sign-in UI is a later slice).
2. The server issues an `HttpOnly` `SameSite=Lax` session cookie backed by a row.
3. Every request resolves the session from the cookie.
4. No cookie → `401`, with no tenant read.

## Business rules
- An unauthenticated request may never reach a repository.
- A development identity must be impossible to enable in production, even with the flag set.

## API contract
No new endpoints in this slice. `resolveSession(): Promise<SessionContext | null>` keeps its
signature; the `AuthPort` interface is unchanged.

## Data model changes
None in this slice. `F-010` introduces persistence. Session storage reuses whatever the provider
needs; if a table is required, it goes in a new migration with a journal entry.

## Authorization rules
Unchanged. `authorize(session, action, scope)` and `ROLE_PERMISSIONS` are already correct and are the
consumer of the session this feature produces.

## Validation rules
Cookie present and well-formed; otherwise `null`. No exception on malformed input — a bad cookie is
`null`, not a `500`.

## Error behavior
`401 UNAUTHENTICATED` with the standard `{error:{code,message,requestId,retryable}}` shape.
Never include session or credential material in the message.

## Idempotency / concurrency
Out of scope here; `F-009` makes the key required. A read must not create or mutate a session row.

## UI behavior
Unchanged in this slice. The development identity switch already present in the demo surfaces is
removed from any production build.

## Observability
Log `auth.session.resolved` with the actor id and role, and `auth.session.rejected` with a reason
class only. Both inside the existing allow-list; no token, no cookie value.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None. This is the root of the siomayops chain.

## Impacted files/modules
- `src/server/auth/port.ts` (guard + provider selection)
- `src/server/auth/fake-provider.ts` (isolate the dev-only path)
- `src/server/auth/index.ts` (export selection)
- `src/app/api/v1/_helpers.ts` (unchanged shape; verify)
- new: `tests/security/unauthenticated.test.ts`
- new: one migration for the session table, registered in the journal

## Migration strategy
Additive. New table only. No existing row is rewritten. A deploy with the migration applied and the
old code running is safe: the old code ignores the table.

## Rollback considerations
Reverting the provider swap re-opens the P0. Rollback must keep the *guard* change, which is
independent of the provider. Land the guard first, as its own commit.
