# Page 10 — GPS / Current Location Update gap report

**Status:** Feature code and local file-adapter verification are in place; canonical acceptance and production enablement remain **NOT DONE**.

## Remaining acceptance gaps

| Gap | Impact | Required follow-up |
|---|---|---|
| No successful browser/E2E session in this environment | Hydrated UI, real permission prompt, denial fallback, checkbox, and rendered post-save refresh have not been demonstrated in a browser | Run on a device/browser with geolocation and HTTPS permission support; inspect the browser console and mobile layout. The bundled Playwright browser download failed with CDN `ECONNRESET`. |
| No production authentication adapter | Production `resolveSession()` returns no session; only fake development actors were exercised | Integrate the approved production identity/session provider and rerun self-scope, tenant, and owner tests against it. |
| No production SQL migration/repository applied | Drizzle schema is declarative only; JSON memory store is the current authority | Create and review a backward-compatible production migration, wire the existing SQL repository pattern, and prove restart/deployment durability against the production store. |
| 14-day purge is opportunistic in the pilot adapter | Startup/API-entry cleanup does not ensure deletion exactly by day 14 if a process remains idle; production backups/replicas are not covered | Implement a reliable scheduled purge (at least daily), remove only raw GPS fields, verify replicas and backup expiry, alert on failures, and run retention evidence. This is a production gate. |
| Preliminary DPIA not approved | New personal work-location processing is not approved for production | Obtain privacy-owner/DPO review, finalize lawful basis/notice/access/rights assessment, and record approval before production activation. |
| No browser/device-level GPS accuracy or spoofing proof | The server can validate ranges/freshness but cannot establish sensor truth | Keep the fix advisory and show accuracy/time. Test representative Android browser behavior; do not use as proof of attendance or performance. |
| Repository-wide Phase 0 stub checker is not green | Existing checker policy flags broad implemented code paths and the project has known Phase 0 heuristic failures | Reconcile the repository-wide phase/checker policy in its own task. Page 10 is narrowly allowlisted; this slice does not claim `check:stubs` is green. |
| Docs/census repository checks retain unrelated baseline failures | `check:docs` has dangling references for Pages 01–04 and 11–17; `census` has orphan `NFR-SEC-021` references | Resolve in their owning tasks; do not fold unrelated pages into this slice. |
| Offline raw GPS queue intentionally unsupported | A Page 10 GPS sample is held only in volatile page memory until the explicit online report succeeds; existing sync does not persist GPS samples | Keep this limit explicit. If offline GPS support is later required, obtain a separate privacy/retention decision and design a bounded, encrypted, expiring queue before implementation. |

## Completed within this slice

- Optional foreground-only one-shot browser API helper; no watch/background/timer capture.
- Live Page 10 UI with current shift, self-scoped current point, area-bound picker, optional sample review and explicit attach confirmation, denial/manual fallback, and save result.
- Authenticated/self-authorized read/write boundaries and cross-operator/tenant/area validation.
- Strict coordinates/accuracy/timestamp contract; server-derived actor and shift context; idempotent report handling.
- Existing file-backed persistence, opportunistic GPS-only retention scrub, Drizzle schema shape, privacy-safe audit/analytics.
- Focused tests, complete local test suite, typecheck, lint, production build, and local file-adapter restart proof.

## Task state

Do not mark `T-LOC-004` done. Page 10 becomes `DONE` only after the remaining applicable runtime/browser evidence is supplied and the organizational production gates are separately approved. The explicit `GPS_LOCATION_SAMPLES_ENABLED` production flag must remain unset/false until the production authentication, storage, retention, backup, and DPIA gates are complete.
