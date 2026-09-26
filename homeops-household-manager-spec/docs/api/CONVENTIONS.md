# API Conventions

> Companion to API.md (the operation surface) and docs/domain/ERRORS.md (the error vocabulary). Everything here is normative for both Server Actions and route handlers.

## 1. Two transports, one contract

| Transport | Used for | Why |
| --- | --- | --- |
| **Server Actions** | All household-facing mutations and reads triggered by the UI | No hand-written API layer; progressive enhancement; typed end-to-end; CSRF protection from the framework |
| **Route handlers** | `/api/health`, `/api/cron/[job]`, `/api/push/subscribe`, `/api/attachments/[id]` | Things that are not user-initiated or are not JSON-in/JSON-out (health probes, scheduler triggers, push endpoints, binary serving) |

No public REST/GraphQL API in v1 (ADR-002). If an integration is ever needed, it gets its own ADR — not an accidental endpoint.

## 2. The envelope

Every mutating call returns an `OperationResult<T>`:

```ts
type OperationResult<T> =
  | { ok: true;  data: T; meta?: { clientRequestId?: string; deduped?: boolean } }
  | { ok: false; error: DomainError; meta?: { clientRequestId?: string } };
```

Rules: never throw for expected outcomes · never return `undefined` on failure · `data` is a DTO, never a database row with internal columns stripped ad hoc · every action validates its input with a Zod schema at the boundary before touching the domain.

## 3. DTO rules

- DTOs are defined once in `src/features/<feature>/dto.ts` and reused by components, actions, and tests.
- No `Date` objects cross the boundary: timestamps are ISO-8601 strings with offset; **dates** (a chore's due date, a service date) are `YYYY-MM-DD` strings interpreted in the household timezone.
- No enums as numbers; string unions only, matching PRD enums exactly.
- DTOs never contain another household's, or another member's private, data. Member DTOs expose `id`, `displayName`, `role`, `avatarInitials` — nothing about behaviour.
- Optional means "may be absent"; nullable means "no value, but the field is part of the shape". Be explicit.
- Every list DTO carries `nextCursor?: string` for keyset pagination — no offsets, no `hasMore` booleans.

## 4. Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Action file | `actions.ts` in the feature, exported per operation | `createRoomAction` |
| Action input | `<Operation>Input` | `CreateRoomInput` |
| DTO | `<Entity>Dto` / `<Entity>SummaryDto` | `RoomDto`, `ChoreOccurrenceSummaryDto` |
| Read model | `<Purpose>Snapshot` | `DashboardSnapshot` |
| Route handler | kebab-case path, verb in the method only | `POST /api/cron/evaluate-alerts` |
| Idempotency field | always `clientRequestId` (uuid v4) | — |

## 5. Idempotency

| Operation class | Key | Behaviour on replay |
| --- | --- | --- |
| Debounce-prone mutations (complete, mark full, restock, report issue, mark bought, record service) | `clientRequestId` (required) | Return the **original** success result with `meta.deduped = true`; never duplicate rows |
| Other mutations | optional | Natural keys (uniqueness constraints) do the work |
| Jobs | `pg_try_advisory_lock` + deterministic keys | Re-running is a no-op |

The key is stored per household for 24 hours with the resulting entity id and status. Never trust a client-supplied key for authorization — it only prevents duplicates.

## 6. Validation

1. **Shape** — Zod schema at the boundary (lengths, enums, formats).
2. **Business** — aggregate rules inside the domain (state legality, limits, ownership).
3. **Database** — constraints and partial unique indexes as the last line of defence.

Error mapping: shape → `VALIDATION_FAILED` with `details.fields`; business → a specific code from docs/domain/ERRORS.md; database violation → mapped to the corresponding business code (never leak SQL text).

## 7. Authorization

Every operation declares its authz rule in API.md and in docs/security/AUTHZ-MATRIX.md. The implementation:

```ts
const ctx = await requireHouseholdContext();        // session → household, never from payload
const authz = await authorizeOperation(ctx, op);    // role + membership + entity scope
```

Rules: the household id is **never** accepted from the client; isolation failures always surface as `NOT_FOUND`; HELPER restrictions are enforced server-side (UI hiding is a convenience, not a control); every role check has a negative test (T-SEC-003).

## 8. Rate limits

Applied at the operation boundary, keyed by `(householdId, memberId, operationClass)` in the database (survives restarts, works with multiple instances):

| Class | Limit | Notes |
| --- | --- | --- |
| Auth attempts | 10 / 15 min per identifier + IP | Also count failures only for lockout thresholds |
| Invitations | 20 / day per household | Prevents accidental spam |
| Mutations (general) | 120 / min per member | Far above human speed; stops scripts |
| Photo uploads | 30 / hour per member | Plus size/count limits |
| Test notifications | 3 / day per member | User-visible limit |
| Exports | 2 / day per household | Irreversible-ish operations |
| Cron triggers | 30 / min per secret holder | Protects the scheduler endpoint |

Behaviour on exceed: `RATE_LIMITED` with `retryAfterSeconds`; the copy never discloses the threshold.

## 9. Errors over the boundary

| Layer | Returns |
| --- | --- |
| Server Action | `OperationResult` (no throwing) — except invariant breaches, which throw and are mapped by the action wrapper |
| Route handler | HTTP status + JSON `{ error: { code, message } }`; identical codes as the domain catalogue |
| UI | Maps `code` → copy (DESIGN.md §10); unknown codes degrade to a generic message plus a correlation id |

`INTERNAL` responses always include a short correlation id shown to the member so support can find the log line — and the log line contains only ids (PRIVACY.md §5).

## 10. Versioning & evolution

- There is no public API version. Internal callers change together, in one commit.
- Additive DTO fields are safe; renaming or removing a field requires updating every caller and the tests in the same PR.
- Deprecations inside the app: remove in the same slice that migrates callers; no long-lived dual paths (ARCHITECTURE.md §3 simplicity budget).
- Domain error codes are **permanent** once released.

## 11. Caching & revalidation

- Server Actions declare `revalidateTag` for the read models they affect (per DATA_MODEL.md and ARCHITECTURE.md).
- No cross-request caching of authenticated reads; the app is single-tenant-per-session and correctness beats cleverness.
- Jobs never rely on cache invalidation for correctness — the dashboard re-reads.

## 12. Observability of the boundary

Every operation is wrapped by `withOperationSpan(op, fn)` producing a span (OBSERVABILITY.md §3) and a log line with: operation, outcome, duration, correlation id, and error code. No household names, member names, titles, or free text — ever (PRIVACY.md §5).
