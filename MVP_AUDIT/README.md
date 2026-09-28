# MVP_AUDIT — cross-project audit history

**This directory is history. It is not a status source.**

If you are looking for what is built, what is broken, or what happens next, the
answer is one file:

> **`yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md`**

That checklist is the only operational source of execution status in the Yomi
project, and it is the only place a completion claim is recorded. Nothing in this
directory overrides it.

## Why this directory exists at all

It is a **monorepo-wide** audit covering eight projects. It is kept because the
screenshots and the per-project history are real evidence, and because deleting
other projects' audit work to tidy up Yomi would be exactly the kind of scope
creep this repository's own rules forbid.

| Subdirectory | What it is | Keep? |
|---|---|---|
| `archive/` | 10 superseded status matrices, annotated, not deleted | history |
| `screenshots/` | captured UI per project, including `yomi/` and its `archive-20260928-182959/` | evidence |
| `projects/` | per-project audit write-ups | evidence |
| `progress/` | per-project before/after progress notes | history |
| `wave3/` | wave-3 working notes | history |

## What was archived and why (F-020-S1, 2026-09-28)

Ten markdown files were moved to `archive/` and annotated in place. Each note
names the specific claim that is false rather than saying "outdated", because a
reader who opens an archived file is trying to believe something, and a generic
disclaimer loses to a specific one.

The worst of them:

**`MVP_MATRIX_FINAL.md`** — a file named FINAL. Yomi at `7af4e6a` has no way to
create an account, a search page that renders `NotYetBuilt`, a reader that erases
chapter completion on every page change, and seven placeholder admin pages.

**`MVP_MATRIX_WAVE3.md`** — grades Yomi `MVP_PARTIAL` on "authenticated
user-owned library, bookmarks, and progress". The **isolation** claim is real and
mutation-proven. The **authentication** claim cannot be: `grep "insert(users)"
src/` returns zero hits. A seeded account can sign in, which is how the library
was verified — a much narrower claim than the row makes.

**`SEED_DATA.md`** — documents plaintext seed passwords. The seed now *refuses to
run* without `SEED_ADMIN_PASSWORD` and `SEED_READER_PASSWORD` from the
environment and will not invent them (SECURITY.md §9: env-injected only). The
values are deliberately not reproduced in the annotation.

**`WAVE3_REGRESSION.md`** — claims progress "survives logout/login". The
isolation half is proven; the logout/login half could not have been observed,
because no account can be created through the application.

## The screenshot scripts

There are three, not ten — an earlier note in the master gap audit said ten, which
was wrong.

| Script | Project | Keep? |
|---|---|---|
| `screenshot-yomi.mjs` | Yomi (`/discover`, `/library`, `/history`, …) | ✅ the working one |
| `screenshot.mjs` | **HomeOps** (`/sign-in`, `/today`, `/chores`) | left in place — another project's tooling |
| `screenshot2.mjs` | **Parking attendant** (`/start`, `/queue`, `/safety`) | left in place — another project's tooling |

The two non-Yomi scripts are **not** archived. They belong to other projects, and
this repository's rule is that a task touches exactly one project folder. Tidying
Yomi's status must not restructure another project's evidence.

## The one Yomi status file that is NOT history

`yomi-manga-reader-arch-skeleton/MVP_AUDIT/YOMI_MASTER_FEATURE_GAPS.md` — the
feature-gap audit that the master execution plan is derived from. It lives inside
the Yomi project, and the checklist supersedes it for status. It is kept because
it carries the *why* behind the plan.

## Rules for this directory going forward

1. A file here may not state that something is done. That belongs in the checklist.
2. Archiving annotates; it does not delete. A reader arriving later deserves to
   know which belief was wrong and why.
3. Do not merge, move, or reformat another project's audit material. Label it.
