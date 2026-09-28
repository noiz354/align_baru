# Yomi — Product Definition

**Status:** canonical. This file answers exactly one question: *what product is Yomi?*
Everything about *what must be built* lives in [MVP.md](MVP.md). Everything about
*how it behaves* lives in [USER_JOURNEYS.md](USER_JOURNEYS.md) and the per-feature
`SPEC.md`. Nothing in this file may be used as a completion claim — completion is
recorded in [execution/CHECKLIST.md](execution/CHECKLIST.md) with evidence.

## What Yomi is

A self-hosted manga and comic reader. One reader, one shelf, one library of
scanned or uploaded chapters, and a reader that behaves the same on every page.

## Who it is for

**The reader.** Someone with a shelf of manga they want to read, keep, bookmark,
and come back to. They are not browsing a catalogue with no intention to read; they
want to continue something, and they want their place kept. Their three needs, in
order:

1. **Resume.** Open the app, land on what they were reading, at the page they left.
2. **Find.** Search by title, including CJK and romanised aliases.
3. **Keep.** Library, bookmarks, history — the record of what they read and what
   they meant to come back to.

**The operator.** A single person who puts manga into the system. They are not a
content team; there is no workflow to orchestrate. They need to add a title, add
chapters with page images, mark them published, and see what failed.

## What Yomi is not

- **Not a multi-tenant SaaS.** One deployment, one operator, no billing, no
  per-seat pricing, no org tree.
- **Not a discovery feed.** No trending, no recommendations, no "for you". Search
  and the shelf are the whole of discovery. The absence of a recommendation engine
  is a decision, not an omission.
- **Not a social reader.** No comments, no follows, no activity sharing, no public
  profiles.
- **Not a downloader.** Yomi serves images from its own object storage over an
  application-mediated route ([ARCHITECTURE.md §6](ARCHITECTURE.md)). It does not
  scrape, and it does not proxy third-party image hosts.
- **Not a client for a remote service.** There is no Yomi API for someone else's
  app to consume.

## The three commitments

These are the product's real quality bar. A change that violates one of them is
wrong even if its tests pass.

### 1. A reader's record is never silently wrong

Progress, completion, library, bookmarks and history are the reader's own record of
their reading. The worst failure mode for this product is not a page that 500s — it
is a page that renders confidently and has quietly lost the reader's place, or has
marked a finished chapter as unread. Every write to `reading_progress` is therefore
guarded against a stale or repeated write, and no write path may bypass the
repository that owns the invariant. See [DATA_MODEL.md §5](DATA_MODEL.md).

This is why F-006 (delete the direct-database write path) is a P0: at the time of
writing, the reader's own save route overwrites `completed` with `false` on every
page change, erasing a finished chapter.

### 2. Anonymous visitors are first-class

Discover, manga detail, chapter reading and **search** must work with no account.
The operator's catalogue is not behind a login. Only the reader's *own record*
(library, bookmarks, history, progress, preferences) requires a session.

Search being anonymous is not incidental — it is why search could be built and
shipped while the account system was still unfinished, and why it is the flagship
of the current execution track.

### 3. Refusal is honest

When Yomi cannot do something it says so in a way that is true. It does not render
a plausible-looking empty state for data it failed to load, and it does not shorten
a value to fit. A note that is too long is refused, not truncated. A page image
that will not load says the image did not load. A placeholder page states that it
is a placeholder.

This is the standing argument against the `WIRED` bucket that was deleted from the
status checker in `ab19d63`, and against the 15 archived `MVP_AUDIT` documents
(F-020): a status that counts an unimplemented thing as progress is the failure
mode this commitment exists to prevent.

## Non-goals, stated once

Anything not in the reader or operator sections above is out of scope for the MVP.
Specifically: accounts beyond sign-in, password reset by email, social login,
2FA, per-user content ratings, reading statistics dashboards, offline mode, native
mobile clients, and a public API. If a future change needs one of these, it is a
new feature with its own spec, not an extension of this one.

## What "real" means for this document

Every claim above is a design commitment. None of them is a status report. For
what is built, what is broken and what is next, read
[execution/CHECKLIST.md](execution/CHECKLIST.md) and nothing else.
