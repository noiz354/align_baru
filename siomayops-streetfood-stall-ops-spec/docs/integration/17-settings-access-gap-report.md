# Page 17 — Settings, users & access gap report

**Decision:** NOT DONE. `/settings` is an informational unavailable page only. The app has no real production account/session provider, user access membership store, editable settings repository, or supported settings/access mutation.
**Ground truth:** `docs/integration/17-settings-access-ground-truth.md`
**Architecture:** `docs/integration/17-settings-access-architecture.md`

## Acceptance matrix

| Requirement | Result | Evidence | Remaining work / impact |
|---|---|---|---|
| `/settings` route | Informational notice only | Targeted UI test passed (2/2); optimized build includes static `/settings`; local HTTP GET returned 200 with security headers and no settings/control/fake-role payload | Canonical authenticated settings/account view is not delivered. |
| Current authenticated user | **UNSUPPORTED** | Development resolver fabricates a role actor; production `resolveSession()` returns null; no account profile store/API | Build a real session provider and account read model before showing identity. |
| Effective roles/permissions | **PARTIAL, not principal data** | Code-level `Role`, `Action`, `ROLE_PERMISSIONS` and `authorize()` exist | Persist and safely resolve roles per account; add current-principal projection and tests. |
| Organization/outlet access | **MISSING for user accounts** | Operational operator-to-stall assignments exist separately; no user membership relation | Define account membership/access domain, policy and durable scope checks. |
| App settings read | **UNSUPPORTED as authoritative data** | `GET /api/v1/config/thresholds` returns hard-coded values | Add authoritative settings model/store and scoped read model; do not present current constants as saved settings. |
| Supported settings write | **MISSING** | `config:manage` action exists, but no validated write endpoint/use case/repository | Define the approved editable fields, bounds, actor separation and persisted mutation flow. |
| User invite/role/access change | **MISSING** | No account lifecycle or access mutation endpoint/store | Requires access policy, authorization, audit and cross-scope tests. |
| Session/device revocation | **UNSUPPORTED** | AuthPort method names map to fake no-ops; no session registry | Implement provider-backed durable revocation before any controls are offered. |
| Audit | **PARTIAL** | Generic audit writer and event names exist; no Page 17 write path invokes them | Wire audited use cases only after supported mutations exist. |
| Analytics | **NOT EMITTED** | No settings view/action or persisted principal/settings read exists | Do not emit Page 17 events from this static notice. |
| Authentication/authorization | **PARTIAL / production fails closed** | Server-side helper + RBAC exist on other APIs, but production session adapter is unavailable | Implement real authentication and account/outlet-scoped role assignment before page data access. |
| Persistence/restart proof | **MISSING** | No settings/access entity or write path; thresholds are hard-coded | Persist and prove reload/restart durability for actual supported settings/access mutations. |
| CI/runtime | Static boundary checks only | Targeted render test, typecheck/build, and local HTTP smoke to be run | Cannot execute settings write, role change, cross-tenant, session-revocation, or persistence browser flows. |

## Stop conditions

- Do not display fake actor IDs, fake default roles, sample users, or seed organization/outlet assignments as the signed-in user's settings.
- Do not treat operational operator-to-stall assignments as user account access.
- Do not turn the thresholds endpoint's constants into an editable form or label them persisted settings.
- Do not expose role assignment, invitations, access revocation, session/device revoke, or local-state-only save controls.
- Do not create fake audit or analytics events for actions the page cannot perform.
- Do not mark Task 17, T-SEC-001, or other tasks complete by route presence alone.
