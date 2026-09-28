# Yomi — Security

**Status:** canonical. The trust boundaries, the controls that must hold, and the
ones currently not holding.

Authority for implementation detail: `SECURITY.md`, `THREAT_MODEL.md`. This file
records what must be true, not what a check currently reports.

## 1. Trust boundaries

| # | Boundary | Crossing | Control |
|---|---|---|---|
| B-1 | Browser → app | every request | validation, `AppError` codes, no vendor text passthrough |
| B-2 | App → PostgreSQL | every query | parameterised only (NFR-SEC-015); a user id is a **bound parameter, never interpolated** |
| B-3 | App → object storage | every image | private bucket, app-mediated `/media` only |
| B-4 | Anonymous → member surface | `/library` `/bookmarks` `/history` `/settings` | session required |
| B-5 | Member → admin surface | `/admin/**` | session **and** `role = admin` |
| B-6 | Published → unpublished | `/media`, catalogue reads | publication state per chapter |

## 2. Controls that must hold, and their current state

| Control | Requirement | State |
|---|---|---|
| C-1 Parameterised SQL | NFR-SEC-015. No runtime value in SQL text. | ✅ holds. `catalog.db-harness` even builds its table list from the schema inventory for this reason. |
| C-2 User-scoped queries | THREAT T-04. A reader's query must never reach another reader's row. | ✅ holds in every implemented repository. **Proven by mutation**: removing the `userId` filter fails 3 tests in `members-surface.test.ts`; from `BookmarkRepository.delete`, 2. |
| C-3 Opaque "not yours" | A probe must not learn whether another reader's id exists. | ✅ `BookmarkRepository.delete` returns `boolean`, not the row. |
| C-4 Anonymous cannot enumerate accounts | Registration must not distinguish "email taken". | ⛔ **no registration exists** (F-003). |
| C-5 Argon2id, parameters from config | Never hardcoded in a route. | ⚠️ `argon2` is imported ad-hoc inside `api/auth/login/route.ts:1`; there is no `PasswordHasher` port implementation. |
| C-6 Session token never in a header | Tokens leak via logs, proxies, `Referer`. | ⚠️ `server/auth/guard.ts:25` accepts an `x-session-token` header. |
| C-7 Private object storage | No direct bucket access; `/media` only. | ✅ holds. |
| C-8 Draft content invisible to anonymous | B-6. | ✅ holds. Enforced per request in `/media`, proven by its tests. |
| C-9 Note length refused, not truncated | NFR-SEC-016. | ✅ holds. `members-surface.test.ts` proves a 281-char note is rejected. |
| C-10 Error responses leak nothing | No vendor XML, no stack, no internal ids. | ✅ holds. `STORAGE_ERROR` returns 502 + `Retry-After` and nothing else; proven. |
| C-11 https in production | NFR-SEC-009. | ✅ holds. `loadEnv()` refuses `NODE_ENV=production` with `http://`. |
| C-12 No secrets in the repo | `.env`, `*.tfvars`, keys never committed. | ✅ holds. Seed credentials are env-injected (`SEED_ADMIN_PASSWORD`, `SEED_READER_PASSWORD`) and the seed **refuses** without them. |
| C-13 Typed errors only | `AppError` with a code in the §6 table. | ⚠️ `server/auth/guard.ts:43` `requireUser` throws a bare `Error`. |
| C-14 Admin surface guarded | B-5. | ⛔ **not enforced.** See §3. |

## 3. The unguarded admin surface — the one live risk

`src/middleware.ts:38` sets

```ts
matcher: ['/__t-auth-007-matcher-not-configured__']
```

An unreachable dummy, left deliberately: `matcher: []` broke `/healthz` under
`next start` on Next 16.3.6. The consequence is that **no page has route-level
protection**. `/library`, `/history`, `/bookmarks`, `/settings` and every
`/admin/*` page render for anonymous visitors.

The members' data itself is still protected — every repository and route checks the
caller, and Batch 2 proved the isolation with mutation. So today the exposure is
**page shell + layout**, not member data. That is P2, not P0.

**It becomes P0 the moment any admin route exists.** This is the governing
constraint on the active track:

> **F-016 (admin CRUD) and F-017 (upload) may build their service and repository
> layers. They must not be exposed on any route, page, or form until F-005
> ROUTE-GUARD exists.**

Shipping an unguarded admin route to "finish" a feature would be a security
regression introduced by this plan, not a shortcut around it. F-016/F-017's route
and page halves are deferred for this reason alone.

`matcher: []` also broke `/healthz` once. Any F-005 implementation must therefore be
verified against: `/healthz` reachable, `/media/**` reachable, `/api/v1/**`
reachable, `/discover` reachable, and `/library` `/history` `/bookmarks`
`/settings` `/admin` redirecting when anonymous.

## 4. Per-journey negative tests that must exist

These are the security assertions the MVP needs. Each is a required cell in
[execution/VERIFICATION_MATRIX.md](execution/VERIFICATION_MATRIX.md).

| Surface | Negative case | Current |
|---|---|---|
| Library | anonymous → `AUTH_REQUIRED`, not an empty list | ✅ |
| Bookmarks | delete another reader's mark → same answer as "not there" | ✅ |
| Bookmarks | `pageNumber` past the chapter length → refused | ✅ (restored in Batch 2) |
| Library add | unknown `slug`/`mangaId` → `MANGA_NOT_FOUND`, not an FK 500 | ✅ (restored in Batch 2) |
| Progress | stale `updatedAt` → rejected, not applied | ✅ repository; ⛔ the reader's route bypasses it (F-006) |
| Search | oversized `q` → 4xx, no query run | ⛔ not built |
| Search | cursor that cannot be decoded → refused, not repaired | ⛔ not built |
| Media | malformed key → 404, never 422 | ✅ |
| Media | draft key as anonymous → 404, as admin → 200 | ✅ |
| Register | duplicate email → same answer as success | ⛔ not built (F-003) |
| Admin | member session → refused | ⛔ not built (F-005) |

## 5. Threats that shaped the design

**T-04 — cross-reader leakage.** The most important one. `reading_progress`,
`library_entry`, `bookmark`, `reading_history` are all user-scoped; a missing
`WHERE user_id = ?` returns another reader's private reading. This is why
`BookmarkRepository.delete` returns a boolean, why `list()` takes `userId` as its
first argument, and why the isolation tests use **injected** mutations rather than
asserting the code "looks scoped".

**Object storage as a public surface.** The S3 bucket is private and every byte
crosses `/media`, which authorises against the owning chapter's publication state
on each request. This is a deliberate cost: a media CDN with signed URLs would be
faster and would reintroduce the draft leak.

**Over-collection.** A 404 body says nothing about the asset. Storage errors return
502 + `Retry-After` and never vendor XML. Neither leaks whether a key exists.

**Time and enumeration on login.** Unknown emails are verified against a dummy
hash so response time does not distinguish "no such user" from "wrong password" —
and the message is uniform. Registration must do the same (F-003).
