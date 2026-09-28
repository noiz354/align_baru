# F-006 — majelishub: public kajian and masjid pages read through a public projection

## User problem
The public pages either show every organization's private and draft data, or show nothing at all,
depending on which database role the application happens to hold. Neither is acceptable, and an
attendee cannot be shown a trustworthy list of kajian.

## Actor
An attendee looking for a study circle. Mosque administrator deciding what is public.

## Current behavior
`src/app/kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]/page.tsx`, `masjid/[slug]/page.tsx` call
`getDb()` and select directly:

- no `TenantScope`
- no `rlsStatements` — the scoped transaction is never entered
- no `requirePermission` (correct for a public read — but see below)
- **no `status` filter**, so `DRAFT` rows are exposed
- wrapped in `catch { events = [] }`

Measured on real PostgreSQL 18.4, the identical query behaves three different ways:

| Connection | No scope | Result |
|---|---|---|
| table owner (dev/local) | yes | **both** organizations' rows — cross-tenant leak |
| `majelishub_app` (production) | yes | **0 rows** — page renders "0 event(s)" |
| `majelishub_app` | `app.organization_id` = Org A | Org A's rows only — correct |

Verified end to end: a production build rendered both `Kajian Org A` and `Kajian Org B` at `/kajian`.

`kajian/[slug]` additionally resolves by slug alone, while the unique index is
`(organization_id, slug)` — two organizations may own the same slug, and the page returns whichever
row the planner yields. Its comment claims *"org-scoped via join"*; there is no join.

## Desired behavior
Public pages read through a dedicated public projection: a repository function that
(a) is explicitly named as public, (b) filters to published rows only, (c) never crosses an
organization boundary, and (d) distinguishes "no such published event" from "not published".

## Scope
- `src/features/content/public-projections.ts` — it already exists as a stub. Implement it.
- The four pages call the projection instead of the db.
- Honest empty/error/loading states; delete `catch → []`.
- A cross-organization slug collision returns a deterministic, disclosed-safe `404`.

## Explicit non-goals
- The authenticated `organizations/*` routes (`F-005`).
- Registration and check-in (`F-012`).
- Any design work. These pages are still `style={{}}` shells; that is `F-018`.
- RLS for the public path. A public projection deliberately runs **outside** a tenant scope, so it
  must rely on a `WHERE` clause, not on RLS. That asymmetry is correct and must be documented in the
  function header, because it is exactly the trap `F-003` exists to close on other tables.

## User flow
1. Attendee opens `/kajian`.
2. The server returns published events across organizations, with mosque name, title, start time.
3. Attendee opens `/kajian/<slug>` and sees the full detail, or a `404` if it is not published.
4. A `DRAFT` event is never visible, and its existence is not disclosed.

## Business rules
- Only `status = 'PUBLISHED'` (and, for mosques, `is_active`) is public.
- A public read is not tenant-scoped, so its predicate must be explicit and reviewed; no query may
  reach a `scope`-less table without passing through this module.
- A slug that exists in two organizations resolves to a `404`, not to an arbitrary one. A slug is
  unique per organization, not globally, so `/kajian/<slug>` is ambiguous by construction. **Decision
  required:** either make the detail route `/kajian/<orgSlug>/<eventSlug>`, or return `404` when the
  slug matches more than one published event. The second is smaller and does not break existing
  links; prefer it and record the trade-off in the implementation notes.
- `notFound()` is the correct response; never a redirect to a list.

## API contract
No API change. The four page routes keep their paths.

```
GET /kajian          → 200, published events across organizations, newest first (never by popularity — ADR-0014)
GET /kajian/<slug>   → 200 detail | 404 (unknown, unpublished, or ambiguous)
```

## Data model changes
None.

## Authorization rules
None — this is a public read and must **not** go through `requirePermission`. It goes through
`PUBLIC_ROUTES`-style reasoning: `src/features/content/public-projections.ts` is the single auditable
place, mirroring `src/server/auth/public-routes.ts` for routes.

## Validation rules
A slug is validated for shape and length before it reaches the query. No interpolation into SQL.

## Error behavior
Four states, distinctly rendered: loading, empty ("no kajian published"), degraded ("the schedule is
temporarily unavailable"), and error. **A failed query must never render as "no kajian"** — that is
`AGENTS.md §4.1` and the reason `catch → []` is a defect, not a style choice.

## Idempotency / concurrency
Read-only.

## UI behavior
- The page must say *why* it is empty, per the project's own "a page that says why it is empty"
  convention already used in the sibling project.
- Raw UUIDs must not be rendered. `dasbor` showed `id.slice(0,8)`; a public page must not.
- Design tokens before inline styles, or at minimum no literal colours (`src/app/styles/README.md`
  rule 1).

## Observability
`content.public_list.served` with the result count and filter. No PII, no token-shaped attribute —
the existing allow-list and the ban list already enforce this.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
**F-005** — the authenticated siblings must be correct before the public path is rebuilt, otherwise
the same routes stay reachable by header.

## Impacted files/modules
- `src/features/content/public-projections.ts` (implement)
- `src/app/kajian/page.tsx`
- `src/app/masjid/page.tsx`
- `src/app/kajian/[slug]/page.tsx`
- `src/app/masjid/[slug]/page.tsx`
- new: `tests/integration/content/public-projection-scope.test.ts` (replaces the existing
  `describe.todo` skeleton at `tests/integration/content/public-projection.test.ts`)
- `src/app/styles/README.md` — add the asymmetry note referenced above

## Migration strategy
None.

## Rollback considerations
Reverting returns to a page that either leaks or is empty. There is no acceptable intermediate state,
so this change should not be deployed in pieces across the four pages: land them together.
