# F-006 — Implementation plan

Three slices, roughly 3 hours. Ship them together; a partial change is a leak or a blank page.

## F-006-S1 — The public projection (75 min)

`src/features/content/public-projections.ts` exists as a stub. Implement it as the *only* sanctioned
way to read tenant data without a tenant scope.

1. Two functions, and no others:
   ```ts
   listPublishedEvents(limit): Promise<PublicEvent[]>
   findPublishedEventBySlug(slug): Promise<PublicEvent | null>   // null when 0 or >1 match
   ```
   and the mosque equivalents if the directory needs them.
2. Each returns a **narrow DTO**. Do not return a `kajianEvents` row — the point of the projection is
   that the field list is deliberate. AC-003 pins the exact keys.
3. The WHERE clause is explicit: `status = 'PUBLISHED'`, and for mosques `is_active = true`.
   No `TenantScope` parameter — deliberately, and the file header must say why (see the SPEC's
   business rules).
4. `findPublishedEventBySlug` uses `.limit(2)` and returns `null` when it gets 2. That is the
   ambiguity rule, and it is one line.
5. Sort by `startsAt` ascending, nearest first. **Never** by popularity or any score — ADR-0014 and
   ADR-0024 forbid it, and the sibling project's audit flagged the same trap.

Tests: AC-001, AC-003, AC-004, AC-005.

## F-006-S2 — Rewrite the four pages (75 min)

For each of the four, in this order:
1. Replace the `getDb()` + `db.select()` block with one call to the projection.
2. Delete the `try/catch` that defaults to `[]`.
3. Render four states. The project already has a convention for "a page that says why it is empty" —
   match it.
4. Remove every `id.slice(0,8)` from the markup.

Do `kajian/page.tsx` first, get the state handling right, then apply it three times.

Tests: AC-002, AC-006, AC-008, AC-009.

## F-006-S3 — Close the boundary rules (30 min)

1. Run `npm run lint`. Four of the eight `module-boundaries` errors should already be gone.
2. Add the source-absence assertion (AC-007) to `tests/unit/architecture.test.ts` or a new
   `tests/unit/lint/public-read-boundary.test.ts`, so the violation cannot return.
3. Update `src/app/styles/README.md` with the public-projection asymmetry note.

## Verification
```
npm run typecheck && npm run lint && npm test && npm run build
# then, with two organizations and one DRAFT seeded:
curl -s localhost:3102/kajian | grep -c draft-slug    # 0
curl -s -o /dev/null -w '%{http_code}\n' localhost:3102/kajian/draft-slug   # 404
```

## Do not touch
- The authenticated `organizations/*` routes (`F-005`).
- `src/server/db/**` and `drizzle/**` — this feature adds no schema and no policy.
- `src/features/content/{materials,withdrawal}.ts` — separate features, separate slices.
