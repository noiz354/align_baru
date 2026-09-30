# Page 06 — Expenses gap report

**Updated:** 2026-09-30
**Overall:** `NOT DONE` — implementation and local checks exist, but canonical browser/runtime acceptance is incomplete.

## Implemented in this slice

- Scoped, bounded list/detail read models deriving outlet, business day, and cash impact from persisted expense/shift/stall data.
- Server-validated create endpoint with organization/shift/scope checks, supported category and positive integer amount validation, open-shift requirement, required idempotency key, actor derivation from stored shift, persistence, and audit event.
- Scoped detail route; direct out-of-scope records are hidden. Reviewer capability is server-derived.
- Review route for supported transitions, required reason, idempotency, reviewer scope, submitter self-review denial, persisted review metadata, and audit event.
- `/expenses` list, filters, real empty/list states, create flow from accessible open shifts, cash-source choice, optional note, and detail links; `/expenses/[expenseId]` shows detail and conditionally exposes authorized review actions.
- Coarse analytics events via existing Pino logging; request/status/filter only, no free text, amount, identity, or evidence.
- Automated read-model, domain/service, and API boundary tests (part of the passing 27-file, 133-test full suite).

## Genuine gaps / constraints

| Gap | Impact | Next evidence or decision |
|---|---|---|
| No browser binary/E2E runtime here | UI creation/review interactions, browser console, and responsive behavior have not been verified. | Run the expenses journey in a browser-capable environment, inspect console, record evidence. |
| Production authentication is only a development fake | Production protected routes fail closed; no real login/role runtime can be demonstrated. | Integrate the canonical production session provider in its owning task/platform layer; do not bypass auth for demos. |
| Current storage is a single-process JSON-backed map | Restart durability was shown locally, but concurrent writes, multi-instance deployments, SQL durability, and migration behavior are not proven. | Keep pilot boundary explicit; validate repository consistency/production adapter separately. |
| Region-to-outlet membership is absent | Region-scoped expense and shift reads fail closed (empty). | Add authoritative region membership only when canonical data support exists. |
| Evidence lifecycle is absent | Attach/view is omitted; the page explicitly labels evidence unavailable. | Add a real authorized upload/metadata/storage lifecycle before exposing evidence controls. |
| No true analytics warehouse/SDK | Coarse event evidence is structured server logging only. | Keep the existing logger for this slice; downstream analytics ingestion is a platform gap, not implemented here. |
| List presents bounded first 50 rows without a next-page control | Data beyond the first page cannot be browsed from this UI yet. | Add navigation/infinite loading if canonical acceptance requires full history; the API pagination is bounded and exposes total. |

## CI/local gate results

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 27 files / 133 tests.
- `npm run build`: PASS; Next.js route output includes both expense pages and all three expense API endpoints.
- `npm run check:docs`: FAIL due to dangling ground-truth references for pages 01–04 and 07–17; page 06's required documents are present. This is outside the current page's scope.
- `npm run check:stubs`: FAIL across a large repository-wide set of implemented code that its Phase-0 stub policy expects to remain unimplemented; it flags expense routes/pages as well as unchanged shared and unrelated files. Satisfying it for page 06 would contradict the canonical instruction to implement this slice. No remote CI run was triggered.

The separate `/hq/expenses` surface remains the audited sample/inert page and was not redesigned as part of the `/expenses` slice.

## Security notes

- Expense and shift scope derive from session plus persisted relationships, never client organization/operator fields.
- Region fails closed; cross-tenant/cross-scope direct detail reads return not found.
- Review reason is returned only when the server grants review capability.
- `PERSONAL` expenses do not reduce expected cash; rejected/reviewed status does not alter cash history.

Do not mark `TASKS.md` done or call this page complete until the missing browser evidence and all applicable canonical criteria are proven.
