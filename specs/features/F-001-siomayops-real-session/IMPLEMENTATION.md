# F-001 — Implementation plan

Target: 2 slices, roughly 2 hours total. This is the highest value-per-line change in the workspace.

## F-001-S1 — Close the hole (30 minutes, no new functionality)

**This slice is independently shippable and independently valuable.** Land it even if the rest is
deferred.

1. `src/server/auth/port.ts` — replace the guard:
   ```ts
   // before
   if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") throw …
   // after
   if (process.env.NODE_ENV === "production") {
     throw new Error("Fake auth provider is not permitted in production");
   }
   ```
2. Rename `FAKE_AUTH_ROLE`/`FAKE_ORG_ID`/`FAKE_OPERATOR_ID` to `DEV_AUTH_*` so the naming matches
   its actual scope, and log a single `WARN` at boot when the dev provider is selected.
3. Add `tests/security/unauthenticated.test.ts` with AC-001…AC-003 and AC-005 for five routes.
4. Run `npm test`; expect the existing 108 to still pass plus the new ones.

**Do not** refactor `ROLE_PERMISSIONS` or the 78 call sites. They are correct; the bug is upstream.

## F-001-S2 — Real session resolution (90 minutes)

1. Add a migration for a `session` table (`id`, `user_id`, `organization_id`, `roles text[]`,
   `expires_at`, `created_at`, `last_seen_at`), registered in the migrations journal.
   siomayops has **no lockfile and no drizzle/ folder** — see the decision in
   `specs/decisions/ADR-002-siomayops-persistence.md`; if adopting drizzle is out of scope for this
   slice, store sessions in `memory-store.ts` and accept that a restart signs everyone out, and record
   that in the SPEC's Scope as a known limitation of S2. **Do not leave this unstated.**
2. `src/server/auth/session-provider.ts` — resolve by cookie value; return `null` on absent,
   malformed, unknown or expired. Never throw for a bad cookie.
3. `src/server/auth/index.ts` — select the provider: real in all environments; the dev provider only
   when `NODE_ENV !== "production"` **and** `DEV_AUTH_ROLE` is set.
4. Extend AC-004 and AC-007.
5. Add a `GET /api/v1/operators/me` that returns the resolved session, so the AC-005 body has a
   positive control.

## Verification after each slice
```
npm run typecheck && npm run lint && npm test && npm run build
```
All four must exit 0. Then run the `ACCEPTANCE.md` manual block.

## Do not touch
- `src/app/api/v1/_helpers.ts` shape (F-009 changes idempotency, not this).
- `memory-store.ts` beyond the session map.
- Any page. There is no sign-in UI in this slice; that is a Wave 2 slice.
