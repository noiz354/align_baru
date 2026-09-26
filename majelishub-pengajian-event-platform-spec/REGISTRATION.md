# REGISTRATION

How a participant gets a place at a kajian, what data is collected, how capacity behaves under
concurrency, and how the check-in token is issued.

Requirements: FR-REG-001…014 · Concurrency: `docs/architecture/CONCURRENCY.md` C1/C3 ·
Privacy: `PRIVACY.md` · States: `STATE_MACHINE.md` §2

---

## 1. Registration models

| Mode | Participant experience | Collected | Token issued | Attendance expectation |
|---|---|---|---|---|
| `OPEN` | Register freely; no cap | name, contact, count | yes | attendance recorded at the entrance |
| `CAPACITY_LIMITED` | Register while seats remain; waitlist when full (if enabled) | same | yes (also when waitlisted) | attendance recorded |
| `INVITATION` | Register only with a valid invitation link | same | yes | attendance recorded |
| `WALK_IN` | No registration needed; counted at the entrance | name (+ optional contact) **at the door** | short code issued at the door | attendance recorded as walk-in |
| `NO_REGISTRATION` | Attendance-only event; no list at all | nothing | none | aggregate count only, by manual tally or operator increments |

Design rules that follow:

- A deployment may set a default mode at the organization level (`FR-ORG-004`) and override it
  per event. The event page states the mode in plain language before any action.
- `NO_REGISTRATION` is an honest mode for a large open kajian where counting individuals is not
  appropriate: the product then **does not pretend** to know who attended
  (`FR-ATTEND-006`). The dashboard shows "tanpa daftar — perkiraan kehadiran".
- Changing the mode after publication is allowed only before the first registration, and is
  audited; afterwards it requires cancelling and recreating (history integrity).

## 2. Data collected (the complete list)

| Field | Required | Purpose | Stored as | Notes |
|---|---|---|---|---|
| `name` | yes | Identify the participant at the entrance and in reports | 2–80 chars, trimmed, NFC | Operators see **first name only** on the scanner |
| `contact` (one of email / WhatsApp / SMS) | yes | Delivery of the code and event updates; the participant's own access path | normalised + `contact_hash` for dedupe | Never shown publicly; masked to operators |
| `participantCount` | yes (default 1) | Capacity accounting (family/group) | 1–20 integer | Named individuals are never required (`FR-REG-010`) |
| `accessibilityRequest` | optional | Operational accommodation (seating, sign language, wheelchair access) | ≤ 500 chars | Visible to organizers only |
| `consent.contactUse` | yes | Lawful basis for contacting about this event | boolean | Explicit; not pre-ticked |
| `consent.recordingNoticeAcknowledged` | when the event records | Honest notice that the session is recorded/published | boolean + timestamp | `PRIVACY.md` §Consent |

**Explicitly not collected:** date of birth, gender, national ID, address, occupation, photo,
organisation, "how did you hear about us" (unless the organizer enables the optional
non-identifying field, FR-REG-013), prayer preferences, sect, or any religious identity attribute.

**Data minimisation enforcement:** the API schema is `.strict()`; an unknown field is a `422`.
Adding a field requires an update to `PRIVACY.md` §Data inventory first.

## 3. Flow

```
Event page → [Daftar]
   ├─ mode OPEN / CAPACITY_LIMITED / INVITATION
   │     → form (≤ 4 fields) → submit (idempotent) → result page with QR + short code
   │                                 └─ full? → waitlisted with explicit explanation + position
   └─ mode WALK_IN / NO_REGISTRATION
         → no form; the page explains "datang langsung" and how attendance is counted
Result page → save QR (screenshot hint) → /pendaftaran/[token] (offline-capable)
```

## 4. Capacity under concurrency

Capacity is a **database** decision, not a UI one:

1. The check and the insert happen in **one transaction**.
2. The count used is the count of active registrations (`status = 'REGISTERED'`), taken with a
   lock or computed inside a conditional insert (`INSERT … SELECT … WHERE (SELECT count(*) …) <
   capacity`), so two simultaneous submissions cannot both see the last seat.
3. Outcomes (all are legitimate, all have explicit UI):
   - seat available → `REGISTERED`
   - seat taken this instant, waitlist enabled → `WAITLISTED` (position reported)
   - seat taken, no waitlist → `PRECONDITION_FAILED` with an explanation and the option to be
     notified of the next session in the same program
4. `participantCount > 1` must **fit** in the remaining capacity, otherwise the request is
   declined to waitlist or rejected without partial admission (a group is admitted together or
   offered the waitlist together — no split families at the door).
5. Seat release (cancellation, offer expiry) is a single transaction that: marks the source
   registration `CANCELLED`, recomputes remaining capacity, and creates the next waitlist offer.

Concurrency case reference: `C1` (capacity race), `C3` (cancel while capacity offer is in flight).

## 5. Waitlist

- Position is reported as an ordinal and a rough band ("sekitar 12 orang di depan Anda"), never
  as a promise of admission.
- Offers are explicit with an expiry (default 3 hours, configurable; for events starting within
  6 hours the default is 30 minutes) because a seat held indefinitely is a seat lost.
- Offer acceptance reuses the **same** registration and **same** check-in token (`I-REG-6`) — no
  duplicate registration, no second QR.
- Offer expiry re-offers to the next candidate automatically.
- An organizer can manually promote a participant (audited), e.g. a seat freed at the door.
- Waitlisted participants receive no attendance expectation: they are not counted as registered in
  the attendance summary but are shown separately as "daftar tunggu" for planning context.

## 6. Idempotency and duplicate suppression

Three layers, all required:

1. **Client**: the submit button disables on first activation; the payload carries an
   `Idempotency-Key` reused on retry.
2. **Server**: `Idempotency-Key` → stored response for 24 h; a replay returns the same registration
   and token (the token is returned again because the caller has proven knowledge of the key, and
   the participant's device may have lost it).
3. **Database**: `UNIQUE (event_id, contact_hash) WHERE status <> 'CANCELLED'` — the ultimate
   guard. A duplicate submission that bypasses the client does not create a second row; the API
   responds with the **existing** registration's capability link (no error page, no confusion).

## 7. Cancellation

- The participant can cancel from their capability page until the event starts (configurable to
  "until the event ends" for a deployment; default: until `startsAt`).
- Cancelling after check-in is **forbidden** (`STATE_MACHINE.md` §2) — the attendance fact stands
  and can be corrected by an organizer with a reason.
- Consequences are stated before confirming: "Kursi Anda akan ditawarkan kepada peserta daftar
  tunggu. Anda dapat mendaftar lagi jika masih ada tempat."
- Late-cancellation policy (e.g. repeated no-shows) is **not** implemented: there is no penalty
  model and no reputation for participants.

## 8. Invitations (`INVITATION` mode)

- An invitation is a capability: high-entropy token, stored hashed, with an expiry and a max-use
  count (default 1), scoped to one event and, optionally, to a group label (e.g. "undangan
  panitia", "undangan keluarga").
- Invitation links do not grant access to any other data; redeeming one registers the recipient
  exactly as in `OPEN` mode plus a label.
- Invitation delivery uses the notification port; the token appears in the message only when the
  channel is access-controlled (email/in-app). For channels that are not (or are shared), the
  message contains a short redemption code and the participant exchanges it on the site
  (`FR-NOTIF-010`).
- Redemption is idempotent and single-use; a used invitation produces "undangan sudah
  digunakan" with a path to contact the organizer.

## 9. Offline and low-connectivity behaviour

- The registration form requires connectivity (it must not silently queue): the participant is
  told clearly when a submission failed and whether it is safe to retry (it is; the request is
  idempotent).
- The **result page and QR are cached** for offline display (`NFR-MOB-004`).
- If the network fails mid-submission, the UI shows "belum terkirim" and offers retry; it never
  shows a QR for a registration that does not exist.

## 10. Registration vs. attendance: the boundary

| Registration means | Registration does **not** mean |
|---|---|
| A place was reserved, and a check-in token was issued | That the person came |
| A contact channel for updates | A verified identity |
| Input to capacity planning | A guaranteed seat at a specific chair (no seat assignment exists) |

The registration state `CHECKED_IN` in the original brief is intentionally **not** a registration
state: attendance is a separate fact (`attendance_records`) because walk-ins have attendance
without registration (ADR-0025, DOMAIN.md §6.1).

## 11. Edge cases (product behaviour, not implementation)

| Case | Behaviour |
|---|---|
| Participant registers for two different events in one program | Allowed; each has its own token |
| Same person registers twice with two different contact channels | Allowed by the uniqueness rule (two identities); organizers see both rows and can merge manually (P2) |
| Participant registers for a group of 5 and arrives alone | Attendance records `participantCount` from the registration but the operator counts the declared group; the summary distinguishes "peserta terdaftar (orang)" from "kode check-in" |
| Registration opened but the event is cancelled before anyone registers | Registration closes; the page states the cancellation; no tokens exist to invalidate |
| Event moved to a different venue | Registrations remain valid; the venue change is notified; the token is unchanged (it authorises the event, not the room) |
| Capacity reduced below the number of registered participants | Rejected: capacity cannot be set below the current registered count (validation error with the current count) |
| Participant asks to change their name after registering | Organizer can edit with a reason (audited); the participant cannot edit their own registration beyond cancellation |
| Contact channel is a shared family phone | Allowed; the record is a registration, not a person (documented consequence: notifications and codes go to the shared channel) |
| The mosque's WhatsApp is used as the contact by many registrants | The uniqueness rule would collapse them into one registration — mitigated: dedupe uses the contact hash **plus** the submitted name's normalised form, and identical (contact, name) pairs are treated as the same participant. Documented limitation: two people with the same name sharing a phone cannot both register individually; organizers can add a participant count instead. |

## 12. Acceptance criteria for this module

1. A participant completes registration in ≤ 4 fields and ≤ 3 interactions from the event page.
2. Two simultaneous submissions for the last seat produce one `REGISTERED` and one
   `WAITLISTED`/declined — never two `REGISTERED` (automated concurrency test C1).
3. A repeated submission (same idempotency key or same contact) produces exactly one registration
   and returns the same token (automated test).
4. The registration form contains no field beyond §2 (schema assertion test).
5. The result page shows the QR and the short code, and remains usable with the network disabled
   after the first load (browser test).
6. Cancellation before the event releases the seat and offers it to the next waitlisted
   participant in the same transaction (integration test C3).
