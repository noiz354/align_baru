# PRODUCT SPECIFICATION — SPEAKERS (USTADZ / USTADZAH)

Requirements: FR-SPEAKER-001…008 · Ethics: NFR-ETH-001 · ADR: ADR-0014, ADR-0024

---

## 1. What a speaker profile is

A speaker profile is a **professional and educational record** of a person who teaches: who they are,
what they study, where they have taught, in which languages, and how to contact them *for organizing
purposes*. It is a directory entry, not a scoreboard.

A speaker is **not** an employee, not a content creator to be promoted, and never an object of public
comparison. The product must be safe to hand to a person whose reputation matters more than any app.

## 2. Fields (each with purpose and visibility)

| Field | Purpose | Visibility | Notes |
|---|---|---|---|
| Full name, display name with honorifics | Identification, correct address in print | Public | Free text; honorifics never normalised away |
| Areas of study / specialities | Matching speakers to kajian topics | Public | Controlled vocabulary + free text |
| Languages | Whether the audience can follow | Public | Includes Arabic/Indonesian/local languages |
| Short biography | Context for the audience and organizers | Public | Written or approved by the speaker; editable |
| Education / teachers, with consent | Credibility context *stated by the person*, not scored | Public if provided | Optional; never ranked |
| Affiliations (mosques, institutions, communities) | Trust and scheduling context | Public if provided | Relationship to a mosque is data, not endorsement |
| Public contact channel (organizer contact) | Coordination | Restricted to verified organizers | Not a personal phone by default |
| Availability preferences (days/areas) | Reduce back-and-forth | Restricted to organizers | Optional |
| Travel/area preferences | Practical planning | Restricted | Optional |
| Verification state | Whether the profile is claimed/verified | Public (as a badge on the profile) | See §4 |

Fields **never** collected: national ID numbers, home address, personal phone (unless the speaker
insists and understands the exposure), financial details, family details, anything about the speaker's
private life, and any metric of "influence".

## 3. Public profile page (design intent)

Order of information — this order is a product decision, not a preference:

1. Name and honorifics, photo (only if the speaker provided one).
2. One-line description: areas of study + languages.
3. Upcoming public events (if the organizer published them).
4. Past **published** recordings/transcripts (archive links; no counts shown as a metric).
5. Biography in the speaker's own words.
6. A quiet statement of verification state.

What is deliberately **absent**: follower counts, likes, ratings, "trending", "most requested", view
counts displayed as achievement, comparisons with other speakers, and any leaderboard of any kind —
enforced by tests (`T-SPEAKER-004`).

## 4. Verification

| State | Meaning | How reached |
|---|---|---|
| UNCLAIMED | Created by an organizer who invited the speaker | Automatic on creation by an organizer |
| CLAIMED | The person has confirmed control of the profile | Authenticated claim by the speaker |
| VERIFIED | The platform has confirmed the identity claim | Platform reviewer, with evidence recorded (audited) |
| DISPUTED | Someone has challenged the profile or its details | Report flow; the profile shows a neutral notice until resolved |

Rules: an unclaimed profile is never presented as the speaker's own statements; biographies written by
an organizer are labelled ("ditulis oleh penyelenggara"); a speaker can always request corrections and,
after claiming, control the profile.

## 5. Organizer behaviour (how a speaker is attached to an event)

1. Organizers search speakers by name, area of study, language and area, or invite a new one.
2. **Invitation, not assignment.** Adding a speaker to an event creates an invitation with a
   confirmation state (`INVITED → CONFIRMED → DECLINED`), visible to the organizer and reflected on the
   public event page only after confirmation (an unconfirmed speaker is never advertised).
3. Recurring programs can carry a default speaker whose confirmation is requested per occurrence, so no
   one is silently committed to a year of Sundays.
4. A speaker's decline is a first-class, respected outcome: it cancels the event's speaker assignment,
   notifies the organizer, and triggers the replacement flow. No "ask again tomorrow" automation.
5. Contact happens through the platform's notifications only after confirmation; before that, only the
   organizer's own channel as recorded.

## 6. Behaviour when things go wrong

| Case | Expected behaviour |
|---|---|
| Wrong person created (namesake) | Merge/disambiguate with audit; the wrong profile is unlinked without deletion |
| Speaker disputes an attribution | Immediate unpublish path for the affected media (T-AUDIO-008), notice on the item, investigation recorded |
| Speaker asks for profile deletion | Profile de-linked from events (events keep the factual title), archive items follow CONTENT.md §10; personal fields removed |
| Speaker becomes unavailable for a confirmed event | Reschedule/cancel flow with notifications; not a silent removal |
| Organizer adds a speaker without consent | Invitation flow makes the confirmation state visible; the speaker can decline or dispute |
| A speaker asks to see "how they compare" | The request is refused, and the answer explains why (no ranking is produced or stored) |

## 7. Anti-requirements

1. No rating, review, endorsement or "authority" score of a speaker — not even internal-only, because
   internal scores leak into behaviour and eventually into UI.
2. No public popularity ordering, view counts as status, or "top speakers" lists.
3. No automated inference about religious authority, credentials or ideology.
4. No scraping or importing of speaker data from other platforms.
