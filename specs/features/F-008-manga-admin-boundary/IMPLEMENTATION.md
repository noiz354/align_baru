# F-008 — Implementation plan

Two slices, roughly 90 minutes. Cheap now; expensive later.

## F-008-S1 — `requireAdmin` and the five pages (45 min)

1. `src/server/auth/guard.ts` already exports `getSessionUser` and `requireUser`. Add:
   ```ts
   export type Role = "reader" | "editor" | "admin";
   export function requireRole(req: Request, roles: Role[]): { id: string; role: Role } {
     const u = getSessionUser(req);
     if (!u) throw Object.assign(new Error("AUTH_REQUIRED"), { status: 401, code: "AUTH_REQUIRED" });
     if (!roles.includes(u.role as Role))
       throw Object.assign(new Error("FORBIDDEN"), { status: 403, code: "FORBIDDEN" });
     return u as { id: string; role: Role };
   }
   ```
   Reuse the exact throw shape `requireUser` already uses, so `progress/route.ts`'s existing
   `catch` on `err.code === "AUTH_REQUIRED"` keeps working. **Do not** create a second error shape.
2. `src/server/auth/require-admin.ts` — `requireAdmin(req) = requireRole(req, ["admin","editor"])`.
3. Guard all five pages. These are server components, so the check is a plain call at the top of each;
   there is no client bundle to leak through.
4. Add a `not-found.tsx` under `src/app/admin/` if you choose the non-disclosure route. **Decide once**
   and apply to all five — a mix of `401` and `404` across the subtree is worse than either.
5. `tests/integration/auth/admin-boundary.test.ts` with AC-001…AC-005, AC-007.

## F-008-S2 — Make the boundary un-bypassable by the next page (45 min)

1. Add `src/app/admin/README.md`: the subtree is guarded, `requireAdmin` is mandatory on any new page
   or route added here, and no admin write may be implemented without the guard in the same change.
2. Add the AC-006 source assertion to the test suite so a sixth unguarded page fails the build.
3. Add an entry to `SECURITY.md`: *an administrative surface refuses an unauthenticated and a
   non-privileged caller*, with a pointer to this spec.
4. Remove any link to `/admin` from public navigation while it is guarded and the write path does not
   exist — a visible admin portal with nothing to do is both a dead end and an invitation to probe.

## Verification
```
npm run typecheck && npm test && npm run build
curl -s -o /dev/null -w '%{http_code}\n' localhost:3110/admin
```

## Do not touch
- Any admin page's content or layout. This is a guard, not a redesign.
- The upload pipeline, the catalog writer, or moderation. Wave 2, after this lands.
- `src/server/db/store.ts`. Session durability is `F-017`.
