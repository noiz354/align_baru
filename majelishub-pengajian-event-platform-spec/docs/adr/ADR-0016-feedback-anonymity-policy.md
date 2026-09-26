# ADR-0016 — Feedback anonymity and visibility policy

- Status: Accepted · Date: 2026-09-26 · Deciders: Product, Privacy, UX
- Requirements affected: FR-FEEDBACK-002/003/004/005/008 · Related: ADR-0024, `FEEDBACK.md`, `PRIVACY.md`

## Context

Feedback exists to improve operations (sound, venue, registration friction, relevance), not to
rate people. Two tensions:

- **Candour vs. accountability.** Attendees are more honest anonymously, especially about
  venue/PA problems or an organizer's mistakes. But identification enables follow-up and reduces
  abusive submissions.
- **Speaker visibility.** A speaker genuinely benefits from knowing that the audio was
  inaudible or the topic was too advanced. But speaker-visible raw comments create a
  public-opinion dynamic the product must avoid (`ADR-0024`).

Religious context raises the stakes: a comment about *content* can slide into theological
critique of a person, which is not the product's purpose and is not something we should
industrialise.

## Decision

1. **Anonymity is offered per submission, and it is real.** If a participant chooses anonymous,
   the system **does not store** a link between the feedback row and any participant identity —
   retention of a "who said it (but hidden)" column is forbidden. A salted, per-event pseudonym
   may be used only for rate limiting, and is not reversible to an identity.
   - Rate limiting for anonymous feedback uses a rotating, per-event key derived from the
     capability token, stored as a hash, deleted with the token (`RETENTION.md`).
2. **Identified feedback** is also supported (the participant may want a reply, e.g. about an
   accessibility need).
3. **Visibility:**
   - **Organizers** (role-scoped to the event) see all feedback for their events, with the
     sender identified only when the sender chose identified.
   - **Speakers** see (a) aggregate ratings for events they spoke at, and (b) comments filtered
     to **operational relevance** — the free-text is shown to the speaker only when the
     submitter opted in to "share with the speaker", otherwise the organizer sees it and may
     forward it manually with the submitter's context. Default is **not shared**.
   - **Participants** see nothing: no public comments, no averages.
   - **Platform admins** see aggregates to operate the platform, not individual free text,
     except through a moderation/report path.
4. **No public display, ever.** No speaker averages on public profiles, no "rating" stars
   anywhere participant-facing, no comparisons, no leaderboards (`FR-FEEDBACK-005`).
5. **Dimensions are operational**: registration experience, venue, sound quality, topic
   relevance, event organization, overall experience. There is **no** "was the speaker good?"
   dimension and no "religious accuracy" dimension. A comment box labelled with an explicit
   scope: "Tentang penyelenggaraan dan fasilitas" (about organization and facilities).
6. **Abuse handling:** comments can be reported (including by the speaker) and hidden without
   deleting the audit trail; repeated abusive submitters are rate-limited.

## Alternatives considered

- **Anonymous-only.** *Gains:* maximum candour. *Costs:* no follow-up for accessibility or
  safety issues; more abuse; less accountability. *Rejected as the only mode* (offered as one
  of two).
- **Identified-only.** *Gains:* accountability, follow-up. *Costs:* systematically suppresses
  the venue/PA complaints that organizers most need; in a small community, criticism is
  socially costly. *Rejected as the only mode.*
- **Fully public feedback (as on commercial platforms).** *Costs:* turns private operational
  critique into public reputation; creates ranking pressure by the back door (violates
  `NFR-ETH-001`). *Rejected outright.*
- **Star ratings on speaker profiles.** *Costs:* implies religious authority is measurable.
  *Rejected outright* (this is why there is no speaker-quality dimension).
- **LLM sentiment/thematic summaries of comments** shown to organizers. *Gains:* triage at
  scale. *Costs:* misinterpretation of context, another place where machine output could be
  taken as authoritative. *OPTIONAL and gated:* allowed later only as a clearly-labelled
  assistive summary of *operational* themes, with the raw comments always available.

## Consequences

**Positive:** honest operational signal; speakers get useful signal without a popularity
dynamic; participants are told the truth about anonymity (which is enforceable and testable);
abuse is contained.

**Negative:** organizers must actively forward relevant comments to speakers, or the speaker
learns less; anonymous submissions cannot be individually followed up; the aggregate view for
speakers has a minimum-sample threshold to avoid identifying a single respondent (n < 5 → show
"belum cukup data", which is also honest).

**Neutral:** the choice of anonymity is stored on the row (`is_anonymous`) so that reporting and
UI labelling are unambiguous; it is *not* a pointer to a person.

## Enforcement

- Schema check: `is_anonymous = true ⇒ registration_id IS NULL AND participant_contact IS NULL`
  (a check constraint, not a convention).
- A test asserts no code path re-links anonymous feedback to a registration after submission
  (including audit events: the audit entry must not name the participant).
- A test asserts public pages never render feedback ratings.
- A test asserts the speaker-facing view shows aggregates only below/above the small-sample
  threshold correctly.

## Revisit trigger

Reopen if: a deployment demonstrates that anonymous feedback is systematically unusable
(spam-dominated), or a regulatory requirement demands attribution for a specific purpose. The
n<5 threshold and share-with-speaker default are tunable per deployment **only** within the
visibility rules above; the no-public-ranking rule is never revisited (ADR-0024).
