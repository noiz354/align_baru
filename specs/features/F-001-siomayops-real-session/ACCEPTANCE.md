# F-001 — Acceptance criteria

Every criterion is executable. `A1`–`A4` are the regression tests that must exist before the change
is considered done; `A5`–`A8` are the security assertions whose absence let this defect reach `main`.

## AC-001 — production cannot obtain a default identity
```ts
process.env.NODE_ENV = "production";
delete process.env.ALLOW_FAKE_AUTH;
const session = await createAuthPort().resolveSession();
expect(session).toBeNull();
```

## AC-002 — the flag cannot re-enable fake auth in production
```ts
process.env.NODE_ENV = "production";
process.env.ALLOW_FAKE_AUTH = "true";
await expect(createAuthPort().resolveSession()).rejects.toThrow();
```

## AC-003 — development identity is opt-in and explicit
```ts
process.env.NODE_ENV = "development";
delete process.env.DEV_AUTH_ROLE;
expect(await createAuthPort().resolveSession()).toBeNull();
process.env.DEV_AUTH_ROLE = "OPERATOR";
expect((await createAuthPort().resolveSession())?.roles).toEqual(["OPERATOR"]);
```

## AC-004 — a valid session resolves and carries the declared scope
```ts
// Given a session row for user U in organization O
// When a request carries U's cookie
// Then resolveSession() returns { userId: U, organizationId: O, roles, scope }
// And the scope kind is "self" for OPERATOR and "org" for HQ_OPS
```

## AC-005 — every mutating route refuses an anonymous caller
For each route in `GET`-excluded handlers under `src/app/api/v1/**`, executed as a running
production build with **no cookie**:
```ts
const res = await request(route, validBody, { cookie: undefined });
expect(res.status).toBe(401);
expect(await res.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
```
Minimum set that failed before this change: `POST /incidents`, `POST /sales`,
`POST /payments/cash`, `POST /expenses`, `POST /loyalty/rewards/:id/redeem`.

## AC-006 — a read route refuses an anonymous caller and reads no tenant row
```ts
const res = await fetch(`${base}/api/v1/audit?limit=3`);   // no cookie
expect(res.status).toBe(401);
// And the audit store contains no "audit.queried" entry for this request
```

## AC-007 — a forged header does not authenticate
```ts
const res = await fetch(`${base}/api/v1/sales?limit=5`, {
  headers: { "x-user-id": "00000000-0000-7000-0000-000000000002" },
});
expect(res.status).toBe(401);
```

## AC-008 — an existing session still authorises correctly (no regression)
```ts
// The 108 currently-passing tests must still pass, unmodified.
```

## Manual verification (recorded in the PR)
```
npm start &
curl -s -o /dev/null -w '%{http_code}\n' localhost:3200/api/v1/sales              # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3200/api/v1/incidents \
  -H 'content-type: application/json' -d '{…valid body…}'                        # 401
```
