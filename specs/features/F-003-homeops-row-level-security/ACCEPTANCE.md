# F-003 — Acceptance criteria

## AC-001 — no tenant table lacks RLS
```sql
SELECT c.relname
FROM pg_class c
JOIN information_schema.columns col ON col.table_name = c.relname
WHERE c.relkind = 'r' AND col.column_name = 'household_id'
  AND NOT c.relrowsecurity;
-- must return zero rows
```

## AC-002 — an unscoped query inside the application role returns nothing
```ts
// Given: a scoped transaction helper
// When: a SELECT is issued with no set_config
// Then: zero rows for a table holding two households' rows
const rows = await withHouseholdTransaction(db, undefined, tx => tx.select().from(room));
expect(rows).toHaveLength(0);
```

## AC-003 — a scoped query returns only that household's rows
```ts
const rows = await withHouseholdTransaction(db, ctxA, tx => tx.select().from(room));
expect(rows.map(r => r.householdId)).toEqual([A.id]);
```

## AC-004 — a cross-household write is rejected by the policy, not by application code
```ts
await expect(
  withHouseholdTransaction(db, ctxA, tx => tx.insert(room).values({ householdId: B.id, … }))
).rejects.toThrow();   // 42501 insufficient_privilege, from WITH CHECK
```

## AC-005 — the session variable does not leak between pooled requests
```ts
// Run request A then request B on the same pool.
// B must not see A's rows.
const a = await withHouseholdTransaction(db, ctxA, tx => tx.select().from(room));
const b = await withHouseholdTransaction(db, ctxB, tx => tx.select().from(room));
expect(b.every(r => r.householdId === B.id)).toBe(true);
expect(a.every(r => r.householdId === A.id)).toBe(true);
```

## AC-006 — the application role cannot bypass RLS
```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
-- rolbypassrls must be false; the runtime role must not be the table owner
```

## AC-007 — the enumerating test fails the build
Deliberately remove a policy from one table and confirm the suite goes red. A green run with one
table unprotected must be impossible.

## AC-008 — the layer-1 test still passes independently
`majelishub`'s isolation suite proves its two layers separately; homeops must do the same. Removing
the RLS policies must still leave the repository-level predicate tests green — that is what proves
the two layers are independent.
