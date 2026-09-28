# F-002 — Acceptance criteria

## AC-001 — an anonymous caller is refused
Given a running production build and a migrated database, for each of the four data routes:
```
GET  /api/homeops/rooms
GET  /api/homeops/today
GET  /api/homeops/chores
POST /api/homeops/chores/:id/complete
```
with **no cookie**: expect `401`, and expect zero rows read.

## AC-002 — cross-household access is 404, and discloses nothing
```ts
// Given: user U is an ACTIVE member of household A only
// And:   household B exists with rooms
const res = await as(U).get("/api/homeops/rooms?householdId=" + B.id);
expect(res.status).toBe(404);
expect(await res.text()).not.toContain(B.roomName);
```

## AC-003 — a spoofed header is ignored
```ts
const res = await as(U)
  .get("/api/homeops/rooms")
  .set("x-homeops-household", B.id);
expect(res.status).toBe(200);
expect(await res.json()).toMatchObject({ rooms: expect.not.arrayContaining([expect.objectContaining({ householdId: B.id })]) });
```

## AC-004 — the caller's own household works
```ts
const res = await as(memberOfA).get("/api/homeops/rooms");
expect(res.status).toBe(200);
expect((await res.json()).rooms.every(r => r.householdId === A.id)).toBe(true);
```

## AC-005 — a non-member of the requested household cannot act
```ts
// POST /api/homeops/chores/<occurrence owned by B>/complete as a member of A
expect(res.status).toBe(404);
expect(res.body.code).toBe("NOT_FOUND");
```

## AC-006 — a removed member loses access immediately
```ts
// Given U's membership status flips to REMOVED in the same database
// When U requests /api/homeops/today with the same still-valid cookie
// Then 401
```

## AC-007 — no response body leaks internals
```ts
// Force a database error (stop the pool) and call every data route
for (const r of routes) {
  const body = await res.text();
  expect(body).not.toMatch(/select |insert |relation |SELECT |INSERT /i);
  expect(body).not.toMatch(/\.ts:\d+|drizzle-orm|node_modules/);
}
```

## AC-008 — authorization is actually called
```ts
// A behavioural test, not a source scan: spy on authorizeOperation at runtime
// and assert it is invoked for each protected operation.
const spy = vi.spyOn(authModule, "authorizeOperation");
await as(helper).post("/api/homeops/chores/:id/remove-member", …);
expect(spy).toHaveBeenCalled();
```

## AC-009 — no page hardcodes a household id
```bash
grep -rn "x-homeops-household\|594f4d49-3333-3333-3333-333333333333" src/ | grep -v test
# must produce no output
```

## AC-010 — the existing suite still passes
`npm test` (49 unit) stays green, and the previously-skipped integration tier stops skipping once
`F-019` lands.
