# F-005 — Implementation plan

Two slices, roughly 2 hours. The first is the security fix; the second removes the demo that made it
necessary.

## F-005-S1 — Delete the header identity (45 min)

1. `src/app/api/majelishub/organizations/[orgId]/events/route.ts`:
   ```ts
   // before
   const userId = request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin";
   const membership = await findActiveMembership(db, userId, orgId);
   // after
   const session = await getSession(request.headers);
   if (!session) return Response.json({ error: "Unauthenticated", code: "UNAUTHENTICATED" }, { status: 401 });
   const membership = await findActiveMembership(db, session.userId, orgId);
   ```
   Copy the exact shape from `src/app/api/majelishub/organizations/route.ts`, which is already
   correct. Do not invent a new one.
2. Same in `.../events/[eventId]/route.ts` (GET).
3. The `POST` handler also has a comment `// Rate-limit: simple — for PGlite dev, just allow`. Leave
   it, but it is now plainly a lie next to a real session. Replace with an explicit
   `// TODO(T-REG-009): durable rate limit` so the next reader is not misled.
4. Add `tests/integration/security/identity-comes-from-session.test.ts` with AC-001…AC-005.

**Order matters:** land this before anyone fixes the audit-chain `500`.

## F-005-S2 — Remove the demo client and fix the gate (75 min)

1. `git rm src/app/dasbor/majelishub-client.tsx`; reduce `src/app/dasbor/page.tsx` to a shell with a
   `TODO(T-ORG-004)` marker, matching the convention every other shell page in this project uses.
2. `tests/integration/security/permissions.test.ts`:
   - delete `expect(routeFiles.length).toBe(30)` and `expect(stubs.length).toBe(21)` (AC-007);
   - replace the `classifyRoute` string heuristic with a behavioural check (AC-006). If a behavioural
     check is not feasible in this slice, **delete the static test** and open a task — do not leave a
     gate that provably cannot detect the defect it was written for;
   - keep the `PUBLIC_ROUTES` integrity assertions (every entry has a handler and a reason) — those
     are correct and valuable.
3. Delete the now-unused seed identities `majelishub-jakarta-admin` / `-organizer` from
   `scripts/seed-wave2-majelishub.mjs`, or rename them to make clear they are seed data, not
   fallbacks. **They must not remain as string literals in `src/`.**

## Verification
```
npm run typecheck && npm run lint && npm test && npm run build
INTEGRATION_DATABASE_URL=… npx vitest run --project integration tests/integration/security/    # all green
```
Then re-run the AC-005 manual block and confirm `401`.

## Do not touch
- `src/app/api/majelishub/organizations/route.ts` and `.../mosques/route.ts` — they are the template
  and are already correct.
- The four public pages (`F-006`).
- `permissions.ts` — the matrix is correct.
