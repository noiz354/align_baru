# Page 13 — Runtime and verification evidence

**Status:** Automated checks and localhost HTTP/dev-server restart proof completed against an isolated file-backed fixture; browser acceptance and production gates remain open. No browser acceptance is claimed.  
**Date:** 2026-09-30 (Asia/Jakarta)

## Checks run

| Command | Result | Notes |
| --- | --- | --- |
| `corepack pnpm typecheck` | PASS | TypeScript project check |
| `corepack pnpm exec vitest run tests/unit/incident-report.test.ts tests/integration/incident-report-api.test.ts tests/integration/incident-offline-sync.test.ts` | PASS — 3 files, 12 tests | Focused domain/contract, auth/scope, idempotency, audit/analytics redaction and offline path |
| `corepack pnpm test` | PASS — 41 files, 203 tests | Full local Vitest suite |
| `corepack pnpm build` | PASS | Optimized Next.js production build; Next warned that no Next.js ESLint plugin was detected |
| `corepack pnpm lint` | PASS (exit 0) | Current ESLint config only declares ignore paths; it installs no lint rules/plugin, so this is not meaningful lint coverage |
| `corepack pnpm check:docs` | FAIL, unrelated dangling references | Page 13's required artifacts are present; failures are for missing ground-truth files for pages 01–04 and 14–17 |
| `corepack pnpm check:stubs` | FAIL, repository-wide Phase 0 marker/stub policy | Reports many existing implemented modules and also the newly implemented incident routes as violating a Phase 0-stub expectation; inconsistent with this page's implementation prompt. No attempt was made to hide or rewrite that repository policy. |

The integration tests call route handlers with `NextRequest`; they are not live HTTP or browser tests. No remote CI was triggered.

## Isolated local HTTP and restart proof

The dev server ran on port 3000 with development fake-auth actors and an isolated file (`SIOMAYOPS_DATA_FILE=/tmp/siomayops-incident-runtime.json`). The file contained synthetic operator/shift/site fixtures only; the submitted narrative was marked as a runtime acceptance test. No user/business data was used.

Command shape:

```sh
FAKE_AUTH_ROLE=OPERATOR \
FAKE_ORG_ID=10000000-0000-7000-0000-000000000061 \
FAKE_OPERATOR_ID=30000000-0000-7000-0000-000000000061 \
SIOMAYOPS_DATA_FILE=/tmp/siomayops-incident-runtime.json \
corepack pnpm dev --hostname 0.0.0.0 -p 3000
```

Observed results:

1. `curl http://localhost:3000/operator/incidents/new` → **HTTP 200**, Next page shell returned. This curl does not execute browser JavaScript and is not UI/browser acceptance.
2. `GET /api/v1/incidents` as the seeded operator → **HTTP 200**; server returned the seeded operator name, active stall code, current site name, `locationLinked=true`, empty report list, `evidenceUploadStatus=UNSUPPORTED`, and no actor ID/GPS fields.
3. `POST /api/v1/incidents` with a valid UTC `Z` timestamp, neutral category, P2 self-hint, bounded narrative, IDR 50,000 / `REQUESTED`, and matching `Idempotency-Key` → **HTTP 201**; response status was `SUBMITTED`, with reported amount and current site name, and no `operatorId` field.
4. Re-read `GET /api/v1/incidents` → **HTTP 200**, one report in the self list.
5. Invalid event time ten minutes in the future → **HTTP 400** with `VALIDATION_FAILED`; the isolated file still contained one incident.
6. Stopped and restarted the server against the same file as a different seeded operator in the same organization. List read returned **zero** reports; direct `GET /api/v1/incidents/{savedId}` returned **HTTP 404**.
7. Stopped and restarted as the original reporter. The list returned the same saved report and amount; direct detail returned **HTTP 200**. This demonstrates local file-store restart persistence only.
8. Restarted with `FAKE_AUTH_ROLE=HQ_OPS`: list and POST each returned **HTTP 403**, and the persisted incident count remained one.
9. Process logs showed `incident_report_started`, `incident_submitted`, and `incident_submit_failed` with coarse event/page/requestId/outcome or reason fields. The inspected analytics entries did not contain the submitted narrative or amount. A first harness POST mistakenly used `+00:00` rather than the contract's UTC `Z` timestamp and correctly received HTTP 400; the corrected `Z` request succeeded.

This was a localhost HTTP smoke/restart check using the development fake session and local JSON file. It does not prove production identity, SQL schema rollout, transaction/concurrency safety, retention or backup deletion.

## Still pending

- Actual browser flow and user/laptop acceptance, including hydrated form rendering, keyboard/screen-reader/contrast/mobile behavior, client retry after a lost response, and browser console inspection.
- Production auth and durable database migration/repository tests.
- Production retention/deletion, backups, DSAR and full lifecycle/HQ response.
- Evidence upload remains unsupported by design; no evidence-added event was expected or asserted.
- Remote CI and any browser runtime test. Repository-wide `check:docs`/`check:stubs` failures are listed above rather than passed off as successful gates.
