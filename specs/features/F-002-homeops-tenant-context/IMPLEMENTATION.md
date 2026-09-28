# F-002 — Implementation plan

Four slices, roughly 3.5 hours. Slices 1–2 are the security fix; 3–4 are cleanup and are droppable
under pressure.

## F-002-S1 — `requireHousehold` (60 min)

`src/server/auth/require-household.ts`:
```ts
export interface HouseholdContext { householdId: string; memberId: string; role: HouseholdRole; }
export async function requireHousehold(req: Request): Promise<HouseholdContext>  // throws AppError
```
Order of operations, and it matters:
1. Read the session cookie. Absent/unknown/expired → `401`.
2. Load the session row → `userId`.
3. Load the **ACTIVE** `household_member` row for that user. None → `401` (the user has no household).
4. Return the context. **Never** read `householdId` from the request at any point.

Reuse `src/server/db/schema/auth.ts` and the existing `household_member` query. Do not introduce a
session abstraction — the table and the pages are already there.

Tests: AC-001, AC-003, AC-004, AC-006.

## F-002-S2 — Rewrite the four routes (60 min)

For each route, in this order:
1. `const ctx = await requireHousehold(request);` — first statement, before any query.
2. Delete every `x-homeops-household` / `?householdId` / `body.householdId` read.
3. Pass `ctx.householdId` into the existing repository call.
4. Replace the raw Drizzle catch with the typed error shape.

`chores/[id]/complete/route.ts` is the largest (it also does recurrence). `rooms/route.ts` is the
smallest and is the right first one to convert — get the pattern right there, then apply it three times.

Tests: AC-002, AC-005, AC-007.

## F-002-S3 — Pages stop forging identity (45 min)

Across the 32 pages: delete the module-level `const HOUSEHOLD_ID = '…'` and the
`headers: { 'x-homeops-household': … }` from every `fetch`. Add the four honest render states
(loading / empty / error / degraded) to the pages that currently render `?? []`.

Test: AC-009.

## F-002-S4 — `authorize` becomes real (45 min)

Implement `authorizeOperation` for the operations the four routes perform, using the role set in
`docs/security/AUTHZ-MATRIX.md`. Enforce last-`OWNER`-cannot-be-removed. Emit to the existing
security-event sink. Route the one operation in these four routes that needs an elevated role
through it; leave the rest declared, with a task id.

Test: AC-008 — a **runtime** spy, not a source scan.

## Verification after each slice
```
npm run typecheck && npm run lint && npm test && npm run build
```
`npm run lint` currently fails with 30 errors, of which 6 are `homeops/boundaries` on these very
routes. Fixing them is part of S2 — the rule wants logic out of `app/**`; at minimum, keep route
handlers thin and move the chore recurrence computation into `src/features/`.

## Do not touch
- The `0001_rooms_chores.sql` journal problem (`F-004`).
- RLS (`F-003`).
- Design tokens. Inline styles are a `F-018` item, not this.
