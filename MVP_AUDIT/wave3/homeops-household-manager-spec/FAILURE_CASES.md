# HomeOps Wave3 FAILURE CASES (≥3 verified)

All via `curl` against `http://localhost:3105` after `feat(homeops): add durable recurring chore lifecycle` on PGlite.

## 1. Double-complete idempotent (200 deduped, no duplicate next)

Second POST to same completed occurrence:

```bash
curl -s -X POST http://localhost:3105/api/homeops/chores/ca32a2a0-04a6-48dc-801e-953a73661aee/complete -H "x-homeops-household: 000...001" -H "x-homeops-member: 000...065"
# 1st → {"chore":{"status":"COMPLETED","completedAt":"2026-09-28T05:00:41.314Z"},"nextOccurrence":{"dueOn":"2026-09-29"}} 200
# 2nd → {"chore":{"status":"COMPLETED","completedAt":"2026-09-28T05:00:41.314Z"},"deduped":true} 200
# GET /chores → still 2 rows (ca32a2a0 COMPLETED, cb793644 OPEN) not 3
```

`uq_occurrence_household_key` + early return on `status===COMPLETED` prevents second next.

## 2. Tenant isolation — wrong household 404

```bash
curl -s -X POST http://localhost:3105/api/homeops/chores/ca32a2a0-.../complete -H "x-homeops-household: 00000000-0000-4000-8000-000000000002" -H "x-homeops-member: 000...065"
# → {"error":"Not found","code":"NOT_FOUND"} 404
```

Household-scoped `WHERE household_id` fails closed.

## 3. Validation — missing householdId / bad title 422

```bash
curl -s -X POST http://localhost:3105/api/homeops/chores -d '{"memberId":"000...065","title":"Buang sampah"}'
# → {"error":"householdId required","code":"VALIDATION_FAILED"} 422

curl -s -X POST http://localhost:3105/api/homeops/chores -d '{"householdId":"000...001","memberId":"000...065","title":"X"}'
# → {"error":"title minimal 2 huruf","code":"VALIDATION_FAILED","fields":{"title":"minimal 2"}} 422

curl -s -X POST http://localhost:3105/api/homeops/chores -d '{"householdId":"000...001","memberId":"000...065","title":"Buang sampah","recurrenceKind":"DAILY"}' # dueOn defaults to today, ok 201
```

## 4. Not found — unknown occurrence 404

```bash
curl -s -X POST http://localhost:3105/api/homeops/chores/00000000-0000-4000-8000-000000099999/complete -H "x-homeops-household: 000...001" -H "x-homeops-member: 000...065"
# → {"error":"Not found","code":"NOT_FOUND"} 404
```

## 5. Weekly recurrence anchor 2026-09-28 → 2026-10-05 (7 days) not 09-29

```bash
curl ... -d '{"title":"Buang sampah mingguan","recurrenceKind":"WEEKLY","dueOn":"2026-09-28"}' → occ d97bcd67...
curl .../d97bcd67.../complete → {"nextOccurrence":{"dueOn":"2026-10-05"}} 200
# Not 2026-09-29, validates weekly rule
```

## 6. Reload/restart no duplicate next (restart PID 4431→4564)

After `complete`, next `cb793644` exists; after `kill` and `npm run dev --port 3105` new PID 4564:

```bash
curl -s "http://localhost:3105/api/homeops/chores?householdId=000...001"
# → 2 rows still, not 3
curl -s "http://localhost:3105/api/homeops/today?householdId=000...001&today=2026-09-28" → []
curl -s "http://localhost:3105/api/homeops/today?householdId=000...001&today=2026-09-29" → [cb793644 OPEN]
```

Deterministic `occurrenceKey` + `onConflictDoNothing` prevents duplicate on replay or crash-retry.
