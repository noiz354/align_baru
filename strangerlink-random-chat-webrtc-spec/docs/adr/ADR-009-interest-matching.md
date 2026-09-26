# ADR-009 — Interest Matching

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-008](ADR-008-matchmaking.md), [ADR-014](ADR-014-anonymity-model.md)

## Context

"Match by interests/tags" is a headline feature of this category of product. It is also
the feature most likely to erode the privacy and simplicity that make the product
distinctive.

Interests are user-supplied free text. Left unconstrained, they become:

- a **de facto public profile** — the exact thing we promised not to require (NG-1);
- a **deanonymisation vector** — "uni student in Padang, likes X band" is a lot of
  identifying information about an "anonymous" user;
- a **moderation surface** — interests are user content and need the same treatment as
  chat messages;
- a **starvation generator** — very specific interests never match.

## Problem

How should interest and language matching work, and what constraints keep them from
becoming a profile?

## Decision Drivers

1. **Match quality** — does it actually help people have better conversations?
2. **Privacy** — interests must not become an identity.
3. **Abuse surface** — interests are user-supplied content.
4. **Starvation** — nobody should wait forever because their interests are niche.
5. **Simplicity** — a small team must operate the tag vocabulary.
6. **Data minimisation** — NFR-PRIV-004.

## Options Considered

### Option A — No interests at all

**Strengths:** Simplest, most private, no moderation surface.

**Weaknesses:** Removes a genuinely useful feature for language learners and people
looking for a specific kind of conversation.

### Option B — Free-text interests, matched by string similarity

**Strengths:** Maximum expressiveness.

**Weaknesses:** Becomes a profile. Requires text moderation. Similarity matching is fuzzy
and unpredictable. High abuse surface. **Rejected.**

### Option C — Curated tag vocabulary (closed set), optional, never a guarantee

The user picks from a fixed list of tags and a language. Matching prefers overlap but
always falls back to the general pool after a bounded wait.

### Option D — Curated tags plus optional free-text "topic" line

**Strengths:** Slightly richer.

**Weaknesses:** The free-text line is a profile field with all of Option B's problems.
Deferred; not adopted.

## Decision

**Adopt Option C: a curated, closed tag vocabulary, optional, with guaranteed fallback.**

### Rules

| ID | Rule |
| --- | --- |
| IM-1 | Interests are selected from a **closed, server-controlled vocabulary**. Free text is not accepted. |
| IM-2 | Interests are **optional**. The default experience requires none. |
| IM-3 | Interests are **never displayed to the peer**. They are a matching input only. |
| IM-4 | Interest overlap is a **preference**, never a guarantee (FR-MATCH-007). |
| IM-5 | Language is a **preference**, never a guarantee (FR-MATCH-008). |
| IM-6 | After a bounded interest-preference wait, the participant falls back to the general pool for their mode. |
| IM-7 | A participant may carry at most a small number of tags (see [MATCHMAKING.md](../MATCHMAKING.md)) — enough to be useful, not enough to be a profile. |
| IM-8 | The vocabulary is versioned; adding a tag is a reviewed change, not a runtime edit. |
| IM-9 | Interests are stored with the queue entry and are **discarded when the queue entry is discarded**. They are not a durable user attribute. |
| IM-10 | Region constraints, where enabled, are a matching filter, not a hard geo-fence. |

### Why the vocabulary is closed

A closed set means: no text moderation of interests, no free-text leakage into matching,
no profile construction, and a matching function that is a set-intersection rather than a
fuzzy text search. The cost — less expressiveness — is accepted deliberately.

### Why interests are never shown to the peer

Showing them turns "we both like hiking" into a conversation opener that reveals the
other person's selections, which over a few sessions is a profile. Keeping them invisible
preserves the "random stranger" character of the product.

## Consequences

**Positive**

- No free-text moderation surface for interests.
- Matching is a cheap set intersection.
- Interests cannot accumulate into a durable profile.
- Starvation is bounded by the guaranteed fallback.

**Negative**

- Users who want to describe themselves precisely cannot.
- The vocabulary needs curation and versioning.
- Some users will be matched with someone who shares no interests, which can feel like a
  broken promise unless the UI is honest about it (see below).

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| Niche-tag starvation | Medium | High |
| Vocabulary becomes unwieldy | Low | Medium |
| Users believe interests are guaranteed | Medium | High |
| A tag is added that is itself offensive or identifying | Medium | Low |

## Mitigations

- **MR-1:** Bounded preference wait with automatic fallback to the general pool; the UI
  states that interests are a preference, not a filter.
- **MR-2:** Vocabulary is reviewed and versioned; changes go through the same review as
  any other user-visible copy.
- **MR-3:** UI copy explicitly says "we'll try to match your interests" rather than
  "we'll match your interests".
- **MR-4:** New tags are reviewed for identifiability and offensiveness before release.

## Revisit Conditions

- Users consistently report that interest matching does not work → consider a
  two-tier vocabulary (broad + narrow) rather than free text.
- We add language-learning as a primary persona → language matching may be promoted from
  preference to a stronger constraint, which requires revisiting the fallback rule.
- Free-text topics are requested → requires a privacy impact assessment and a new ADR;
  the default answer is no.

## References

- [MATCHMAKING.md](../MATCHMAKING.md)
- [ADR-008](ADR-008-matchmaking.md)
- [ADR-014](ADR-014-anonymity-model.md)
- [PRIVACY.md](../PRIVACY.md)
- [TASKS.md](../TASKS.md) — T-MATCH-031
