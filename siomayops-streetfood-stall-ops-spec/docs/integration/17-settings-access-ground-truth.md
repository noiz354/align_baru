# Page 17 — Settings, users & access ground truth

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/17-settings-access.md`
**Target:** `/settings`
**Audit boundary:** task/spec, routes and APIs, auth/RBAC, audit, domain, memory persistence, SQL schema, tests and settings-related docs inspected before Page 17 source edits.

## Current implementation truth

| Capability | Status | Evidence / boundary |
|---|---|---|
| `/settings` page | **INFORMATIONAL ONLY** | `src/app/settings/page.tsx` displays an unavailable-capability notice; it reads no session or settings data and exposes no controls. |
| Real authenticated user identity | **UNSUPPORTED** | `AuthPort.resolveSession()` fabricates a configurable development actor outside production; in production it returns `null`. No production session adapter or account identity record exists. `SessionContext` has opaque IDs, role list and scope only, not a resolved account profile. |
| Roles and authorization vocabulary | **PARTIAL** | `Role`, `Action`, `ROLE_PERMISSIONS` and `authorize()` exist in `src/server/auth/port.ts`; the permission matrix is in `docs/security/PERMISSIONS.md`. The role map is code, not per-user persistent membership/permission data. |
| Current role/permission read model | **MISSING** | There is no endpoint/service that returns the authenticated principal's safe profile and effective permissions for a settings page. Internal role constants are not a user directory or persisted permission assignment. |
| Organization/outlet membership for users | **MISSING for user access management** | `SessionContext` includes organization and a scope claim; operational `StoredAssignment` relates operators to stalls. There is no user membership/role-assignment entity, user-to-outlet access repository, or user-access API. Do not reinterpret operator-to-stall assignments as login membership. |
| App settings model/store | **MISSING** | No settings/config entity or durable settings repository is present in `memory-store.ts` or the SQL schema. |
| Existing thresholds endpoint | **PARTIAL / NOT AUTHORITATIVE** | `GET /api/v1/config/thresholds` checks a dev session and `config:view`, but returns source-code constants directly. It has no read-model, durable store or write endpoint. It is not evidence of persisted application settings and is not suitable for editable settings UI. |
| Settings mutations | **MISSING** | No validated settings write contract, config use case/repository, mutation endpoint, or supported settings action exists. Do not add an editor that only changes local state. |
| Role/user access mutations | **MISSING** | There is no user invite/account lifecycle, role assignment or revocation persistence/API. `operator:manage` and `assignment:manage` describe operational operator/stall workflows, not login account permission administration. |
| Session/device revocation | **PARTIAL / FAKE ONLY** | `AuthPort` has `revokeSession` and `revokeDevice`; the current fake implementations are no-ops, with no durable session registry or management page. |
| Audit | **PARTIAL** | Generic append-only audit writer and `config.changed`, `auth.session_revoked`, and `auth.device_revoked` action names exist; no supported settings/access mutation path invokes these for persisted state. |
| Analytics | **MISSING / NOT EMITTED** | No Page 17 view or settings/access action is implemented. No settings/access events should be emitted from the explanatory page. |
| Production authorization | **PARTIAL / FAIL-CLOSED** | Protected APIs resolve session and apply `authorize()`, but `resolveSession()` returns `null` in production until a real provider is implemented. No browser account boundary exists. |
| Persistence/restart proof | **MISSING for settings/access** | Generic app data is file-backed in development and Drizzle describes SQL, but neither store contains user-access settings or a settings domain. The existing thresholds response is hard-coded and cannot prove persistence. |

## Page-data matrix (actual current sources)

| UI field/action requested | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Current user/profile | `SessionContext` claims only; fake in dev, absent in production | none for account profile | no page read endpoint | no account scope | **UNSUPPORTED** |
| Effective roles/permissions | Code-level `Role`, `Action`, `ROLE_PERMISSIONS`, `authorize()` | code constants only; no user-role records | no safe current-principal read endpoint | org scope claim only | **PARTIAL; not rendered as a user's effective access** |
| Organization/outlet access | Organization claim and operational operator/stall assignments | no user membership or role-to-outlet store | no account membership read endpoint | no access-management scope | **MISSING** |
| App settings | No settings aggregate | none | thresholds GET only returns hard-coded constants | config:view on fake dev session | **UNSUPPORTED as editable/persisted settings** |
| Change settings | none | none | no write route | `config:manage` exists only as an authorization action | **MISSING** |
| Change user roles/outlet assignments | none for auth users; operational operator/stall assignment is separate | no auth membership relation | no access mutation route | no user access scope | **MISSING** |
| Revoke account/device sessions | `AuthPort` method names only | no session/device registry | no management entrypoint; fake no-op | no persisted session scope | **UNSUPPORTED** |

## Data and safety boundary

The page must not consume default `FAKE_AUTH_ROLE`, hard-coded user/org IDs, the thresholds endpoint's source-code constants, seed identities, or operational operator/stall assignments as though they were real account settings. Do not add an invite, role picker, outlet access editor, threshold editor, revoke button, or fake success state without a production-backed use case and authorization policy.

A static explanatory route may state that account, access and editable settings management are not available. It reads no session or protected resource and makes no claim about a user's effective roles or permissions. Page 17 remains **NOT DONE**.

## Persistence inventory

```text
AUTHORITATIVE STORE: none for user accounts, memberships, per-user roles, or app settings
READ PATH: hard-coded constants only in GET /api/v1/config/thresholds; no settings read model
WRITE PATH: none for settings or account access
PRIMARY KEYS: none for settings/access aggregates
FOREIGN/DOMAIN RELATIONSHIPS: operational operator→stall assignment exists; user→organization/outlet role membership does not
INDEX/LOOKUP NEEDS: not designed
RESTART DURABILITY: not applicable—no persisted settings/access resources can be changed
AUDIT: generic event infrastructure exists; no settings/access mutation flow
ANALYTICS: no Page 17 events emitted
```

## Evidence limits

This is a source/policy audit, not proof of a production identity provider or account store. A local successful route response proves only the static notice is available, not authentication or settings functionality. Do not mark Page 17 or any project task DONE from the notice alone.
