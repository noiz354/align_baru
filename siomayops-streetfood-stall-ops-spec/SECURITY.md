# SECURITY

**Document ID:** DOC-SECURITY
**Status:** Phase 0 (specification; **no auth, no crypto, no hardening implemented**)
**Related:** `THREAT_MODEL.md` (threat IDs T-xx and control mapping), `PRIVACY.md`, `docs/security/PERMISSIONS.md`, NFR-SEC-*

---

## 1. Security objectives

| # | Objective | Why it matters here |
| --- | --- | --- |
| S-1 | **Cash integrity** — no unauthorised creation, alteration, or deletion of money records | A cash business with hundreds of operators is defenceless without it |
| S-2 | **Payment integrity** — no payment marked paid without verified evidence | Otherwise the platform becomes a way to fake revenue |
| S-3 | **Data scoping** — an operator cannot read or write another operator's data | Dignity + integrity (T-01, T-14) |
| S-4 | **Price integrity** — prices cannot be tampered with client-side | Margin protection (T-03) |
| S-5 | **Audit integrity** — history cannot be rewritten by app roles | Dispute resolution, audits, compliance |
| S-6 | **Availability** — the system degrades gracefully; money-critical writes fail closed | Field operations depend on it |
| S-7 | **Privacy** — personal data minimised, purpose-bound, lawfully processed | UU PDP, operator dignity |
| S-8 | **Operational simplicity** — security that one team can actually run | A control nobody maintains is not a control |

---

## 2. Trust boundaries

| Boundary | Untrusted side | Controls at the boundary |
| --- | --- | --- |
| Device → API | Client app, network | TLS, session auth, Zod validation, idempotency, rate limits, scope checks |
| Provider → API (webhooks) | Provider payloads | Signature verification, timestamp window, dedupe, amount/currency checks, raw payload quarantine |
| HQ user → business scope | Human error/abuse | RBAC + scope, audit reasons, segregation of duties (Finance vs Ops) |
| Operator → other operators | Peers | Self-scoping, opaque IDs, no directory browsing, masked contact data |
| Jobs → data | Background processes | Same authorization context; jobs run with explicit, minimal scope claims |
| Object storage → clients | Pre-signed URLs | Short expiry, per-object key, type/size constraints, no public buckets |

---

## 3. Authentication (planned — ADR-0015)

| Aspect | Design |
| --- | --- |
| Library | Better Auth (typed sessions, plugins; Auth.js is in security-patch-only maintenance) |
| Operator credential | Phone number (E.164) + OTP; long-lived session on a trusted device; device label recorded, no hardware fingerprinting |
| HQ credential | Phone/email + password **plus** TOTP/passkey second factor for Finance and Owner roles (mandatory) |
| Session | HttpOnly, Secure, SameSite=Lax cookie; server-side revocation; idle timeout for HQ (e.g. 8 h), longer for operator devices (e.g. 30 days) with revoke-all capability |
| OTP | 6 digits, 5 min expiry, ≤ 5 attempts, per-phone and per-IP rate limits, generic failure messages (no account enumeration) |
| Recovery | Supervisor-assisted re-bind with recorded approval (no self-service email recovery for operators) |
| Logout / device loss | Operator can revoke all sessions; HQ can force-revoke on suspicion |

**Phase-0 rule:** no authentication code exists. `AuthPort` and `SessionContext` are interfaces
only, with a `NotImplemented` fake for shells.

---

## 4. Authorization model (ADR-0016)

```text
authorize(actor, action, subject, scope) → ALLOW | DENY(reason)
```

| Layer | Rule |
| --- | --- |
| Role | Coarse capability set (matrix in `docs/security/PERMISSIONS.md`) |
| Scope | org / region / area / stall / self — must be satisfied **in addition** to role |
| Object | Ownership and tenancy checks inside repository methods (never trust the caller's claim) |
| Field | Sensitive fields masked by role (phone numbers, evidence photos, customer identifiers) |
| Action | Money-affecting actions require elevated roles + reason |

Denials are audited (`PERMISSION_DENIED`) with the object, actor, and route — useful for both
detection and debugging.

### Segregation of duties

| Pair | Rule |
| --- | --- |
| Approve price change vs use override | A user may not be the sole approver and beneficiary of repeated overrides in their own area (flag for review) |
| Review expense vs submit expense | Reviewer ≠ submitter (enforced when a submitter also has review rights) |
| Manual payment reconciliation vs operate the till | Finance reconciliation is a separate role from operator |
| Configure thresholds vs approve over-tolerance variance | Same person cannot silently relax a threshold mid-period without audit |

---

## 5. Payment security (summary — full detail `PAYMENTS.md` §8)

1. Idempotency on creation, callbacks, reconciliation.
2. Signed provider callbacks verified **before** any parsing side effects; invalid signature ⇒
   `401` + security audit + alert.
3. Provider transaction references unique per provider; duplicates are no-ops with a log entry.
4. Amount and currency verification against the sale; mismatch ⇒ review queue, never PAID.
5. Replay protection: timestamp window + unique reference + nonce where the provider offers it.
6. Payment state machine guards; invalid transitions throw and alert.
7. Manual reconciliation requires role + reason + evidence note + audit.
8. **Never rely on a browser message saying "payment successful"** — no client code path can
   set `PAID` (architecture invariant #8).
9. Raw webhook payloads stored for dispute handling (encrypted at rest, access-controlled,
   retention-bound).
10. Provider secrets only in the secret manager; rotation documented in `RUNBOOK.md`.

---

## 6. Application security controls

| Control | Implementation stance (future) |
| --- | --- |
| Input validation | Zod at every boundary; no trust in device payloads; strict types for money and quantities |
| SQL safety | Drizzle/parameterised queries only; no string-built SQL; lint rule to flag raw concatenation |
| XSS | React escaping + no `dangerouslySetInnerHTML` without review; strict CSP (no inline scripts where avoidable) |
| CSRF | SameSite cookies + origin checks on mutating routes + double-submit token for browser forms |
| IDOR | Opaque IDs (UUIDv7) + scope checks + repository-level tenancy filters (INV-14) |
| Mass assignment | Explicit DTO mappers; never bind request objects directly to domain objects |
| File upload | Type/size limits, content sniffing, pre-signed direct upload with key generated by server |
| SSRF | No user-supplied URLs fetched server-side (map/geo features use approved providers only) |
| Header safety | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors restrictions; geolocation remains disabled by default and is enabled only on `/operator/location` for the explicit one-shot assist (ADR-0039) |
| Rate limiting | Token bucket per identity + IP on auth, sales, payments, loyalty, exports |
| Secrets | Secret manager per environment; never in repo, logs, client bundle, or error messages |
| Dependencies | Lockfile, pinned versions, monthly upgrade cadence, CVE scanning in CI, 72 h patch SLA for critical |
| Containers | Non-root user, minimal base image, read-only filesystem where possible, image scanning in CI |
| Backups | Encrypted, access-controlled, restore rehearsed quarterly (NFR-REL-003) |
| Logging | No secrets, no full phone numbers, no evidence contents; structured and correlated |

---

## 7. Audit and non-repudiation (ADR-0026)

Critical state changes emit an immutable audit event:

```text
who  ·  what  ·  when  ·  previous value  ·  new value  ·  reason  ·  request id
```

Audited actions include: price changed · sale voided/corrected · expense edited/reviewed ·
payment manually reconciled · cash closing edited/reopened · stock adjusted · recognition
result overridden · role/permission changed · export performed · login anomalies.

Controls:

- Append-only writes; no update/delete path exists for application roles.
- Hash-chaining or signed manifests (planned) to make tampering evident (FR-AUDIT-008).
- Integrity monitoring job: gaps in sequence, unexpected mutation attempts, off-hours actions
  by privileged roles.
- Auditor role: read-only access to audit and financial records (FR-AUDIT-005).

---

## 8. Incident response (security)

| Step | Action | Owner | Target |
| --- | --- | --- | --- |
| Detect | Alerts on signature failures, permission-denial spikes, off-hours privileged actions, CVE feed | Eng | minutes |
| Triage | Determine scope: data, money, availability | Eng + Owner | ≤ 1 h |
| Contain | Revoke sessions, rotate secrets, disable provider keys, block abusive IPs | Eng | ≤ 2 h |
| Assess | Personal data involved? Notify per UU PDP (72 h to affected + authority) | Owner + DPO | ≤ 72 h |
| Remediate | Patch, migrate, correct records forward with audit | Eng | per severity |
| Learn | Blameless post-mortem, control update, runbook edit | All | ≤ 1 week |

---

## 9. Security requirements register (summary)

| ID | Requirement | Control status |
| --- | --- | --- |
| NFR-SEC-001 | TLS 1.2+, HSTS, secure cookies | Planned |
| NFR-SEC-002 | Role + scope authorization on every access | Specified (`PERMISSIONS.md`) |
| NFR-SEC-003 | Boundary validation + parameterised SQL | Specified |
| NFR-SEC-004 | Idempotency on mutating endpoints | Specified (ADR-0013) |
| NFR-SEC-005 | No digital PAID without verified evidence | Specified (ADR-0011/0012) |
| NFR-SEC-006 | Callback signature + replay protection | Specified |
| NFR-SEC-007 | Secrets management | Specified |
| NFR-SEC-008 | Upload safety + signed URLs | Specified |
| NFR-SEC-009 | Rate limits | Specified |
| NFR-SEC-010 | Append-only audit | Specified (ADR-0026) |
| NFR-SEC-011 | Dependency scanning + patch SLA | Specified |
| NFR-SEC-012 | Security event logging + alerting | Specified |
