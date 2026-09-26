# ADR-0006 — Opaque, hashed check-in tokens; no PII in the QR payload

- Status: Accepted · Date: 2026-09-26 · Deciders: Security, Principal Architect, UX
- Requirements affected: FR-REG-003, FR-CHECKIN-005/011, NFR-SEC-004/005
- Related: `docs/security/QR-SECURITY.md`, `THREAT_MODEL.md` T-02/T-03/T-12

## Context

Each registration receives something the participant shows at the entrance. The naive designs
are all dangerous:

- **Embed participant details (name/phone/email) in the QR.** Screenshots and forwarded images
  leak PII; the QR is often photographed, forwarded to family members, and shown on a bright
  screen in a public place.
- **Embed a signed JWT with claims.** Same leak, plus a larger QR and a revocation problem
  (short expiry harms the participant; long expiry is a replay window).
- **Embed the raw database id.** Invites IDOR-style enumeration and cross-event probing.
- **Embed nothing and require login at the entrance.** Fails the queue: participants without
  accounts, forgotten passwords, dead batteries (`DESIGN.md` §FAST).

## Decision

Issue an **opaque check-in token** per registration:

- 128 bits of CSPRNG entropy, base32-encoded in groups for human transcription
  (`MAJ-XXXX-XXXX-XXXX-XXXX`) plus a short human code derived from the same token for manual
  entry.
- Stored **hashed (SHA-256)** in `checkin_tokens.token_hash`; the plaintext is shown to the
  participant once and re-derivable only through their authorised registration view.
- Lookup is by hash; verification is constant-time on the stored digest.
- The token is **scoped**: it names no event in its payload but resolves to exactly one
  registration, which belongs to exactly one event. A token presented at another event
  resolves to `WRONG_EVENT` without leaking which event it belongs to.
- Tokens are **single-purpose** (check-in) and can be revoked/re-issued (lost phone), with the
  event audited (`FR-CHECKIN-013`).
- The QR encodes a URL containing the token (so a native camera app opens the participant's
  registration page) **and** the raw token string (so an offline scanner can parse it).

## Alternatives considered

- **HMAC-signed payload with claims (stateless validation).** *Gains:* no database lookup.
  *Costs:* PII exposure, revocation difficulty, replay indistinguishable from legitimate use,
  and no central place to record "already checked in" atomically. *Rejected.*
- **TOTP-style rotating token.** *Gains:* screenshot time-bomb. *Costs:* clock skew at a
  mosque entrance, participant confusion, support burden — and it does not stop a live
  forward. *Rejected* (documented in `QR-SECURITY.md` as a future anti-screenshot measure).
- **Participant's phone number as the code.** *Costs:* enumerable, guessable, and turns the
  entrance into a phone-number lookup service. *Rejected.*

## Consequences

**Positive:** a leaked screenshot is worth one attendance record for one event
(`SECURITY.md` §QR replay); no PII is exposed by the QR; replay and duplicates are handled
centrally and atomically (ADR-0025); revocation is possible.

**Negative:** validation requires a database read (accepted: it is one indexed lookup, and
attendance must be written anyway); tokens are secrets that must be re-fetchable when a phone
is lost — hence the recovery path via contact lookup (`PRD.md` E3).

**Neutral:** the manual short code is a real secret too and MUST NOT be logged
(`OBSERVABILITY.md` §Forbidden attributes).

## Enforcement

- A unit test asserts that a generated QR payload contains no `@`, no phone-like digit run, no
  UUID of any entity, and matches `^MAJ-[0-9A-HJKMNP-TV-Z-]{…}$`.
- A test asserts `checkin_tokens` stores no plaintext token column.
- Logs/traces are scanned in review for token values; a lint rule bans logging the token field
  names (`T-SEC-004`).
- Validation responses never echo the token.

## Revisit trigger

Reopen if a deployment reports systematic screenshot forwarding abuse (measured rate of
suspicious duplicate scans) — the documented response is rotating tokens or a photo-capture
check in the scanner, not embedding more data.
