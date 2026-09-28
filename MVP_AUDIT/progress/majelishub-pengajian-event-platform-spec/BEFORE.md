# MajelisHub — BEFORE (2026-09-28)

**Baseline:** `SKELETON_ONLY` (tag `mvp-wave2-baseline-cc80bac` HEAD `e9ebe41` includes yomi feat/docs)

**Blocker:** `No organization→mosque→event vertical — T-ORG-002, T-MOSQUE-001, T-EVENT-001 not implemented.`

## Reproduction (wave2 baseline)

```bash
cd majelishub-pengajian-event-platform-spec
npm install # 313 pkgs, Next 16.3.6
# Boot without DB (AppShell only):
DATABASE_URL=postgres://majelishub:majelishub@localhost:5432/majelishub_dev npm run dev -- --port 3104 --hostname 0.0.0.0
# → Ready

curl -s http://localhost:3104/masjid | grep -E "Masjid|TODO"
# → return null (shell)

curl -s http://localhost:3104/kajian | grep -E "Kajian|TODO"
# → return null

curl -s http://localhost:3104/dasbor | grep -E "Dasbor|TODO"
# → shell

cat src/app/masjid/page.tsx
# → export default async function Page(){ return null; } // TODO(T-MOSQUE-003)

cat src/app/kajian/page.tsx
# → return null // TODO(T-EVENT-003)

cat src/server/db/schema/tenancy.ts | grep -E "organizations|mosques|kajian"
# → organizations, organization_members, mosques present; kajian_events missing

ls src/server/db/schema/*.ts
# → audit.ts, identity.ts, tenancy.ts (no events)

ls src/features
# → analytics, attendance, audio, checkin, content, exports, feedback, media, moderation, notifications, registration, transcription (no event feature)

curl -s http://localhost:3104/api/v1/events | head
# → route shell 501 Not implemented: T-EVENT-003 (or 404)

cat tests/integration/security/isolation.test.ts | grep -A2 "mosques"
# → proves RLS for mosques, not yet for events
```

**Evidence:**

- `src/app/masjid/[slug]/page.tsx` skeleton (no DB)
- `src/app/kajian/[slug]/page.tsx` skeleton
- `src/app/api/v1/events/route.ts` shell `throw Not implemented: T-EVENT-003`
- `src/server/db/schema/tenancy.ts` has `organizations`, `organization_members`, `mosques` only; `kajian_events` absent per `DATA_MODEL.md §4`
- Foundations verified: `durable rate limiter` (rateLimitBuckets), `RLS` (0001_row_level_security.sql for organizations/mosques/members), `TenantScope` (`src/shared/contracts/scope.ts`), `requirePermission` (`src/server/auth/permissions.ts` with `event.write`/`event.read`), `hash-chained audit` (`audit_events` 0002, writer+verifier), `logging allow-list` (OBSERVABILITY.md §4), `tenancy/security migrations` (0000-0003)

**Primary flow before:**

*Jakarta admin → Majelis Demo Jakarta → Masjid Al Demo → Kajian Akhir Pekan → audit/RLS*

- No organization created (platform-only `createOrganization` requires PLATFORM scope)
- No mosque (TenantScope required)
- No event (table missing) → flow FAIL at step 1

**Ready for narrow slice:** `organization → mosque → event` with PG (PGlite dev) + RLS + TenantScope + requirePermission + audit + rate-limit, seed Jakarta/Bandung, UI dashboard/mosque/event, RLS proof Jakarta 200 vs Bandung 403/404, audit hash chain.
