# Minimal Wave3 BASELINE

**Wave2 State:** `MVP_PARTIAL` (df0e396) — Discover → manga detail → chapter → reader → durable progress via `data/db.json` file-backed (sessions+progress), default demo user `usr-guest-001` page5 restores on reload/restart, but progress `userId` taken from query/body with default `usr-guest-001` (hard-coded), no auth, no per-user isolation.

**Demo-only boundary:** `src/app/api/v1/progress/route.ts` used `query userId || body userId || "usr-guest-001"` (no `requireUser`), `ReaderView` sent `userId=usr-guest-001` and stored under that key. Any client could read/write any `userId:chapterId` by crafting `userId` param. No login/logout, no session, no `401`, no range check beyond clamp, no cross-user isolation proof.

**Wave3 target:** authenticated user-owned progress → per-user isolation, real login/logout/session (seed `reader.a@example.test`/`reader.b@example.test`), `progress` key `${userId}:${chapterId}` scoped by session, 3 negative paths (unauth 401, invalid page 400/422, B cannot mutate/read A), runtime verify A page4 vs B page1 independent (within the seeded chapter range), logout/login+restart durability, and keep `MVP_PARTIAL` while documenting the out-of-scope admin/upload boundary.
