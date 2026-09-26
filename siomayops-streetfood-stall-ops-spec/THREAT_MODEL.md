# THREAT MODEL

**Document ID:** DOC-THREAT-MODEL
**Status:** Phase 0 (analysis; **no mitigations implemented**)
**Method:** asset → adversary → threat (STRIDE-flavoured) → control → residual risk → test
**Related:** `SECURITY.md`, `PRIVACY.md`, `docs/security/PERMISSIONS.md`, `TESTING.md`

---

## 1. Assets

| Asset | Why valuable | Damage if compromised |
| --- | --- | --- |
| Cash records (sales, closings) | Directly represents money | Undetected theft, wrong payments, disputes |
| Payment records & provider callbacks | Money movement | Fake revenue, dupe crediting, provider disputes |
| Price policies | Margin | Silent discounts, margin loss, unfairness |
| Operator accounts | Access | Impersonation, data exposure, fraudulent shifts |
| Operational data (stock, incidents) | Business control | Concealment of loss, retaliation risk |
| Personal data (operators, customers) | Legal + dignity | UU PDP penalties, harm, distrust |
| Location reports | Safety + privacy | Stalking risk, surveillance creep, legal exposure |
| Audit log | Truth | Covering tracks, dispute loss |
| Credentials/secrets | Everything above | Full compromise |

## 2. Adversaries

| Adversary | Motivation | Capability |
| --- | --- | --- |
| Opportunistic insider (operator) | Small cash gain | Device access, learned UI patterns, social engineering peers |
| Organised insider (collusion) | Systematic skimming | Multiple accounts, timing awareness, process knowledge |
| External attacker | Data theft, extortion, fraud | Scanning, credential stuffing, web exploitation |
| Malicious customer | Free food, reward abuse | Social engineering at the stall, fake screenshots |
| Disgruntled ex-employee | Revenge | Historical credentials, process knowledge |
| Fraudulent provider/third party | Financial gain | Callback forgery, statement ambiguity |
| Curious supervisor | Control, curiosity | Legitimate access used improportionately |

---

## 3. Threat catalogue

| ID | Threat | STRIDE | Scenario | Controls (design) | Residual risk | Planned test |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Operator accesses another operator's shift | Info disclosure | Guessing IDs, replaying requests from another device | Opaque UUIDs, self-scope checks, no directory browsing | Low | Integration: cross-operator GET/PATCH denied; audit emitted |
| T-02 | HQ role escalation | Elevation | Operator account gains HQ role by request tampering or misconfiguration | Role assignment requires Owner; audit; role changes cannot be self-performed; scope checks independent of role | Low | Integration: role-change endpoint requires Owner + audit; forged role claim ignored |
| T-03 | Price tampering from the client | Tampering | Modified app sends a lower unit price | Server-side resolution; snapshot authored by server; mismatch ⇒ `STALE_DATA` | Very low | Unit + integration: client price ignored; mismatch path returns 409 |
| T-04 | Sale deletion / history rewrite | Repudiation | Operator deletes a sale to hide cash | No delete path; void/correct only with role + reason + audit | Very low | Integration: DELETE returns 405/404; void requires reason; audit exists |
| T-05 | Fake digital payment | Spoofing/Fraud | Client claims QRIS paid; screenshot shown | No client path to PAID; verified evidence only; static QR ⇒ `PENDING_VERIFICATION` + manual reconciliation with evidence | Low | Adversarial: POST payment with "paid" claim rejected; PAID requires evidence ref |
| T-06 | Expense manipulation | Tampering | Inflated/fabricated expenses to pocket cash | Amount + reason captured, thresholds/patterns route to review, cash count cross-check, review workflow, audit | Medium (human review dependent) | Integration: flag rules route to review; rejection requires reason; no deletes |
| T-07 | Cash reconciliation manipulation | Tampering | Editing counted cash after the fact | Closing immutable once accepted; corrections are new audited records; Finance-only with reason | Low | Integration: post-accept close edit rejected; reopen path audits |
| T-08 | Loyalty fraud | Fraud | Double redemption, farmed rewards, impersonation | Single-use instances + unique constraint; idempotent earn; server-side identification; pattern review | Medium (low-value incentives) | Concurrency: parallel redeem ⇒ one success; replay ⇒ original result |
| T-09 | Stock manipulation | Tampering | Adjusting counts to hide loss | Movements append-only; adjustments require reason; variance visible; no accusation automation | Medium | Integration: adjust requires reason; position derived; duplicates idempotent |
| T-10 | Location spoofing | Spoofing | Reporting a location the stall is not at | Operator-reported model already; spoofing only affects advisory data; HQ cross-checks with sales rhythm and supervisor knowledge; optional one-shot GPS is *assistive*, never authoritative | Medium (accepted; low harm) | QA scenario: mismatch between reported location and supervisor reality | 
| T-11 | IDOR on any resource | Elevation/Disclosure | Enumerating IDs in API paths | UUIDv7 + scope checks + repository-level tenancy filter (INV-14) | Very low | Integration sweep: every route tested with an out-of-scope ID |
| T-12 | XSS via user text (notes, incident descriptions, location notes) | Tampering | Stored script in a description field | React escaping, CSP, length limits, sanitisation on render, no raw HTML | Low | Browser test: script payload renders as text |
| T-13 | CSRF on mutating routes | Tampering | Cross-site form posts | SameSite cookies, origin check, CSRF token for browser forms | Low | Integration: cross-origin POST rejected |
| T-14 | SQL injection | Tampering | String-built queries in a filter parameter | Parameterised queries only; review rule; static analysis | Very low | Integration: injection payloads in filters return validation errors |
| T-15 | Payment webhook forgery | Spoofing | Forged callback marks payment PAID | Signature verification, timestamp window, dedupe, amount match, unknown reference ⇒ investigation queue | Very low | Integration: invalid signature ⇒ 401 + audit; valid ⇒ processed once |
| T-16 | Secret leakage (repo, logs, client bundle) | Disclosure | Provider key committed or printed in errors | Secret manager, repo scanning in CI, log scrubbing, env validation at boot | Low | CI checks + log review test |
| T-17 | Audit log manipulation | Repudiation | Privileged user edits audit rows | Append-only table, no app update/delete grants, hash chain/signed manifest (planned), integrity job | Low | Integration: audit update attempt fails; integrity job detects gap |
| T-18 | Alert fatigue weaponisation | Availability | Flooding alerts to hide a real one | Dedupe keys, per-audience rate limits, severity discipline | Low | Unit: dedupe + rate limit behaviour |
| T-19 | Offline queue tampering on a rooted device | Tampering | Editing IndexedDB to inject sales/amounts | Server re-validates every replayed record (price, shift, permissions); amounts re-checked; device anomaly metadata recorded | Medium (accepted: server authority) | Integration: tampered replay rejected/stale-priced |
| T-20 | Clock manipulation to shift business day | Repudiation | Setting device clock to move records between days | Server bounds accepted device times; business day derived server-side; anomalies flagged | Low | Integration: skewed timestamps flagged, business day server-derived |
| T-21 | Customer data exfiltration by insider | Disclosure | Bulk loyalty export | Export requires role + reason + audit; masked fields by default; rate limits; anomaly monitoring | Medium | Integration: export without role denied; audit present |
| T-22 | Surveillance creep (product drift) | Privacy harm | Someone adds passive location collection "temporarily" | Explicit architectural invariant #9 + privacy tests + review checklist + ADR-0007 | Low (governance) | Browser test: no geolocation APIs called unless the operator taps the assist button |
| T-23 | Unlawful-payment facilitation drift | Legal/ethical | A "fee suggestion" feature appears | PRD §9 hard rule; ADR-0027; review gate; tests assert absence of recipient/amount suggestion fields | Low (governance) | Endpoint/UI review: no such fields exist |
| T-24 | Denial of service on money paths | Availability | Flooding sale/payment endpoints | Rate limits, queue backpressure, provider timeouts, circuit breaking on the adapter, idempotency to reduce load | Low | Load test (later slice) |
| T-25 | Data loss of un-synced records | Availability/Integrity | Device lost with queued records | Write-through to IndexedDB, sync-first transfer path, quarantine export, support tooling | Medium | QA scenario: kill app mid-shift, resume |

---

## 4. Threat-specific design decisions (why the architecture looks like this)

| Decision | Threat addressed |
| --- | --- |
| Server-resolved price snapshot | T-03, T-19 |
| No client path to `PAID` | T-05 |
| Append-only audit with reasons | T-04, T-06, T-07, T-09, T-17 |
| Client IDs + idempotency everywhere | Duplicate/fraud replays, T-08, T-19 |
| Single-use reward instances | T-08 |
| Scope-checked repositories | T-01, T-11, T-21 |
| Explicit, shift-bound location reports | T-22, T-10 |
| Neutral expense categories (no recipient fields) | T-23 |
| Dedupe + rate limits on alerts | T-18 |
| Non-root containers, secret manager, scanning | T-16 |

---

## 5. Out-of-scope threats (documented so they are not silently ignored)

| Threat | Why out of scope in Phase 0/1 | Revisit when |
| --- | --- | --- |
| Physical robbery of the cash box | Product cannot solve; incident reporting + runbook only | Never (but support the process) |
| Nation-state adversaries | Disproportionate | If serving regulated financial services |
| Insider with database superuser access | Mitigated only partly (auditing, least privilege) | Managed provider + break-glass audit |
| SIM-swap on operator OTP | Partially mitigated (session length, device binding) | If OTP is used for HQ finance (then hardware/passkey required) |
| Collusive supervisor-operator fraud network | Detected only by aggregate analytics + human investigation | Add stronger analytics in VS-17 if patterns appear |
| Provider-side compromise | Trust boundary assumption | Contractual + monitoring; new ADR if it occurs |
