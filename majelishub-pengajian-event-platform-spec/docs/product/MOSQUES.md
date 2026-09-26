# PRODUCT SPECIFICATION — MOSQUES, VENUES, FACILITIES

Requirements: FR-MOSQUE-001…009 · Entities: `DOMAIN.md` §Mosque/Venue · Data: `DATA_MODEL.md` §mosques

---

## 1. What a mosque is in MajelisHub

A mosque (masjid) is the **anchor of physical reality**: a place people actually go, with rooms,
entrances, facilities, accessibility constraints and a local community. It belongs to exactly one
organization (which may be a mosque, a foundation, a youth community or a study group), and it may be
used by events from *other* organizations only through an explicit venue-sharing grant.

Distinctions that matter:

| Concept | Meaning | Example |
|---|---|---|
| Organization | The accountable entity (account, billing of trust, administration) | Yayasan Masjid Al-Hikmah |
| Mosque | A physical place of worship | Masjid Al-Hikmah |
| Venue | A usable space within a mosque | Aula Utama, Lantai 2 |
| Entrance | A door/gate used for check-in | Pintu Utama (Selatan) |
| Facility / accessibility | Facts that determine whether a person can attend | "Ramah kursi roda (akses barat)", "Ruang ibu dan anak" |

Rationale: registration, check-in and attendance are all per **event at a venue**, while the mosque
is what a participant searches for and what carries long-term trust. Collapsing them causes the
"which floor was the kajian on?" problem that shows up on the first busy night.

## 2. Data we hold about a mosque (and why)

| Field | Purpose | Visibility |
|---|---|---|
| Name, type (masjid/musala/community hall) | Discovery | Public |
| Address, district, city, coordinates | Navigation and area search | Public |
| Timezone | Correct times for events and reminders (ADR-0018) | Public |
| Contact (a mosque-level contact, not personal) | Questions from participants | Public if the mosque consents; otherwise internal only |
| Facilities and accessibility notes | Deciding whether to attend | Public |
| Prayer-time source (if configured) | Prayer-relative scheduling, "perkiraan" fallback | Public-ish (see ADR-0018) |
| Photos | Recognition on arrival | Optional; only with permission |

**Never held**: congregation lists, attendance history about individuals, member profiling, donation
data (out of scope for MVP — a kajian product is not a donation platform).

## 3. Behaviour rules

1. **Venue sharing is explicit.** Organization A may hold an event at organization B's mosque only if
   B grants a venue-sharing grant (per mosque or per venue), with an expiry and a revocable state.
   Without it, event creation refuses to select that venue and returns a plain-language reason.
2. **An event always has exactly one venue.** Multi-room simultaneous kajian is modelled as two events
   at two venues (which is also how people experience it: two entrances, two speakers).
3. **Accessibility is structured, not free text.** A fixed set of accessibility attributes (wheelchair
   access, accessible toilet, lift, hearing assistance (loop/PA), quiet room, women's area, children's
   area, step-free entrance, seating with back support) plus one free-text note. Reason: filtering
   ("show kajian with wheelchair access near me") is impossible on free text.
4. **Entrances are configured before check-in day.** Each entrance has a name, optional directions
   ("Dari parkir barat, naik tangga beton") and a capacity hint used for entrance planning.
5. **Closing or moving a mosque is a soft operation.** A mosque can be marked closed/merged; its past
   events stay in the archive with a note; nothing is deleted while events or published content
   reference it (dependency protection, `RETENTION.md`).
6. **Public pages never rank mosques.** No "most popular mosque" ordering; no counts of attendees
   exposed as a ranking (ADR-0014/0024).
7. **Search must work with imperfect knowledge.** Participants search by name fragment, area, "near
   me" (with permission) or facility, and results show why a result matched.

## 4. The discovery question list (what the public page must answer)

1. Where is it and how do I get in? (address, coordinates, venue, entrance, "shared with permission")
2. Can I physically attend? (accessibility attributes, facilities, parking, women's/children's areas)
3. What happens here and when? (upcoming kajian, weekly program)
4. Who holds the kajian here? (organizers — as names of people/organizations, never scores)
5. How do I ask a question? (mosque contact if permitted; otherwise "ask the organizer via the event")
6. How reliable is this information? (last updated; "masjid belum diverifikasi" where applicable)

## 5. Accessibility requirements specific to mosques

- Every mosque page states the state of the **entrance used for check-in** (steps, ramp, width) since
  that is what a wheelchair user needs to know first.
- Where the mosque provides it, prayer facilities information (ablution, women's prayer area) is shown;
  this is factual, not promotional.
- Attendance-confirmation pages inherit accessibility information for the chosen venue.

## 6. Organizer-facing behaviour

| Action | Rules |
|---|---|
| Create mosque | Requires name, type, address, coordinates, timezone; any organization member with the permission |
| Add/edit venue | Name, floor/level, capacity (optional), facilities; audited |
| Add entrance | Name, directions, active flag; used by the check-in console |
| Configure prayer-time source | Optional; must name the source; unavailable source → "perkiraan" behaviour, never a silent guess |
| Grant venue sharing | Explicit, per mosque/venue, revocable, expiring (default 12 months), audited |
| Mark mosques as related | Sibling mosques under one foundation; informational only |

## 7. Failure and edge cases

| Case | Expected behaviour |
|---|---|
| Two mosques with the same name in one district | Both exist; discovery disambiguates by area/coordinates; organizers see an "is this yours?" prompt |
| Mosque moved to a new address | Address history retained for past events; the public page shows the current address with a note for old events |
| Venue capacity unknown | Capacity is **blank**, never a guess; registration capacity is then independent of venue capacity with a note |
| Mosque closes | Events cancelled with reasons; archive kept; page shows closure notice |
| Duplicate mosque created by a volunteer | Merge tool that moves venues/events and keeps an audit trail; the duplicate becomes a redirect |
| Accessibility data disputed | Any user can report ("this entrance has steps"); the report goes to the mosque administrator; the page shows "informasi belum diverifikasi" until resolved |
| Prayer-time source unreachable | Times displayed as "perkiraan berdasarkan jadwal masjid" with the last known data and a timestamp |

## 8. Anti-requirements (deliberately not built)

1. No congregation membership registry, attendance tracking of individuals across events, or "regulars"
   list.
2. No mosque ranking, ratings, follower counts or popularity leaderboards.
3. No donation, payment or fundraising features.
4. No public exposure of internal administration (committee lists, private notes).
5. No "check in here to pray" mechanic — check-in exists only for scheduled kajian events, because
   attendance of worship is not our business.
