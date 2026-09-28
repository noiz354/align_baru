# SECURITY

This document is the **contract**. Every rule here is traceable to a defect that was measured on
`8ebc15f`, or to a control that already works and must not regress.

## 0. How a security claim is proved

A claim is proved only by a **behavioural** test. A test that reads source text does not count.

```ts
// NOT evidence
expect(readFileSync("route.ts", "utf8")).toContain("requirePermission");

// Evidence
const res = await fetch(`${base}/api/thing`, { headers: { "x-thing-user": "someone" } });
expect(res.status).toBe(401);
```

`majelishub`'s `permissions.test.ts` is currently the first form, and that is precisely how
`GAP-P0-MAJ-01` reached `main`. `F-005` replaces it.

## 1. Identity

| Rule | Status today | Enforced by |
|---|---|---|
| **S-1.1** The identity of a request is derived from a server-held session only. Never from a header, a query parameter, a cookie the client may set freely, or a default. | **BROKEN** in majelishub (`x-majelishub-user`, `?userId=`, default `majelishub-jakarta-admin`) and homeops (`x-homeops-household`, `?householdId=`) | `F-005`, `F-002` |
| **S-1.2** No default identity exists in any build. There is no fallback user, no seeded operator that can be assumed, no `DEFAULT_ORG_ID` that authorises. | **BROKEN** in siomayops (returns `HQ_OPS` when nothing is presented) and majelishub (`"majelishub-jakarta-admin"`) | `F-001`, `F-005` |
| **S-1.3** Absent, expired or unverifiable session → `401`, and no tenant data is read first. | Correct in majelishub's `organizations`, `mosques`, `checkin/summary`, `checkin/validate`; correct in `manga`'s `progress`; absent in homeops | `F-002` |
| **S-1.4** Identity in a real deployment must survive a restart. | **BROKEN** in manga (sessions are an in-memory `Map`); correct in majelishub (Better Auth + `sessions` table) | `F-017` |
| **S-1.5** `pseudonymous` identity chosen by the user is acceptable **only** if the design says so and it is not used as an authorisation token. | Correct in strangerlink; its `SAFETY.md` forbids unrestricted anonymous design | — |

## 2. Tenant isolation

| Rule | Status today | Enforced by |
|---|---|---|
| **S-2.1** Every tenant-scoped read and write goes through a context derived from the session. A tenant id is never taken from caller input. | **BROKEN** in homeops (all four data routes) | `F-002` |
| **S-2.2** The tenant is a **structural** parameter: a repository cannot be called without one. | Correct in majelishub (`TenantScope` first, type-enforced); **BROKEN** in homeops (`householdId: string`) | `F-002` |
| **S-2.3** The database enforces the boundary as a backstop, and the enforcement is provable: with the scope variable unset, the query returns **zero rows**, not all rows. | Correct in majelishub — measured `[]` with no scope, Org A only with scope. **Absent in homeops**: 0 of 17 tables have RLS. | `F-003` |
| **S-2.4** A missing scope fails closed **before any statement runs**. | Correct in majelishub (`assertScopeUsable`) | — |
| **S-2.5** A public projection may read tenant data only through an explicitly published projection, and only `PUBLISHED` rows. | **BROKEN** in majelishub — 4 public pages select directly, with no status filter; `DRAFT` rows are exposed | `F-006` |
| **S-2.6** Cross-tenant access is `404`, never `403`, so existence is not disclosed. | Correct in majelishub's matrix and repositories; **BROKEN** in homeops (`200` with the other household's rows) | `F-002` |
| **S-2.7** A new tenant-scoped table is created **with** its RLS policy in the same migration, and a test fails if any tenant table lacks one. | **BROKEN** — `drizzle/0005_registrations.sql` created two tenant tables with no policy; the isolation suite does not enumerate, despite `drizzle/0001` saying it does | `F-003` (pattern), majelishub follow-up |

## 3. Authorization

| Rule | Status today | Enforced by |
|---|---|---|
| **S-3.1** The server decides. UI hiding is never a control. | Correct in all six; homeops's `authorize.ts` exists but has zero callers, so nothing is decided at all | `F-002` |
| **S-3.2** Permission is a data-driven matrix, and every cell has a test. | Correct in majelishub (9 × 53, all cells) and siomayops (8 roles; matrix sound, session broken) | preserve |
| **S-3.3** A capability is granted by a route **only** through `requirePermission` (or an equivalent), or the route is on the public list with a written reason. | Declared in majelishub's `public-routes.ts`; **enforced by string search**, so two header-authenticated routes pass | `F-005` |
| **S-3.4** Fail closed on an unknown permission key, on no roles, and on an absent session. | Correct in majelishub; each of the three has a named test | preserve |
| **S-3.5** Self-approval and self-escalation are refused; platform roles are not delegable. | Correct in majelishub (`assertCanGrantRoles`, tested) and siomayops (segregation of duties) | preserve |
| **S-3.6** Actions that change authorization require a recorded reason of at least 8 characters, and the reason is audited. | Correct in majelishub; siomayops requires reasons for override, review and variance | preserve |
| **S-3.7** An administrative surface refuses an unauthenticated and a non-privileged caller. | **BROKEN** in manga — 5 `/admin` pages, no check, `200` to anyone | `F-008` |
| **S-3.8** Authorization is checked **after** the resource is resolved but **before** tenant content is read. | Correct in majelishub's `checkin/*`; homeops reads nothing because it never authorises | `F-002` |

## 4. Capability and secret handling

| Rule | Status today | Enforced by |
|---|---|---|
| **S-4.1** A capability (token, code, QR) is disclosed only to the party entitled to it. | **BROKEN** in majelishub — a duplicate registration returns another attendee's `shortCode`, which is an accepted check-in credential | `F-012` |
| **S-4.2** A token is returned exactly once, at creation, in one field. | **BROKEN** in majelishub — `accessToken` and `qrPayload` both carry the raw token | `F-012` |
| **S-4.3** Tokens are stored hashed, never in plaintext, never in a URL, never in a log. | Correct in majelishub (`token_hash` column, `sha256`); the ban list is enforced at runtime and at lint | preserve |
| **S-4.4** A token payload carries no personal data and no entity ids. | Declared in `T-CHECKIN-003`; **not met** — the token is an opaque 64-hex string, which is acceptable, but the raw token is also returned as the QR payload, which is not | `F-012` |
| **S-4.5** A capability guess must be expensive and rate limited. | **BROKEN** — `POST /registrations` and `POST /checkin/validate` have no rate limit; short codes are 6 characters of a 30-symbol alphabet (~730M) and are accepted as credentials | `F-012` |

## 5. Money and integrity

| Rule | Status today | Enforced by |
|---|---|---|
| **S-5.1** A payment is `PAID` only on verified provider evidence. Never on a client assertion, never on an offline replay. | Correct in siomayops — `verifyProviderCallback` uses HMAC-SHA256 + `timingSafeEqual`, and QRIS without verified settlement raises. Also correct in parking, which refuses to close a lost-ticket session on QRIS. | **preserve — this is the model** |
| **S-5.2** A mutating money operation is idempotent, and the key is **required**. | Partial in siomayops — `_helpers.ts` executes the mutation when `Idempotency-Key` is absent | `F-009` |
| **S-5.3** Money is integer minor units. No float arithmetic. | Correct in siomayops and parking | preserve |
| **S-5.4** The audit trail is append-only, hash-chained, and written in the same transaction as the change. | Correct in majelishub and parking; **not applicable** to siomayops, whose audit is in memory and therefore lost | `F-010` |
| **S-5.5** A clock used for pricing is monotonic and tamper-evident. | Correct in parking (`ClockTamperError`) | preserve |
| **S-5.6** Cash variance is never auto-adjusted; a reason is required. | Correct in siomayops and parking | preserve |

## 6. Data protection

| Rule | Status today | Enforced by |
|---|---|---|
| **S-6.1** A database error is never rendered as an empty result. | **BROKEN** in majelishub — `catch { events = [] }` | `F-006` |
| **S-6.2** Internal detail (SQL, stack, parameters, other tenants' ids) never appears in a response. | **BROKEN** in homeops — a room request returned the full Drizzle error text and query parameters in the body | `F-002` |
| **S-6.3** A public endpoint never returns an attendee list. | Correct in majelishub's registration response; **correct-but-unguarded** in `checkin/summary`, which does return attendee emails and is session + `attendance.read` gated | preserve |
| **S-6.4** Personal data is minimised, and deleted or masked on the documented schedule. | Correct in parking (plate masking, 30-day photo purge) | preserve |
| **S-6.5** Secrets come from the environment and are never committed. | Correct in all projects; `.env.example` holds placeholders only | preserve |

## 7. Abuse and durability of safety controls

| Rule | Status today | Enforced by |
|---|---|---|
| **S-7.1** A ban, a report, and a moderation decision survive a restart and a deploy. | **BROKEN** in strangerlink — all four safety stores are process `Map`s | `F-013` |
| **S-7.2** A public write endpoint is rate limited per identity. | **BROKEN** in majelishub registration; siomayops has a durable rate limiter (majelishub too) but it is not applied on the public route | `F-012` |
| **S-7.3** Repeated scanning of a check-in code converges to one attendance row. | Correct — unique index on `registration_id`; but **untested** | `F-012` |
| **S-7.4** A session for a high-risk physical action (an entrance volunteer's device) is bound to a device and an event. | **NOT_IMPLEMENTED** — `T-CHECKIN-016`; a `VOLUNTEER` role is correctly denied until a binding exists | Wave 2 |
| **S-7.5** Credentials are rate limited on the issuing path, durably. | Correct in majelishub (Postgres-backed counters, `drizzle/0003`); siomayops lacks an auth path to apply it to | `F-001` |

## 8. Process rules

| Rule | Why |
|---|---|
| **S-8.1** A security control without an executing test does not exist. | `x-majelishub-user`, `?householdId=`, and the siomayops guard all reached `main` because no test asserted that an unauthenticated request fails. |
| **S-8.2** A gate that nothing runs is worse than no gate, because a README will cite it. | `verify:vs0` is documented and absent; siomayops' `check:stubs` and `census` are red; manga has no lint; strangerlink's `lint` exits 127; CI runs lint for one project out of five. |
| **S-8.3** Completion evidence is produced on the production stack: real PostgreSQL, real driver, production build. | PGlite skipped `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY`, and hid a driver divergence in the audit chain. |
| **S-8.4** A security fix lands with its regression test in the same change. | Non-negotiable for every `F-0xx` below. |
| **S-8.5** Changing a rule in this document requires an ADR. | These rules are the interface between the projects and the next agent. |

## 9. Standing verification

Run after every Wave 0 and Wave 1 change. Any non-zero is a blocking regression, not a warning.

```bash
# unauthenticated access is refused, everywhere, for real
# siomayops
npm start &  sleep 10
for r in sales audit shifts incidents stock; do
  test "$(curl -s -o /dev/null -w %{http_code} "localhost:3200/api/v1/$r")" = 401 || echo "FAIL $r"
done
# homeops
curl -s -o /dev/null -w '%{http_code}\n' "localhost:3101/api/homeops/rooms?householdId=<any>"   # must be 401
# majelishub
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'x-majelishub-user: anyone' "localhost:3102/api/majelishub/organizations/<org>/events"      # must be 401
# manga
curl -s -o /dev/null -w '%{http_code}\n' localhost:3110/admin                                      # must be 401
# database
psql -c "select relname from pg_class where relkind='r' and relrowsecurity"                        # must be non-empty for homeops
```
