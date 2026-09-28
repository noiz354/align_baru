# F-006 — Acceptance criteria

## AC-001 — drafts are never public
```ts
// Given one DRAFT and one PUBLISHED event in the same organization
const list = await listPublishedEvents();
expect(list.map(e => e.status)).not.toContain("DRAFT");
expect(list).toHaveLength(1);
```

## AC-002 — a draft detail page is a 404 and does not disclose existence
```ts
const res = await getPage("/kajian/draft-slug");
expect(res.status).toBe(404);
expect(res.body).not.toContain("secret internal title");
```

## AC-003 — the public list spans organizations and does not leak anything else
```ts
// Two organizations, one event each, both published
const list = await listPublishedEvents();
expect(list.map(e => e.organizationId).sort()).toEqual([A.id, B.id]);
// And nothing but the published projection fields is present
expect(Object.keys(list[0]).sort()).toEqual(["id","slug","title","mosqueName","startsAt","status"].sort());
```

## AC-004 — an ambiguous slug is a deterministic 404
```ts
// Two organizations publish events with the same slug
const a = await getPage("/kajian/duplicate-slug");
const b = await getPage("/kajian/duplicate-slug");
expect(a.status).toBe(404);
expect(b.status).toBe(404);
```

## AC-005 — a unique slug resolves
```ts
const res = await getPage("/kajian/only-in-a");
expect(res.status).toBe(200);
```

## AC-006 — a database error is not an empty list
```ts
// Break the database, request the page
const res = await getPage("/kajian");
expect(res.status).toBe(503);          // or 500 with the project's typed shape
expect(res.body).toContain(/temporarily unavailable|degraded/i);
expect(res.body).not.toMatch(/0 kajian/i);
```

## AC-007 — no page selects the schema directly
```ts
for (const f of readdirSync("src/app", { recursive: true })) {
  if (f.endsWith(".tsx") && f.includes("page"))
    expect(readFileSync(`src/app/${f}`,"utf8")).not.toMatch(/@\/server\/db\/schema/);
}
```
This also clears 4 of the 8 `majelishub/module-boundaries` lint errors, so `npm run lint` moves
toward green as a side effect.

## AC-008 — no raw UUID is rendered
```ts
const html = await renderPage("/kajian");
expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
```

## AC-009 — the existing error is not silently swallowed
```ts
// No `catch { … = [] }` remains in the four pages
expect(src).not.toMatch(/catch\s*\{\s*\w+\s*=\s*\[\s*\]/);
```

## AC-010 — the public path does not use requirePermission and does not need it
```ts
// The projection is a features-layer function; the route calls it directly.
// Assert no public page calls requirePermission (that would be the wrong direction)
// and no public page calls a repository with a scope (that would be a tenant read).
```

## AC-011 — lint and tests stay green
`npm run lint` must report 4 fewer errors than before, and `npm test` must not lose a pass.
