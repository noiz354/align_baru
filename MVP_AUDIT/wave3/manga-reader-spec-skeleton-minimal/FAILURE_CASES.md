# Minimal Reader Wave3 FAILURE_CASES

## 1. Unauthenticated progress access is rejected

- **Input:** GET or PUT `/api/v1/progress` without a valid session cookie.
- **Observed:** `401`; no progress row is read or written.

## 2. Page outside the seeded chapter range is rejected

- **Seed:** `ch-001` has 12 pages.
- **Input:** authenticated PUT with `pageNumber: 13`.
- **Observed:** `422`; the value is not clamped or persisted. Valid page 4 restores normally.

## 3. Another user's identity cannot be selected by request data

- **Input:** User B reads/writes progress while supplying A's `userId` in the query/body.
- **Observed:** the server scopes progress to B's authenticated session. B's saved page remains 1 and A's page remains 4, including after logout/login and restart.

The runtime proof contains no session tokens or runtime database files.