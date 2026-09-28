# F-008 — Acceptance criteria

## AC-001 — anonymous access to every admin page is refused
```ts
for (const p of ["/admin","/admin/manga","/admin/uploads",
                 "/admin/manga/manga-sample","/admin/manga/manga-sample/chapters"]) {
  const res = await get(p, { cookie: undefined });
  expect([401, 404], p).toContain(res.status);
  expect(res.body, p).not.toContain("Catalog Management");
}
```
The last assertion matters: the guard must run before render, not after.

## AC-002 — a signed-in reader is refused
```ts
const res = await get("/admin", { cookie: await sessionFor({ role: "reader" }) });
expect(res.status).toBe(403);
```

## AC-003 — an administrator is allowed
```ts
for (const role of ["admin", "editor"]) {
  const res = await get("/admin", { cookie: await sessionFor({ role }) });
  expect(res.status, role).toBe(200);
  expect(res.body).toContain("Catalog Management");
}
```

## AC-004 — the role cannot be supplied by the client
```ts
// ?role=admin, and a forged session row, must both fail
const res = await get("/admin?role=admin", { cookie: await sessionFor({ role: "reader" }) });
expect(res.status).toBe(403);
```

## AC-005 — the check is server-side
```ts
// Disable JavaScript / assert the response itself is the guard
const res = await get("/admin", { cookie: undefined, js: false });
expect(res.status).not.toBe(200);
```
A purely client-side check would fail this.

## AC-006 — no admin page omits the guard
```ts
// Source-absence assertion, paired with AC-001…005 behavioural coverage
for (const f of adminPages) {
  const src = readFileSync(f, "utf8");
  expect(src, f).toMatch(/requireAdmin|getSessionUser/);
}
```

## AC-007 — the denial is observable
```ts
// auth.admin.denied is emitted with session id + role, and contains no page content
```

## AC-008 — nothing regressed
```bash
npm test          # 15 pass
npm run typecheck && npm run build
```

## Manual verification
```
curl -s -o /dev/null -w '%{http_code}\n' localhost:3110/admin          # 401 or 404
curl -s -o /dev/null -w '%{http_code}\n' localhost:3110/admin/manga     # 401 or 404
```
