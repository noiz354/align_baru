# Runtime Commands — Exact Repro

> **Historical commands:** These commands reproduce the earlier baseline audit, not every current Wave3 flow. Use the per-project Wave3 `RUNTIME_PROOF.md` for current commands. The old MajelisHub route-move workaround below has already been applied; do not rerun its `cp`/`rm` commands.


Audit date: 2026-09-28 (Asia/Jakarta) · Sandbox: `ikkuvfskb35qmack9i6ru` · Branch `arena/01a0e54f-align-baru`

## Environment

```bash
node -v # v22.22.3
npm -v  # 10.9.8
python3 --version # 3.11.2

# APT / Playwright CDN are unreachable (Fastly):
#   curl https://cdn.playwright.dev → ECONNRESET / Empty reply
#   sudo apt-get update → Connection failed [IP: 151.101.x.x 80]
# Workaround: use Lambda chromium bundle via npm registry (allowed):
npm install --legacy-peer-deps @sparticuz/chromium puppeteer-core
# which extracts:
#   /tmp/chromium (200M, 153.0.8010.0)
#   /tmp/al2023/lib/libnspr4.so, libnss3.so, ... (1.2M)
#   /tmp/fonts/fonts.conf
export LD_LIBRARY_PATH=/tmp/al2023/lib:$LD_LIBRARY_PATH
export FONTCONFIG_PATH=/tmp/fonts
export HOME=/tmp
```

## Per-project Install (all needed `npm install`)

```bash
# minimal (78 pkgs, Next 15.5.26)
cd manga-reader-spec-skeleton-minimal && npm install --legacy-peer-deps

# strangerlink (103 pkgs, Next 15.4.6)
cd strangerlink-random-chat-webrtc-spec && npm install --legacy-peer-deps

# yomi (313 pkgs, Next 16.3.6, requires Node >=24 <25 — warning on v22 but boots)
cd yomi-manga-reader-arch-skeleton && npm install --legacy-peer-deps

# homeops (226 pkgs, Next 16.3.6, requires Node >=24 — warning on v22 but boots)
cd homeops-household-manager-spec && npm install --legacy-peer-deps

# majelishub (233 pkgs, Next 16.3.6, requires Node >=24 <25)
cd majelishub-pengajian-event-platform-spec && npm install --legacy-peer-deps

# siomayops (278 pkgs, Next 15.4.2, pnpm@10 expected but npm works)
cd siomayops-streetfood-stall-ops-spec && npm install --legacy-peer-deps

# parking / rsi need no install (stdlib only)
cd parking-attendant-ops-app-spec && python3 -m unittest discover -s tests -p "test_*.py"
cd rsi-agent-recursive-self-improvement-prototype && python3 -m unittest discover -s tests -v
```

## Start All 6 Next.js Apps (isolated ports)

```bash
# homeops: env guards require *_dev/*_test DB name or --i-know-this-is-production
# Without real PG the product routes still boot (return null → not-found) — expected skeleton.
DATABASE_URL=postgres://homeops:homeops@localhost:5432/homeops_dev \
SESSION_SECRET=test-secret-32-bytes-long-xxxxxx \
CRON_SECRET=test-cron-secret \
APP_URL=http://localhost:3101 PORT=3101 \
npm run dev -- --port 3101 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack) - Local: http://localhost:3101 - Ready in 667ms

# yomi (needs PG for catalog, but boots without it — discover shows "catalog unavailable")
DATABASE_URL=postgres://yomi:yomi@localhost:5432/yomi_dev \
APP_URL=http://localhost:3103 PORT=3103 \
npm run dev -- --port 3103 --hostname 0.0.0.0
# → Ready in 946ms

# majelishub — BEFORE FIX: dies with:
#   unhandledRejection: Error: You cannot use different slug names for the same dynamic path ('slug' !== 'eventId').
#   at src/app/api/v1/events/[eventId] vs [slug]
# Fix (allowed minor wiring):
cp src/app/api/v1/events/\[slug\]/route.ts src/app/api/v1/events/\[eventId\]/route.ts
rm -rf src/app/api/v1/events/\[slug\]
# then:
DATABASE_URL=postgres://majelishub:majelishub@localhost:5432/majelishub_dev \
APP_URL=http://localhost:3102 PORT=3102 \
npm run dev -- --port 3102 --hostname 0.0.0.0
# → Ready in 381ms (after fix) else 404 + ERR_CONNECTION_REFUSED

# minimal (no DB, in-memory)
PORT=3104 npm run dev -- --port 3104 --hostname 0.0.0.0
# → ▲ Next.js 15.5.26 - Local: http://localhost:3104

# strangerlink (CSP blocks inline scripts → blank without bypass; needs --turbopack -p 3000 per manifest)
PORT=3105 npm run dev -- --port 3105 --hostname 0.0.0.0
# → next dev --turbopack -p 3000 → 15.4.6; also `npm run realtime` (ws) is a separate server not started here

# siomayops (pilot in-memory store, no PG required)
DATABASE_URL=postgres://siomayops:siomayops@localhost:5432/siomayops_dev \
PORT=3106 npm run dev -- --port 3106 --hostname 0.0.0.0
# → ▲ Next.js 15.4.2 - Local: http://localhost:3106
```

## Python Projects

```bash
# parking: hexagonal domain, SQLite + file audit, zero deps
cd parking-attendant-ops-app-spec
python3 -m unittest discover -s tests -p "test_*.py"  # 64 passed in 0.05s
python3 demo.py  # writes to /tmp/parking_demo_*/parking.db + audit_ledger.jsonl + receipt.bin
cat /tmp/parking_demo_*/audit_ledger.jsonl | head

# rsi: bounded Curriculum → Actor (ReAct) → Verifier + Jev
cd rsi-agent-recursive-self-improvement-prototype
python3 demo.py --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4
python3 demo.py --waves 2 --tasks-per-wave 6 --drs-rounds 2 --drs-tasks 4 --holdout 12  # full
python3 demo.py --improve --max-cycles 2 --max-lessons 2 --auto-approve  # bounded improvement loop
python3 -m rsi.cli run --improve
python3 -m rsi.cli status
python3 -m rsi.cli audit --verify
# artifacts in runs/: report.md, memory.json, attempts.jsonl, audit.jsonl, cycles.json, dashboard.html
```

## Database / Seed Commands (per project spec)

```bash
# homeops (requires PG — embedded-postgres via npm was used in prior audit, here we boot without PG):
#   npm run db:generate  # drizzle-kit generate → migrations/0000_identity_tenancy_platform.sql
#   npm run db:migrate   # tsx scripts/migrate.ts — refuses prod-named DB unless --i-know-this-is-production
#   npm run db:seed      # tsx scripts/seed.ts — refuses unless DB name contains dev/test/local
#   DATABASE_URL=postgres://homeops:homeops@localhost:5432/homeops_dev npm run db:seed
#   npm run scheduler:tick # tsx scripts/tick.ts

# majelishub (PGlite by default for tests; real PG via DATABASE_URL):
#   npm run db:generate  # drizzle-kit generate → drizzle/*.sql
#   npm run db:migrate   # node ops/db-migrate.mjs — filename order, schema_migrations table
#   npm run db:migrate:status
#   npm run test:integration # vitest with @electric-sql/pglite (in-process)
#   npm run docs:lint   # node ops/docs-lint.mjs
#   npm run verify:vs0 # node ops/verify-vs0.mjs (7 criteria, 6 pass /1 warn)

# yomi:
#   npm run db:generate  # drizzle-kit generate → drizzle/0000_initial_schema.sql
#   npm run db:migrate   # drizzle-kit migrate (needs DATABASE_URL)
#   npm run seed -- --env dev   # tsx scripts/seed.mjs — deterministic, ON CONFLICT DO NOTHING, placeholder asset_keys
#   npm run seed -- --env test --run-id ci-7 --load-titles 10000  # CI variant
#   npm run perf:bundle # node scripts/check-bundle-budget.mjs

# siomayops: no seed script (pilot in-memory); Drizzle schema is authoritative but not used at runtime
#   npx drizzle-kit generate # if needed
#   npm run check:stubs # node tools/check-stubs.mjs
#   npm run check:docs  # node tools/check-docs.mjs

# minimal: no seed (in-memory sample Data)
#   npm run typecheck # tsc --noEmit
#   npm run test      # node --experimental-strip-types --test tests/unit/reader.test.ts
#   npm run test:e2e  # playwright test (requires browser)

# strangerlink:
#   npm run realtime  # tsx src/server/realtime/server.ts — ws signaling server (separate from Next dev)
#   npm run test:realtime # vitest realtime
```

## Screenshot Commands (real browser)

```bash
# Install Lambda chromium via npm registry (bypasses CDN block):
npm install --legacy-peer-deps @sparticuz/chromium puppeteer-core

# pre-inflate (do once):
node --input-type=module -e "
  import chromium from '@sparticuz/chromium';
  import { inflate } from './node_modules/@sparticuz/chromium/build/lambdafs.js';
  await inflate('./node_modules/@sparticuz/chromium/bin/al2023.tar.br'); // → /tmp/al2023/lib
  await inflate('./node_modules/@sparticuz/chromium/bin/fonts.tar.br');  // → /tmp/fonts
  console.log(await chromium.executablePath()); // → /tmp/chromium
"

# screenshot helper (bypass CSP):
#   see MVP_AUDIT/screenshot.mjs and screenshot2.mjs — they set:
#     process.env.LD_LIBRARY_PATH='/tmp/al2023/lib'
#     process.env.FONTCONFIG_PATH='/tmp/fonts'
#     await page.setBypassCSP(true)
#     await page.setViewport({width:1440,height:1000})
#     await page.goto(url, {waitUntil:'networkidle2', timeout:15000})
#     await page.screenshot({path, fullPage:true})

# Generate terminal → image for non-browser projects:
#   parking: file:///tmp/parking.html (monospace, #0f172a) → screenshots/parking/01-demo-terminal.png
#   rsi: file:///.../runs/dashboard.html → screenshots/rsi-agent/01-dashboard.png
#        file:///tmp/rsi_report.html (monospace, #0f1117) → 02-report-rendered.png

# Verify ports:
#   ss -tlnp | grep LISTEN  # expect 3101,3103,3104,3105,3106 (3102 after fix)
#   curl -s -L http://localhost:3101/sign-in | head
#   curl -s http://localhost:3103/discover | grep -E "Catalog|All titles"
#   curl -s http://localhost:3105/start | grep -E "Before you start|Age gate"
```

## Build / Typecheck (smoke)

```bash
# each project
npm run typecheck  # tsc --noEmit
npm run lint       # eslint . (note strangerlink manifest has no eslint; siomay has 37 vulns)
npm run build      # next build (requires DB for some pages; yomi is force-dynamic so it passes without DB)
npm run test       # vitest run
```

## Credentials / Demo Accounts (no real secrets)

```
HomeOps seed (when PG available):
  users: sari@homeops.test, budi@homeops.test, dita@homeops.test, andi@homeops.test (away 2026-01-05..12)
  households: HH_MAIN (Asia/Jakarta, OWNER Sari), HH_CONTROL (America/New_York, OWNER Nora), HH_WIDTH (Europe/Berlin), HH_EMPTY (single)
  (actual seed only inserts households+members+settings; 5+ chores etc are pending — PENDING_SEED_SECTIONS — and throw Not implemented: T-xxx)

Yomi seed (--env dev):
  admin / reader users (argon2, random salt, never re-hashed)
  manga: "Seed Manga 0001" .. "Seed Manga 0500-Pages" (the 500-page window stress case), 480x720 synthetic, asset_key=sha256(slug|chapter|page)[:32]
  chapters + pages (asset_key placeholder, byte_size_* true but bytes dropped), reading_progress, bookmark, library entry

Parking demo (temp dir):
  zone z1, slots A-01,A-02,A-03,C-01, attendant att_budi, supervisor spv1 pin 1234, shift shf_morning, device dev_rugged_01, Geo -6.21,106.85

RSI demo (seed 0, mock Jev):
  wave 1/1 2 tasks | DRS 1/1 2 tasks | holdout 4 | memory 4 lessons | keys: api-design, debugging, edge-cases, http, logging, refactor, typing
```
