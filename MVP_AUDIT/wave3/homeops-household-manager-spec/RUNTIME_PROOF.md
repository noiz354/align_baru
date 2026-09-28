# HomeOps Wave3 RUNTIME PROOF

**DB:** `pglite:///tmp/homeops-pglite` file-backed, `isPgliteUrl` path `/tmp/homeops-pglite`.
**Server:** `npm run dev -- --port 3105 --hostname 0.0.0.0` PID 4431 → stopped → PID 4564 Ready 439ms (proper restart, not wrapper).
**Env:** `DATABASE_URL=pglite:///tmp/homeops-pglite SESSION_SECRET=a1b2… CRON_SECRET=1234… APP_URL=http://localhost:3105`

## Happy path — Buang sampah DAILY

```bash
HH=00000000-0000-4000-8000-000000000001
MEMBER=00000000-0000-4000-8000-000000000065 # SARI

# 1. Create definition+occurrence today
curl -s -X POST http://localhost:3105/api/homeops/chores -H "Content-Type: application/json" \
  -d '{"householdId":"00000000-0000-4000-8000-000000000001","memberId":"00000000-0000-4000-8000-000000000065","title":"Buang sampah","recurrenceKind":"DAILY","dueOn":"2026-09-28"}'
# → {"definition":{"id":"3b79c5cc-0c70-4c09-b791-7d7d4d398fc1","title":"Buang sampah","recurrenceKind":"DAILY"},"occurrence":{"id":"ca32a2a0-04a6-48dc-801e-953a73661aee","occurrenceKey":"3b79c5cc-0c70-4c09-b791-7d7d4d398fc1:2026-09-28","dueOn":"2026-09-28","status":"OPEN"}} 201

# 2. Today lists it
curl -s "http://localhost:3105/api/homeops/today?householdId=$HH&today=2026-09-28"
# → {"householdId":"...001","today":"2026-09-28","chores":[{"id":"ca32a2a0-...","dueOn":"2026-09-28","status":"OPEN"}]}

# 3. Complete → next occurrence
curl -s -X POST http://localhost:3105/api/homeops/chores/ca32a2a0-04a6-48dc-801e-953a73661aee/complete -H "x-homeops-household: $HH" -H "x-homeops-member: $MEMBER"
# → {"chore":{"id":"ca32a2a0...","status":"COMPLETED","completedAt":"2026-09-28T05:00:41.314Z"},"nextOccurrence":{"id":"cb793644-4a06-48df-8041-96d3cd1db64f","occurrenceKey":"3b79c5cc-...:2026-09-29","dueOn":"2026-09-29","status":"OPEN"}} 200

# 4. Today after complete empty
curl -s "http://localhost:3105/api/homeops/today?householdId=$HH&today=2026-09-28"
# → {"chores":[]}

# 5. List all shows exactly 2
curl -s "http://localhost:3105/api/homeops/chores?householdId=$HH"
# → {"chores":[{"id":"ca32a2a0...","dueOn":"2026-09-28","status":"COMPLETED"},{"id":"cb793644...","dueOn":"2026-09-29","status":"OPEN"}]}

# 6. Today 09-29 shows next
curl -s "http://localhost:3105/api/homeops/today?householdId=$HH&today=2026-09-29"
# → {"chores":[{"id":"cb793644...","dueOn":"2026-09-29","status":"OPEN"}]}

# 7. Weekly variant
curl ... -d '{"title":"Buang sampah mingguan","recurrenceKind":"WEEKLY","dueOn":"2026-09-28"}' → occurrence d97bcd67...
curl .../d97bcd67.../complete → nextOccurrence due 2026-10-05
```

## Restart durability

Stopped PID 4431, started PID 4564 Ready 439ms (same DB file, same SESSION_SECRET/CRON_SECRET):

```bash
curl -s "http://localhost:3105/api/homeops/chores?householdId=$HH"
# → still 2 rows: ca32a2a0 COMPLETED 2026-09-28, cb793644 OPEN 2026-09-29
curl -s "http://localhost:3105/api/homeops/today?householdId=$HH&today=2026-09-28"
# → []
curl -s "http://localhost:3105/api/homeops/today?householdId=$HH&today=2026-09-29"
# → [cb793644 OPEN]
```

## Idempotent double-complete

Second POST to same `ca32a2a0.../complete`:

```bash
curl -s -X POST .../ca32a2a0.../complete -H "x-homeops-household: $HH" -H "x-homeops-member: $MEMBER"
# → {"chore":{"id":"ca32a2a0...","status":"COMPLETED","completedAt":"2026-09-28T05:00:41.314Z"},"deduped":true} 200
# List still 2 rows, not 3
```
