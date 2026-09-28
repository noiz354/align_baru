---
name: human-code-commenting
description: Use when writing or reviewing code comments and docstrings — explains why a decision was made, not what the line does, and states environment facts only after verifying them.
---

# Comments that earn their place

A comment should answer a question the reader would otherwise have to guess at. The
question is almost never "what does this line do" — the line says that. It is "why is
it like this, and what happens if I change it".

## The test

Delete the comment. Does the code become harder to understand, or merely shorter? If
merely shorter, the comment was restating code and it is noise.

```ts
// bad: restates the code
// increment the counter
counter += 1;

// good: answers a question the code cannot
// Starts at 1 because PostgreSQL bigserial would otherwise hand out 0 as a valid id,
// and 0 is falsy, which broke every `id && …` guard downstream.
```

## What belongs in a comment

- **Why this and not the obvious alternative.** The alternative is usually the thing a
  reader would try.
- **A constraint that is invisible in the code.** An invariant from a spec, an
  assumption about an external system, a deliberate omission.
- **Decision history, briefly.** "The other approach was tried and broke because…"
  saves the next person a day, and the reason is gone from the code.
- **A warning about a real hazard**, especially a hazard that looks harmless.

## What does not

- Restating the code.
- Section banners, decorative rules, ASCII dividers.
- Commented-out code. It rots, it lies about what is enabled, and version control
  already keeps it.
- "TODO" without an owner or a task ID. A TODO with a tracking ID is a task; without
  one it is a wish.
- **Unverified environment facts.** This is the one that actively harms people: a
  comment claiming a package is absent, or that a call site is wired, will be trusted
  and will be wrong. Verify it, or do not write it. `scripts/check-claims.mjs` checks
  the mechanical class of these against the tree.

## Voice

Write like a colleague leaving a note, not like a manual.

- Say what you know and what you inferred: "the CDN blocks this, so the browser comes
  from the npm registry" is useful; "this is required" is not, unless you say by whom.
- Keep it short. A four-line comment that answers the question beats a paragraph.
- Do not apologise, do not narrate the edit ("changed this to…"), and do not announce
  what the next block does.
- No filler openers. "Note that", "It's important to", "As mentioned above" cost a
  line and say nothing.
- Prefer the concrete over the general: `PGlite 0.5.8` beats "a lightweight in-process
  database".

## Code that is read by a learner

When a repository is used as a teaching artifact, the reasoning carries more value than
the brevity. Explain the *tradeoff* — what the obvious approach would have cost — and
not just the choice. A reader who understands why a decision was made will make the
next decision correctly, even if the rule they were given does not cover it.

## Reviewing comments

When you see one, ask: is it still true? Comments are the first thing to go stale,
because code changes and prose does not. A comment that has been wrong once will be
trusted again — that is the failure mode worth catching, and
`check-claims.mjs` exists for the checkable slice of it.
