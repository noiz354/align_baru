# ADR-0015: Authentication via Better Auth (planned)

- **Status:** Accepted (deferred)
- **Date:** 2026-09-26
- **Slice:** VS-17
- **Area:** Security
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Operators reliably have phones and phone numbers but not passwords. HQ roles handle money and need stronger factors. Auth.js/NextAuth has been in security-patch-only maintenance since September 2025, so it is not the right greenfield base.

## Decision

Adopt Better Auth when authentication is implemented (VS-17): phone + OTP with long-lived sessions for operators; password/passkey plus mandatory TOTP for HQ Finance and Owner; server-side session revocation; supervisor-assisted recovery for operators. Phase 0 defines only `AuthPort` and `SessionContext` interfaces with a fake provider that is impossible to enable in production.

## Consequences

Positive: typed sessions, plugins, users in our own Postgres, no per-MAU vendor cost, predictable data residency. Negative: younger ecosystem than Auth.js; pin versions and read release notes before minor upgrades.

## Alternatives considered

Auth.js (rejected: maintenance mode); Clerk (rejected: hosted user store, per-MAU cost, data residency); Supabase Auth (rejected: not our stack); Keycloak (rejected: heavyweight); custom JWT/session code (rejected: risk in a cash system).

## Compliance impact

Session data minimised; OTP abuse limited by rate limits; breach response supported by revocation APIs (UU PDP 72-hour notification readiness).

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
