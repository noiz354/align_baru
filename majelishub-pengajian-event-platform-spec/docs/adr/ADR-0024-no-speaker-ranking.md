# ADR-0024 — No ranking, popularity or authority scoring of speakers

- Status: Accepted · Date: 2026-09-26 · Deciders: Product, UX, Engineering (unanimous)
- Requirements affected: FR-SPEAKER-007, FR-FEEDBACK-005, NFR-ETH-001, NFR-ETH-004
- Related: `FEEDBACK.md`, DESIGN.md §Anti-patterns, ADR-0016

## Context

Every comparable platform eventually grows a ranking surface: "most popular ustadz", star
ratings, follower counts, trending kajian, recommended speakers. The mechanics are well
understood and the engagement effects are real.

In this domain they are unacceptable for four reasons:

1. **Religious authority is not a metric.** A ranking implies the platform asserts which teacher
   is better to learn from. That is a religious judgement the platform has no standing to make.
2. **Harm to speakers.** Low rank is a public judgement on a person's religious service, and
   ranks invite gaming (volume over depth, controversy over care).
3. **Harm to participants.** Ranking encourages picking by popularity rather than locality,
   language, topic-fit, and the recommendation of one's own mosque — the actual criteria for a
   weekly kajian.
4. **Harm to the product.** Engagement optimisation pulls the roadmap toward feeds, notifications
   and public comment — away from the entrance, the archive and the transcript.

## Decision

MajelisHub **never** computes, stores, exposes, or exports a ranking, score, rating, follower
count, popularity metric or authority metric for a speaker, at any layer:

- **Data model:** no such column, no derived view, no aggregate that could produce one.
- **API:** no endpoint returns a comparative metric about speakers; feedback aggregates are
  scoped to a single speaker/event and shown only to authorized roles (`ADR-0016`), never in a
  comparative list.
- **UI:** no stars, no badges for volume, no "top" lists, no trending, no "recommended for you"
  driven by engagement, no speaker sort by "popularity". Discovery sorts by time, distance,
  relevance to an explicit filter, and recency of publication — all explainable and
  non-evaluative.
- **Notifications:** no prompts to "give feedback to help others choose", no "this speaker is
  popular" content.
- **Exports/analytics:** attendance and rating aggregates are per-event operational data; a
  comparative speaker report is not provided.

Verification status (`FR-SPEAKER-002`) is explicitly **not** a rank: it states that the platform
confirmed the person's identity/affiliation, shows the verifier, and is never ordered,
scored or displayed comparatively.

## Alternatives considered

- **Opt-in "recommended speaker" with engagement weighting.** *Costs:* any weighting is a
  ranking in disguise; opt-in does not protect the speakers who decline and are then implicitly
  ranked below. *Rejected.*
- **Internal-only scoring for search ranking.** *Costs:* internal weights leak into user-visible
  ordering; "we do not show it" is not a durable promise. *Rejected:* search ranking uses only
  textual relevance, recency and explicit filters (`ADR-0014`).
- **Aggregate ratings visible publicly without names.** *Costs:* still creates comparative
  pressure and invites manipulation of anonymous submissions. *Rejected.*
- **Ratings visible to organizers to help them select speakers.** *Costs:* organizers comparing
  teachers on a platform-provided number; the platform becomes the arbiter. *Rejected:*
  organizers may review feedback for events they ran, with a stated purpose of improving
  operations (sound, venue, topic level) — not of ranking individuals.

## Consequences

**Positive:** the product stays usable as a calm, informational service; speakers can join
without reputational risk; participants choose on real criteria; the roadmap is defended from
engagement-driven requests; nothing must be unwound later.

**Negative:** some organizers will ask for "top speakers" reports (they will get per-event
operational feedback instead); some growth metrics cannot be computed (we do not optimise for
them anyway — `PRD.md` §18 anti-metrics).

**Neutral:** per-event attendance numbers remain available; they are operational facts, not a
speaker evaluation, and are not aggregated into a speaker-level metric.

## Enforcement

- Schema/review: any PR adding a metric-like column or endpoint about speakers is rejected with
  a pointer to this ADR.
- A test asserts the speaker public page and API responses contain no numeric evaluative field
  (schema-shape assertion on the public DTO).
- A test asserts no speaker list endpoint accepts a `sort=popularity|rating|followers` parameter.
- `docs/architecture/FINAL-REVIEW.md` keeps this as a standing review question.

## Revisit trigger

**Never.** (This is the ADR's whole point.) The only permitted future change is *adding* reader
affordances that are explicitly non-evaluative, e.g. "shares the same area of study" or "also
speaks at this mosque" — and even those require a new ADR demonstrating that no implicit ranking
is created.
