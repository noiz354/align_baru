# Yomi — Error Model

**Status:** canonical. One rule, one table, no invented codes.

Authority: `src/shared/contracts/errors.ts` (the codes) and `API_CONTRACT.md` §6
(the table). **Inventing a code requires updating §6 in the same change** — that is a
hard CI rule, not a preference. Batch 2 added two codes and updated §6 in the same
commit; that is the pattern.

## 1. The rules

1. **Every error a client can provoke has a code.** A bare `throw new Error` reaching
   a client is a defect, not a fallback.
2. **A code's status is fixed by the §6 table.** The same condition always answers
   the same way, whatever route raised it.
3. **Validation failures carry a path.** `{ details: [{ path, message }] }`, so a
   form can put the message on the field.
4. **Refuse, never repair.** An over-long note is refused (NFR-SEC-016), not
   truncated. An undecodable cursor is refused, not parsed leniently. A page past
   `page_count` is refused, not clamped at the service boundary it belongs to.
5. **No internal detail leaks.** No stack, no vendor text, no internal id, no SQL.
6. **A boot failure is a 500, not a lie.** `loadEnv()` refusing `http://` in
   production is correct, and a route turning that into a §6 500 rather than a
   misleading 200 is also correct. This is the behaviour that made 4 phantom test
   failures look like a media defect; F-022 removes the confusion at the harness.
7. **An unimplemented path throws `Not implemented: T-…`.** A skeleton is honest.
   It must not be reachable in a way that masquerades as working.

## 2. The §6 codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_BAD_QUERY` | 400 | Query or body is not the expected shape |
| `AUTH_REQUIRED` | 401 | No session, or the session is unusable |
| `FORBIDDEN` | 403 | Authenticated, not permitted (e.g. a member on an admin route) |
| `NOT_FOUND` | 404 | The resource does not exist, or is not visible to this caller |
| `CONFLICT` | 409 | The state conflicts (a duplicate bookmark page) |
| `VALIDATION_FIELD_INVALID` | 422 | Well-formed but semantically invalid (**added Batch 2**) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected. Nothing is leaked. |
| `STORAGE_ERROR` | 502 | Object storage unreachable or rejecting. `Retry-After` set. |
| `DB_ERROR` | 503 | Database unavailable |
| `MANGA_NOT_FOUND` | 404 | No such manga, or not published (**added Batch 2**, §5) |
| `CHAPTER_NOT_FOUND` | 404 | No such chapter, or not published (**added Batch 2**, §5) |
| `READER_INVALID_PAGE` | 400 | Page out of range for the chapter |
| `LIBRARY_BOOKMARK_NOT_FOUND` | 404 | Not the caller's, **or** not there — one answer (**added Batch 2**, §5) |
| `SERVICE_UNAVAILABLE` | 503 | A dependency is down |

## 3. Codes §6 needs but does not have

Found while planning; each is added in the slice that needs it, together with its §6
row. None is invented early.

| Code | Needed by | When |
|---|---|---|
| `DUPLICATE_REGISTRATION` — or a uniform success response | F-003 | Must not distinguish "email taken" ([SECURITY.md C-4](SECURITY.md)) |
| `EMAIL_NOT_VERIFIED` | post-MVP | If verification is ever required |
| `UPLOAD_INVALID_MEDIA` | F-017 | Wrong type, unreadable, or over size |
| `UPLOAD_JOB_NOT_FOUND` | F-017 | Only if the job pipeline is ever restored |
| `NAME_TAKEN` (admin) | F-016 | Chapter number collision within a manga |

## 4. Status-mapping rules that are easy to get wrong

| Situation | Wrong | Right |
|---|---|---|
| Unknown `mangaId` on add-to-library | 500 from an FK violation (23503) | `MANGA_NOT_FOUND` 404 — **restored in Batch 2** |
| Unknown `chapterId` on bookmark | 500 from an FK violation | `CHAPTER_NOT_FOUND` 404 — **restored in Batch 2** |
| `pageNumber` past `page_count` | stored anyway | `READER_INVALID_PAGE` 400 — **restored in Batch 2** |
| Another reader's bookmark id | 200, or a distinct 404 | same 404 as "not there" — `LIBRARY_BOOKMARK_NOT_FOUND` |
| Malformed media key | 422 (leaks the key format) | 404 (leaks nothing) |
| Storage down | 200 with an empty body, or vendor XML | `STORAGE_ERROR` 502 + `Retry-After`, nothing else |
| Anonymous on a member route | empty list (looks like a reader with no titles) | `AUTH_REQUIRED` 401 |
| Stale progress write | applied | rejected, silently, by the LWW guard |
| Undecodable search cursor | repaired, or a 500 | refused, 4xx |

The first three were all introduced by the direct-database → service refactor and all
three are restored in Batch 2, each with a test. They are the general lesson:
**rewiring a route through a service is exactly when a check that used to fall out of
a row you were already reading disappears quietly.** F-006 must be reviewed for the
same class of loss.

## 5. Codes added in Batch 2 (`7af4e6a`)

`LIBRARY_BOOKMARK_NOT_FOUND` and `VALIDATION_FIELD_INVALID`, with the §6 table and
`tests/unit/error-contract.test.ts` updated in the same commit. The first exists so a
bookmark belonging to somebody else is indistinguishable from one that does not
exist; the second so a semantically invalid field is not reported as a malformed
request.

## 6. What is still inconsistent

| Issue | Where | Fix |
|---|---|---|
| `requireUser` throws a bare `Error`, not an `AppError` | `server/auth/guard.ts:43` | F-002 |
| Four services + `PasswordHasher` + `AuditSink` have no implementation, and `PLANNED_REPOSITORIES` does not list them | `server/db/repositories/index.ts:100` | F-023 |
| `notFound` in `api/_deps.ts` covers four distinct conditions behind one shape | Batch 2 | Acceptable now; revisit when `ADMIN_JOB_NOT_FOUND` is needed |
| 13 test suites are skipped, so their assertions never run | vitest | F-023 |
