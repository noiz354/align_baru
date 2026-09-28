---
name: spec-contradiction-ledger
description: Use when two documents in a repository disagree, or when the spec is ambiguous where you must choose — record the contradiction with both citations and a resolution, instead of picking silently and leaving no trace.
---

# Record the contradiction you had to resolve

A specification that contradicts itself is normal. The failure is resolving it
silently: the next person reads the code, assumes it was always the intent, and
re-introduces the other reading within a month.

## The rule

When you find two documents disagreeing, you have three options, and only one of them
is silent:

1. **Stop and ask**, if the choice is expensive to reverse or the intent is genuinely
   outside the docs.
2. **Pick, write it down, and cite both sides.**
3. Pick silently. ← This is the one that causes the next bug.

Option 2 is almost always available. The cost of writing a contradiction down is a
paragraph. The cost of not writing it down is that a decision is re-litigated by
someone with less context than you have right now.

## What a ledger entry contains

Enough that a reader who disagrees can find the other side:

- **ID and date** — stable handle, so later entries can reference it.
- **Both citations** — file and line for each conflicting statement. A paraphrase is
  not a citation; the point is to make the other side findable.
- **The conflict**, stated in one sentence — what cannot both be true.
- **The resolution and its authority** — which document wins, and on what grounds.
  A precedence order (PRD > ADR > design docs) is better than taste, because it is
  repeatable.
- **Consequences** — what had to change, what was left alone, what is now wrong but
  tolerated. That last category is the one people forget, and it is how tolerated debt
  becomes invisible debt.
- **Status** — resolved, open, or superseded by a later entry.

## Where to put it

One file, at the repository root or the relevant `docs/` directory, appended to and
never rewritten. `yomi` keeps `docs/architecture/spec-questions.md`; the format below
is what made it useful.

```markdown
## SQ-CAT-2 — genre slug derivation

- **Conflict**: `ARCHITECTURE.md` §4.1 says genre slugs are admin-managed and stored
  on the genre row (`schema.ts:88`). `catalog-facets.ts:41` derives them from the
  display name at query time.
- **Resolution**: derivation wins. Two sources for one identity is not an option; the
  stored column could not be kept in sync without a trigger nobody would remember.
- **Authority**: PRD FR-CATALOG-004 states slug is derived, not stored — the earlier
  doc was never updated.
- **Consequences**: the `slug` column stays for indexes but is no longer read. Any
  backfill is cosmetic.
- **Status**: resolved 2026-09-28.
```

## The spec question is not a bug report

Do not route a contradiction to the bug tracker as a defect. It is a documentation
defect with a decision attached, and it belongs where the decision is visible. Fix the
losing document in the same change, or mark it superseded — a document left in the
tree contradicting a decision is how the contradiction comes back.

## Also applies to code and spec

When code and spec disagree, the code is not automatically right just because it
ships. A skeleton that was filled in under a task has a narrower authority than an
Accepted ADR, but it is not nothing. Record it the same way, and cite which one you
believed and why.
