# F-020 DOC-ARCHIVE — IMPLEMENTATION

## Approach

`git mv` for the ten matrices, then a prepended annotation block per file,
inserted after the first `# ` heading so the original title still reads as the
title. The body is not touched.

The annotation names the specific wrong claim. A generic "this document is
outdated" loses to a specific one, because a reader who opens an archived file is
trying to believe something, and the job of the note is to say what not to
believe.

## Files

| File | Change |
|---|---|
| `MVP_AUDIT/README.md` | rewritten — the single pointer |
| `MVP_AUDIT/archive/` (10 files) | moved + annotated |
| `specs/yomi/features/F-020-DOC-ARCHIVE/` | this feature's spec |

## Script

One Python pass keyed by filename, with a per-file note body. The insertion point
is the first line starting with `# `; if there is none, the block goes first. A
file with no H1 therefore still gets its warning.

The first attempt at that script carried a leftover walrus assignment
(`f"{STAMP}\n\n# ARCHIVED — superseded\n\n{_ := ''}"`) in a variable that was never
used, and it raised `NameError` on the first file. Nothing was written, so the
retry was clean. The variable was deleted rather than fixed — there was nothing to
fix.

## What was deliberately not done

**The two non-Yomi screenshot scripts were not archived.** `screenshot.mjs`
captures `/sign-in`, `/today`, `/chores` (HomeOps) and `screenshot2.mjs` captures
`/start`, `/queue`, `/safety` (parking). They are another project's tooling. The
monorepo rule is that a task touches exactly one project folder; archiving them to
tidy Yomi's status would be the scope creep this repository's rules forbid. They
are labelled in the README instead.

**The `projects/`, `progress/`, `wave3/` and `screenshots/` subtrees were not
touched.** They are real evidence for eight projects, including Yomi's.

**The plaintext passwords in `SEED_DATA.md` were not repeated in the annotation.**
The seed now refuses to run without `SEED_ADMIN_PASSWORD` /
`SEED_READER_PASSWORD` from the environment, so the documented values are both
inert and something that must not be propagated. The note says so without
reproducing them.

## Risk

None. Moves and a prepended block. `git mv` preserves history, so `git log
--follow` still works on each archived file.

## Order of work

1. Read the ten files and extract the **specific** Yomi claim in each
2. `mkdir archive`; `git mv` the ten
3. Prepend the annotation, one per file, keyed by name
4. Rewrite `README.md` as the single pointer
5. Grep the root for surviving status claims; only the new README should match
6. Confirm no file under `yomi-*/src/` changed
7. Full regression gates
8. Commit as `F-020-S1`
