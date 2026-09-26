# QR AND CHECK-IN TOKEN SECURITY

Requirements: FR-CHECKIN-003…005/011…014, NFR-SEC-004/005 · ADR-0006 · Related: `CHECKIN.md`,
`SECURITY.md` §6, `THREAT_MODEL.md` T-01…T-05/T-12/T-21

---

## 1. Design rules (non-negotiable)

1. **Opaque token only.** The QR payload is exactly the token string `MAJ-XXXX-XXXX-XXXX-XXXX` (128-bit
   CSPRNG entropy, Crockford-style base32 alphabet without ambiguous characters). No URL, no JSON, no
   delimiters carrying data.
2. **Nothing personal, nothing identifying, no entity ids.** Not the email, not the phone, not the full
   participant record, not the registration UUID, not the event UUID, not a raw database id, no
   timestamp of birth, no "name hidden in base64".
3. **Stored hashed.** Only SHA-256(token) is stored, plus a short display prefix for support purposes
   (e.g. `MAJ-7Q2K…`), never the value. Lookups are by hash with constant-time comparison.
4. **Server-authoritative.** Every validation happens on the server against the bound event; the client
   never decides whether a token is valid, and never caches a "valid" answer beyond the current entry.
5. **Not the only mechanism.** A manual path always exists: short code (a separate, rotatable secret),
   name lookup with confirm-before-commit, and a paper fallback with audited bulk entry (`ADR-0007`,
   `ADR-0026`). The QR is an accelerator, not a gate.
6. **Revocable and rotatable.** Individual revocation, mass revocation per event, and re-issue on a lost
   phone all exist with audit.

## 2. Payload properties (asserted by tests)

| Property | Assertion |
|---|---|
| Alphabet | Matches `^MAJ-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$` |
| Entropy | ≥ 128 bits from a CSPRNG; no sequential or time-derived components |
| Uniqueness | Unique index at the database; a collision causes regeneration |
| PII-free | Contains no `@`, no digit run ≥ 8, no UUID-shaped substring, no base64 of any entity id |
| Stable length | Fixed length (no padding ambiguity) |
| Grammar purity | No whitespace, no URL scheme, no query markers |

Any of these failing is a release blocker (they are cheap to test and catastrophic to get wrong).

## 3. Attack-by-attack posture

| Attack | Posture |
|---|---|
| **Guessing** | 128-bit space; per-device/per-event/per-IP rate limits on every attempt path; invalid-attempt spikes are alerted; short codes are shorter but rate-limited harder and rotate |
| **Enumeration via short code** | Short codes are only valid while the event is open, are rate-limited per device, and require the operator to be in the bound context; enumeration is not a useful attack because the operator already sees names in the console |
| **Screenshot forwarding** | One token → one attendance record (C2). A second scan returns `ALREADY_CHECKED_IN`; duplicates are counted as a rate, never used to accuse a person (`T-CHECKIN-018`); rotation is available if abuse is systematic |
| **Replay across events** | Tokens are bound to an event at issuance; wrong-event scans are refused and never disclose the other event's participant data |
| **Cross-tenant probing** | A token from another organization is simply unknown (`INVALID_TOKEN`); tenancy is enforced at the query level, not by comparing organizations after loading data |
| **Leaked log/telemetry** | Tokens and token-shaped fields are banned by lint and by the logger allow-list (`T-SEC-004`); validation responses never echo the token |
| **Stolen operator device** | Device-bound sessions, idle timeouts, immediate revocation, narrow permissions, and attribution of every check-in action (`T-CHECKIN-016`) |
| **Malicious QR from the venue** | Non-matching payloads are rejected locally by the client (format check before any network call), so a poster QR, Wi-Fi QR or phishing QR produces no server traffic and an immediate visual rejection |
| **Denial of service at the entrance** | Rate limits are tuned to allow ≥ 200 scans/minute/event; overload sheds with an explicit busy state; the manual path is unaffected by load (`T-PERF-002`) |
| **Print/screen quality failures** | The print view is tested for legibility at arm's length; the scanner retries across exposures; manual entry is the immediate fallback |

## 4. Token lifecycle

```
issue ──▶ active ──▶ (scanned = still valid; attendance is separate)
             │
             ├──▶ expired (event window + grace, or token TTL policy)
             ├──▶ revoked (participant lost phone / organizer decision / suspected abuse)
             └──▶ cancelled (registration cancelled → token invalid immediately)
```

Rules: expiry is evaluated server-side against the event window in the venue's timezone; a token is
never "refreshed" silently (re-issue is a new token, old one revoked, both changes audited); deletion of
tokens follows retention (30 days after the event, `RETENTION.md`), while attendance records persist per
their own policy.

## 5. Short code rules

| Rule | Reason |
|---|---|
| Separate secret from the QR token | Rotation of one must not invalidate the other mechanism |
| Shorter, therefore rate-limited harder and single-event scoped | Prevents enumeration |
| Never transmitted over uncontrolled channels (`NOTIFICATIONS.md`) | A code in a forwarded email is a credential leak |
| Never displayed publicly | Only on the participant's own authenticated code page or print view |
| Rotatable on demand by the participant | Lost/stolen phone recovery |

## 6. Verification checklist (per release touching check-in)

- [ ] Payload property tests pass (see §2).
- [ ] `checkin_tokens` schema has no plaintext column; a schema test enforces it.
- [ ] Rate limits verified at the documented thresholds, shared across replicas.
- [ ] Duplicate behaviour verified at the database layer under concurrency (C2).
- [ ] Wrong-event, expired, revoked and cancelled outcomes verified with distinct messages.
- [ ] Token fields absent from logs/traces in a real run (`telemetry_dropped_attribute_total` = 0, and a
      manual grep of a sampled log day finds nothing).
- [ ] Manual path exercised while the network is off and while the database is under load.
- [ ] Printed code legible at 1 m; short code targets ≥ 32 px with large-text mode.
