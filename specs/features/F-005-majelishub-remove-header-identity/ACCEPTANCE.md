# F-005 — Acceptance criteria

## AC-001 — no header, no query parameter, no default may resolve an identity
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
// walk src/app/api for any occurrence
for (const f of routeFiles) {
  const src = readFileSync(f, "utf8");
  expect(src, f).not.toMatch(/x-majelishub-user/);
  expect(src, f).not.toMatch(/searchParams\.get\(["']userId["']\)/);
  expect(src, f).not.toMatch(/majelishub-jakarta-(admin|organizer)/);
}
```
This is a legitimate use of a source scan: it asserts an **absence of a construct**, not the presence
of a call. It is paired with AC-002…AC-005, which are behavioural.

## AC-002 — a forged header is refused
```ts
const res = await fetch(`${base}/api/majelishub/organizations/${orgId}/events`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-majelishub-user": "organizer-1" },
  body: JSON.stringify({ title: "Forged", mosqueId, slug: "forged" }),
});
expect(res.status).toBe(401);
// And no event row was created
expect(await countEvents(orgId)).toBe(before);
```

## AC-003 — a `?userId=` query parameter is refused
Same body, same expectation, parameter instead of header.

## AC-004 — a real session is accepted and authorises correctly
```ts
// A session whose user is an ACTIVE ORGANIZER of orgId
const res = await as(organizer).post(`/api/majelishub/organizations/${orgId}/events`, validBody);
expect(res.status).toBe(201);
```

## AC-005 — a session without membership gets 404, not 403
```ts
const res = await as(memberOfOtherOrg).get(`/api/majelishub/organizations/${orgId}/events`);
expect(res.status).toBe(404);
```

## AC-006 — the route gate is behavioural, not a string search
Replace the `classifyRoute` heuristic with a real check. Minimum viable replacement: for every route
that is not in `PUBLIC_ROUTES`, import the module and assert that an unauthenticated request does not
return tenant data. If importing route modules in a test is impractical, the gate must be deleted
rather than kept in string form — a gate that cannot detect the defect is worse than none.

## AC-007 — the static counts are gone
```ts
// remove expect(routeFiles.length).toBe(30) and expect(stubs.length).toBe(21)
// assert a property instead: every route is authorized, public-listed, or a pure stub
```

## AC-008 — nothing else regressed
```bash
INTEGRATION_DATABASE_URL=… npx vitest run --project integration tests/integration/security/permissions.test.ts  # 6 passed
npm run typecheck && npm run lint && npm test && npm run build
```

## Manual verification
```
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3102/api/majelishub/organizations/$ORG/events \
  -H 'content-type: application/json' -H 'x-majelishub-user: organizer-1' -d '{…}'   # 401
```
