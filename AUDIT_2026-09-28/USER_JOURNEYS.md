# USER JOURNEYS

Actors are derived from the products as implemented, not from the persona lists in the PRDs. No actor
is invented; each one below corresponds to a code path that exists today.

Format: `UJ-<PROJECT>-<NNN>`. Every journey states what a *real* person is trying to accomplish, and
whether it completes on `8ebc15f`.

---

## siomayops — street-food stall operations (Jakarta)

**Real users:** stall operator (on a phone, outdoors, busy), area supervisor, HQ finance/ops.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-SIO-001 | Open a shift with the cash in the drawer | operator | **NO** — `GAP-P0-SIO-01` |
| UJ-SIO-002 | Sell 2 siomay + 1 drink, give change, survive a bad network retry | operator | **NO** — same |
| UJ-SIO-003 | Get paid by QRIS and have it settle | operator | NO — fail-closed by design (correct) |
| UJ-SIO-004 | See today's coverage, cash position and exceptions across stalls | HQ | **NO** — same |
| UJ-SIO-005 | Close the day and explain a cash variance | operator + supervisor | **NO** — same |
| UJ-SIO-006 | A report arrives, is triaged, a stall is suspended | HQ | **NO** — same; audit readable unauthenticated |

> **UJ-SIO-001 — Open a shift with the cash in the drawer**
> **Actor:** stall operator · **Trigger:** shift start
> **Preconditions:** operator is signed in; knows the business day; has counted the drawer
> **Steps:** 1. sign in 2. go to `/shift` 3. enter opening float 4. confirm
> **Expected:** shift row `OPEN`, opening float recorded, audit entry appended
> **Failure paths:** drawer count wrong → correct before close; retry with the same client id must not
> create a second shift
> **Security boundary:** only that operator may open a shift in that stall
> **Persistence:** the shift must survive a restart
> **Current reality:** steps 2–4 work in memory; step 1 does not exist; nothing survives restart

---

## homeops — household coordination

**Real users:** household owner, adult member, helper.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-HOM-001 | Sign in and see your household | member | PARTIAL — pages exist, never wired to data |
| UJ-HOM-002 | See what needs attention today | member | **NO** — `500` on the deploy path; cross-household if it runs |
| UJ-HOM-003 | Tick a chore done and see the next occurrence appear | member | **NO** — same |
| UJ-HOM-004 | See the state of a room | member | **NO** — cross-household read |
| UJ-HOM-005 | Know a bin is full / supplies are low before it becomes a problem | owner | NO — no write path proven |

> **UJ-HOM-002 — See what needs attention today**
> **Actor:** household member · **Trigger:** daily
> **Preconditions:** signed in; member of exactly one household
> **Steps:** 1. open `/today` 2. see overdue + today 3. act on one 4. reload
> **Expected:** only this household's chores; today decrements after completion; survives restart
> **Failure paths:** another household's id supplied → must not appear; DB error → must not render
> as "nothing to do"
> **Security boundary:** session → household → role, enforced server-side
> **Current reality:** `GET /api/homeops/today` returns `500` (`relation "chore_occurrence" does not
> exist`) because `0001_rooms_chores.sql` is not in the drizzle journal; when it does run, identity
> comes from `?householdId=`

---

## majelishub — kajian event coordination

**Real users:** kajian organizer, mosque administrator, attendee, entrance volunteer, transcript
reviewer.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-MAJ-001 | Sign in and see the organizations you belong to | organizer | PARTIAL — `401` under the demo runtime |
| UJ-MAJ-002 | Find a published kajian in a public listing | attendee | **NO** — cross-tenant leak or empty, depending on DB role |
| UJ-MAJ-003 | Open a kajian and see who it is for, where, when | attendee | **NO** — slug not tenant-unique |
| UJ-MAJ-004 | Create and publish a kajian | organizer | **NO** — header identity |
| UJ-MAJ-005 | Register to attend and receive a code | attendee | **NO** — no test, code leaks on duplicate |
| UJ-MAJ-006 | Volunteer scans a code and checks someone in | volunteer | **NO** — no test; device binding absent |

> **UJ-MAJ-005 — Register to attend and receive a code**
> **Actor:** attendee · **Trigger:** decides to come
> **Preconditions:** a published event exists
> **Steps:** 1. open the event 2. enter name + email 3. submit 4. receive a QR + short code
> 5. reopen the code page later, offline
> **Expected:** one row per event+email; the code is a capability only this attendee holds; a repeat
> submission by a third party must not disclose it
> **Failure paths:** duplicate email → the *owner's* own device can retrieve their own code via a
> re-authenticated request; a stranger submitting the same email must learn nothing
> **Security boundary:** public endpoint, event-scoped, never returns an attendee list
> **Current reality:** `POST /api/v1/events/[eventId]/registrations` returns
> `accessToken` and `qrPayload` (the raw capability, twice), and on a duplicate returns
> `shortCode: existing.shortCode` — **the victim's code**

---

## strangerlink — anonymous 1:1 text chat

**Real users:** adult participant, moderator.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-SLK-001 | Pass the age gate, consent, and join the queue | participant | **YES** |
| UJ-SLK-002 | Get matched and exchange text, then leave | participant | **YES** (single process) |
| UJ-SLK-003 | Report the other person and be safe | participant | **PARTIAL** — works, not retained |
| UJ-SLK-004 | A banned person is kept out | moderator | **PARTIAL** — a restart clears the ban |

> **UJ-SLK-004 — A banned person is kept out**
> **Actor:** moderator · **Trigger:** a safety report
> **Preconditions:** moderation decision recorded
> **Steps:** 1. decision is made 2. identity is banned 3. the identity tries to re-enter
> 4. the attempt is refused 5. the refusal is audited
> **Expected:** the refusal survives a server restart and a deploy
> **Current reality:** `banStore` is a process-global `Map` in `src/server/db/in-memory.ts`; every
> restart un-bans everyone. There is no other storage in the project.

---

## manga — licensed reader

**Real users:** reader, content administrator.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-MAN-001 | Discover a published title and open a chapter | reader | **YES** |
| UJ-MAN-002 | Read in single/double/vertical, RTL or LTR | reader | **YES** |
| UJ-MAN-003 | Sign in and resume on another device | reader | **NO** — no durable store |
| UJ-MAN-004 | Curate the catalog (upload, publish, unpublish) | admin | **NO** — no auth, no write API |

> **UJ-MAN-004 — Curate the catalog**
> **Actor:** content administrator · **Trigger:** new chapter ingested
> **Preconditions:** signed in with an admin role
> **Steps:** 1. open `/admin` 2. upload a chapter 3. review it 4. publish 5. verify it appears publicly
> **Expected:** unauthenticated and non-admin requests are refused at every step
> **Current reality:** `GET /admin` returns `200` to anyone. Steps 2–5 do not exist yet
> (`find src/app -path '*admin*' -name route.ts` → nothing). The boundary must be built *before* the
> write path, not after.

---

## parking — field parking operations

**Real users:** parking attendant (standing at a barrier, on a phone), supervisor.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-PRK-001 | Open a shift with the cash float | attendant | **NO** — domain yes, UI never committed |
| UJ-PRK-002 | Check a vehicle in and assign a slot | attendant | **NO** — same |
| UJ-PRK-003 | Quote the fee, take cash, give change | attendant | **NO** — same |
| UJ-PRK-004 | Close the shift and reconcile the drawer | attendant + supervisor | **NO** — same |

> **UJ-PRK-002 — Check a vehicle in and assign a slot**
> **Actor:** parking attendant · **Trigger:** a vehicle arrives
> **Preconditions:** a shift is open
> **Steps:** 1. type or scan the plate 2. pick a vehicle type 3. get a free slot
> 4. print/hand over the ticket 5. later, check it out and collect
> **Expected:** the session survives a restart; the plate is masked in historical audit; a supervisor
> PIN is required for a lost ticket
> **Current reality:** steps 1–5 all work through the domain API and `demo.py`, with SQLite persistence
> and a hash-chained ledger — but there is no attendant-facing surface. The eight "after" screenshots
> document a `server.py` that was never committed.

---

## rsi — offline self-improvement prototype

**Real users:** the operator of the prototype (a developer), and a human approver.

| # | Journey | Actor | Completes? |
|---|---|---|---|
| UJ-RSI-001 | Run exploration → freeze → evaluate on a holdout | operator | **YES** |
| UJ-RSI-002 | Propose → evaluate → human-gate → apply → verify → roll back | operator + approver | **YES** — correctly escalates when no approver is configured |

Both complete. This project meets its declared scope and says so honestly in `DELIVERABLES.md`.
