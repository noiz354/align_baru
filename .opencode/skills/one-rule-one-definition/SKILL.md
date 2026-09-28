---
name: one-rule-one-definition
description: Use when the same rule appears in two places — a TypeScript helper and a SQL string, a validator and a form, an API and a fixture — or when adding a third copy of an existing rule.
---

# One rule, one definition

A rule that exists twice has already diverged or will. The second copy is not a
convenience; it is a second source of truth with no compiler watching it.

## The shape of the bug

In `yomi`, genre slugs were derived in two places: a TypeScript function for the
facet layer, and a SQL expression in the repository query. Both were correct on the
day they were written, and they produced the same output. A genre name with an
apostrophe or a non-ASCII character made them disagree, and the disagreement surfaced
as a filter that silently returned nothing — no error, just an empty list.

Nothing in the type system connects a string in a `.ts` file to a string in a `.sql`
tagged template. The duplication was invisible until a data value happened to hit it.

## Where duplication hides

- A rule in application code and again in a SQL query or a database function.
- A validation rule in a shared schema and again in a form or a client check.
- A default value in the API and again in the client that reads it.
- A rule in a fixture and again in the code it stands in for. (See
  `test-the-shipping-code`.)
- A rule in code and again in a comment. The comment will be wrong first.

## What to do instead

In rough order of preference:

1. **Derive once, at the boundary.** If the database can derive it, let the database
   do it and return the derived value. No second implementation to drift.
2. **Generate.** One source file; emit the SQL string or the schema from it. The build
   fails if generation is stale.
3. **Share the constant.** For a list or an enum, one module owns it and both sides
   import it. This is weaker than it looks — a raw SQL string cannot import anything,
   so prefer (1) or (2) there.
4. **Parity-test it.** When you are stuck with two copies, write a test that runs the
   same inputs through both and asserts equal output over a corpus that includes the
   awkward cases: unicode, punctuation, empty string, very long input, leading and
   trailing whitespace. A parity test on three friendly ASCII samples proves nothing.

## When you find one

Do not silently fix the divergence and move on. The interesting part is *why* two
copies existed — usually a boundary the original author could not see across. Write
down the cause, because the next rule will be duplicated the same way.

## Detecting new ones

When adding a rule, ask: "does this string now exist anywhere else?" Grep for the
distinguishing substring. If a second location matches, either remove it or make the
parity explicit in a test. A comment is not a third-safe place to put it.
