# Loyalty Programme Rules

**Document ID:** DOC-LOYALTY-PROGRAM-RULES
**Status:** Phase 0 specification. **No points algorithm exists** — `computeEarn` throws
`Not implemented: T-LOY-002` and `redeemReward` throws `Not implemented: T-LOY-003`.
**Related:** `LOYALTY.md`, PRD §7.12, ADR-0028, `PRIVACY.md`, `RETENTION.md`, `docs/security/PERMISSIONS.md`

---

## 1. Stance

Loyalty is **off by default** and enabled per organisation (FR-LOYALTY-001). It exists to say thank you
to repeating customers; it is not a profiling system, not a marketing funnel, and not a reason for a
customer to hand over personal data to buy food. Nothing about buying siomay requires the programme:
cash and QRIS work for everyone who declines it (FR-CUST-003).

## 2. Identification (consent first)

| Method | How | Data stored | Notes |
| --- | --- | --- | --- |
| Phone-hash | Operator enters the customer's number once; the client hashes it before sending | Hash + salt version, never the raw number | Full number never stored or displayed |
| Rotating QR token | Customer shows a token in their own app/browser | Token reference only | Token rotates; a stale token fails closed |
| Anonymous device token | A random token stored on the customer's device | Opaque token | Requires an explicit consent tap on that device |

Rules: identification always carries `consentGiven` + `consentTextVersion` (FR-LOYALTY-003); refusal is
one tap and changes nothing about price or service; the operator never guesses an identity; the operator
never sees a customer's purchase history beyond the current redemption context (FR-LOYALTY-007).

## 3. Earn and redeem (rules are configuration, versioned)

| Element | Rule |
| --- | --- |
| Rules version | Every loyalty transaction stores `rulesVersion`; changing rules never rewrites history (FR-LOYALTY-004) |
| Earn basis | Per completed sale above a configurable minor-unit threshold; earn rate and threshold are configuration, reviewed by Finance |
| Liability | Point value in minor units is documented; per-period caps apply; balances cannot go negative (FR-LOYALTY-005) |
| Redeem | Issues a single-use `RewardInstance`; uniqueness is enforced by a constraint so exactly one concurrent redemption wins (INV-07) |
| Expiry | Set per rule version; expiry is a recorded event, not a silent deletion of liability without notice |
| Self-award | An operator cannot earn or redeem on their own transactions (FR-LOYALTY-011) |
| Abuse | Suspected abuse is recorded as an incident for human review — never an automatic disqualification (FR-LOYALTY-012) |

No scoring, targeting, personalisation or "best customer" ranking is implemented in this phase
(FR-LOYALTY-009). The product does not decide who deserves what.

## 4. Data separation and retention

- Loyalty data is stored separately from operator performance data and has different access rules
  (NFR-PRIVACY-008); no join is exposed to operators.
- Customer records are deleted or anonymised on consent withdrawal or deletion request, through the
  documented pipeline, with the outcome recorded (FR-LOYALTY-010, `RETENTION.md`).
- Linked sales keep their financial integrity: anonymisation removes the customer reference without
  changing any amount (ADR-0037).

## 5. Customer-facing wording (plain Indonesian)

Short, honest, and free of dark patterns: what is collected, why, how to stop, and what happens to
existing points when they stop. No pre-ticked consent, no "accept to continue selling", no misleading
"free" claims, no urgency timers.

## 6. Operational rules for HQ

| Rule | Detail |
| --- | --- |
| Enabling the programme | Explicit configuration change with an audit row and a named owner |
| Changing rules | New `rulesVersion`; future periods only; recorded who changed it and why |
| Liability reporting | Outstanding points and their minor-unit value reported to Finance on a schedule |
| Kill switch | The programme can be disabled; existing rewards remain redeemable until expiry or an announced policy decision |
| Incident linkage | Loyalty abuse incidents link to the affected records, never to a person's profile |
