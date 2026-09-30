# Page 17 — Settings, users & access architecture

**Status:** Capability unavailable; `/settings` is a public, static explanation only. It reads no session, account, access, settings, or threshold data.

## Safe route

```text
GET /settings
  → static Next.js Server Component
  → explains that account/access management and editable settings are unavailable
  → no session resolution or protected-data read
  → no settings API call, form, mutation, audit write, or analytics event
```

This boundary is intentional: the current development auth actor is fake, production session resolution fails closed, user-account membership and editable settings have no authoritative store, and the existing thresholds route returns hard-coded constants. Rendering these as live account/configuration data would misrepresent the product.

## Data/action matrix

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Availability notice | documented implementation/policy boundary | none | static `/settings` page | no protected scope | **Informational only** |
| Current user/account details | no account profile model | none | none | none | **Not shown** |
| Current roles/effective permissions | code-level role map, not principal assignment | none per user | none suitable for safe display | no verified account scope | **Not shown** |
| Organization/outlet access | operational operator/stall links only; no auth membership model | no user membership rows | none | no access-management scope | **Not shown** |
| Application thresholds/settings | GET endpoint returns code constants only | none | `/api/v1/config/thresholds` is not called | `config:view` only on the separate endpoint | **Not shown** |
| Save settings | no supported settings contract/use case | none | none | `config:manage` action alone is not a write implementation | **Not shown** |
| Invite/role/outlet assignment/revoke | no account access mutation service | none | none | no mutation authorization/resource scope | **Not shown** |

## Authorization and persistence truth

- The route serves no account-specific or configuration data, so it does not imply the fake development session is a real user and does not need to authorize nonexistent data.
- `resolveSession()` returns a fabricated actor in non-production development and `null` in production. The settings page does not call it or expose the actor.
- `GET /api/v1/config/thresholds` remains a separate, read-only, hard-coded response and is explicitly excluded from this page.
- `StoredAssignment` is an operator-to-stall operational assignment, not an authenticated user's organization/outlet membership.
- `AuthPort.revokeSession` and `revokeDevice` are fake no-ops; no revoke controls are exposed.
- No form, input, button, settings write endpoint, access mutation endpoint, audit write, or Page 17 analytics is present.

## Activation dependency

A full settings/access slice requires a production session provider; durable account/profile and membership/role/access data; an effective-permission read model; explicit tenant/outlet policy; supported editable settings with validation; authorized use cases and repository writes; append-only audit behavior; safe settings/access analytics; and tests for unauthenticated, authorized, unauthorized, cross-scope, invalid-write, persistence, reload and restart behavior. Do not add administration controls before those exist.
