# ADR-0005 — Better Auth for identity, sessions and organization membership

- Status: Accepted · Date: 2026-09-26 · Deciders: Security, Principal Architect
- Requirements affected: NFR-SEC-001, NFR-SEC-011, FR-ORG-002/005 · Related: ADR-0017, `SECURITY.md`

## Context

Three facts shape the auth decision:

1. **Participants must not need an account.** Registration is identified by a contact channel;
   check-in is authorised by an opaque token (ADR-0006). Building a user account into the
   participant flow would directly violate `DESIGN.md` §LOW FRICTION.
2. **Organizers are tenants.** A person may be an organizer at one mosque, a volunteer at
   another, and a speaker at a third. Membership and roles are **organization-scoped**, and a
   user may hold multiple roles.
3. **The platform is self-hostable.** Identity data (emails, phone numbers) must remain in our
   database and be deletable under UU PDP.

## Decision

Use **Better Auth 1.6+** as an in-application library with its **organization plugin** for
memberships/roles, sessions stored in our PostgreSQL, and passkey/MFA support available for
organizer and admin accounts. Participant-facing flows use **signed, short-lived contact
tokens** (`/pendaftaran/[token]`) that are authenticated as a *capability*, not as a user
account. Authorization remains ours: roles are mapped to permissions by
`docs/security/AUTHZ-MATRIX.md` and enforced server-side by our guards.

## Alternatives considered

- **Auth.js / NextAuth v5.** *Gains:* familiarity, huge install base. *Costs:* in
  security-patch-only maintenance since Sept 2025 under the Better Auth team, whose own docs
  direct new projects to Better Auth; organizations/roles would be hand-rolled. *Rejected for
  greenfield* (existing deployments are unaffected).
- **Clerk (hosted).** *Gains:* polished UI, fast start. *Costs:* per-MAU pricing at
  participant scale, identity data in a third-party US store (data residency and deletion
  complexity), vendor lock-in on the user table. *Rejected.*
- **Supabase Auth.** *Gains:* RLS-native. *Costs:* only justified if the deployment already
  runs Supabase; adds a second data platform with its own backup model. *Rejected.*
- **Roll our own sessions and passwordless codes.** *Gains:* total control, tiny dependency.
  *Costs:* cryptographic session handling, replay protection, passkeys, MFA, token rotation,
  and rate limiting — a large security surface we would own forever. *Rejected.*

## Consequences

**Positive:** users live in our Postgres (export/delete trivial); organization membership and
role model ship with the library; sessions can be revoked; no per-user cost; participants need
no account.

**Negative:** the library is younger than Auth.js (v1.0 late 2024, v1.6 in 2026) — mitigated by
pinning and reviewing release notes before upgrades; enterprise SSO (SAML/SCIM) is not native
and would be custom work if a university/enterprise deployment is ever needed.

**Neutral:** its **default rate limiter is in-memory and resets on deploy** — unacceptable in
production; a durable limiter must be configured (`SECURITY.md` §Rate limiting).

## Enforcement

- Authorization is enforced by our guards on every route/action; Better Auth answers "who is
  this", never "may they do this".
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, with origin checks on state-changing
  requests (`NFR-SEC-006`).
- Participant capability tokens are separate from auth sessions and are stored hashed
  (ADR-0006).
- No participant PII may be written into Better Auth tables beyond email/phone and name.

## Revisit trigger

Reopen if: a deployment requires enterprise SSO, a critical unpatched vulnerability persists
beyond the patch SLA, or participant accounts become a deliberate product requirement (they
are not today).
