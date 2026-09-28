# F-004 — Acceptance criteria

## AC-001 — every SQL file is registered
```ts
import { readdirSync, readFileSync } from "node:fs";
const files = readdirSync("migrations").filter(f => f.endsWith(".sql")).map(f => f.replace(".sql",""));
const journal = JSON.parse(readFileSync("migrations/meta/_journal.json","utf8"));
const tags = journal.entries.map(e => e.tag);
expect(new Set(files)).toEqual(new Set(tags));   // no file unregistered, no entry without a file
```

## AC-002 — a clean database gets every table
```bash
createdb homeops_fresh
DATABASE_URL=postgres://…/homeops_fresh npm run db:migrate
psql -d homeops_fresh -c '\dt' | grep -c room            # ≥ 1
psql -d homeops_fresh -c '\dt' | grep -c chore_definition # ≥ 1
psql -d homeops_fresh -c '\dt' | grep -c chore_occurrence # ≥ 1
```

## AC-003 — the core routes answer, they do not 500
```bash
# with a valid session cookie
curl -s -o /dev/null -w '%{http_code}\n' -H "cookie: <session>" localhost:3101/api/homeops/today  # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "cookie: <session>" localhost:3101/api/homeops/rooms  # 200
```

## AC-004 — re-running is a no-op
```bash
DATABASE_URL=… npm run db:migrate   # second run
# must report 0 applied and exit 0
```

## AC-005 — an unregistered migration file is a hard failure
Add `0002_scratch.sql` with valid SQL but no journal entry:
```bash
DATABASE_URL=… npm run db:migrate
# must exit non-zero with: "migrations/0002_scratch.sql is not registered in meta/_journal.json"
```

## AC-006 — the seed script cannot create schema
```ts
const seed = readFileSync("scripts/seed-wave2-homeops.mjs", "utf8");
expect(seed).not.toMatch(/CREATE TABLE/i);
```

## AC-007 — the app refuses to serve a stale schema
```ts
// Given a database at migration 0000
// When the server boots with code requiring 0001
// Then: the process exits non-zero and logs
//   "schema version 0 is behind required version 1; run npm run db:migrate"
```

## AC-008 — data survives a restart
```bash
# create a room, restart the server, read it back
curl -s -X POST … /api/homeops/rooms …    # 201
<restart>
curl -s -H "cookie: <session>" …/api/homeops/rooms   # the room is still there
```
