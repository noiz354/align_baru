# Product Spec — Issues

> Requirements: FR-ISSUE-001..009 · ADR: ADR-005 (issue lifecycle & boundaries) · Design: docs/design/PAGES.md §7, INTERACTION-PATTERNS §1 and §5 · Tasks: T-ISSUE-001..010

## Purpose

Capture what's wrong (a leak, a broken hinge, a strange smell) in **under 20 seconds**, keep it visible until it is genuinely fixed, and never become a suggestion box that quietly rots.

## The 20-second rule

| Step | Time budget | Detail |
| --- | --- | --- |
| Open | ~2 s | One tap from the dashboard quick action or bottom nav |
| Say what's wrong | ~8 s | Title only ("Kitchen tap drips") |
| Optional photo | ~5 s | Camera opens directly; upload failure never blocks submission |
| Submit | ~2 s | Room/asset/severity defaulted; the issue is created immediately |
| Optional detail | later | More can be added on the detail page afterwards |

If the flow ever exceeds this on a mid-range phone over 4G, it is a bug (QA-09 measures it).

## Lifecycle

```text
OPEN ──▶ ACKNOWLEDGED ──▶ IN_PROGRESS ──▶ RESOLVED ──▶ CLOSED
   │            │               ▲              │
   └────────────┴───────────────┴──────────────┴──▶ WONT_FIX (reason required)
```

| Transition | Meaning | Notes |
| --- | --- | --- |
| → `ACKNOWLEDGED` | "I've seen this and I'm taking it" | Stops escalation; the alert stays open (I-ISSUE-003) |
| → `IN_PROGRESS` | Work has started | Optional but useful ("plumber coming Thursday") |
| → `RESOLVED` | Fixed | Requires an actor; a note is encouraged, never required |
| → `CLOSED` | Verified and done | Reporter/OWNER/ADMIN; moves the issue out of the active list |
| → `WONT_FIX` | Deliberately not fixing | Reason required — this is what makes the record honest |
| `RESOLVED → IN_PROGRESS` | It came back / it wasn't fixed | Allowed and recorded; no shame mechanics |
| Reopen a `CLOSED` issue | Not allowed | Report a new issue with a link to the old one (keeps history linear) |

Every transition appends an audit row (who, when, from → to). The issue is the *problem record*; the *fix* may be a chore, a maintenance record, or nothing (ADR-005).

## Severity → urgency

| Severity | Meaning | Alert behaviour |
| --- | --- | --- |
| `SAFETY` | Risk of injury/fire/flood (gas smell, exposed wiring, water near electrics) | URGENT immediately; **bypasses quiet hours**; always reaches at least one OWNER/ADMIN |
| `HIGH` | Needs attention soon (leak under the sink, broken lock) | IMPORTANT immediately |
| `NORMAL` | Default — should be fixed, no hurry | Delayed alert after the household-configured window (default 24 h) |
| `LOW` | Cosmetic / nice to fix | ATTENTION after the window; grouped in the alert list |

The delay for NORMAL/LOW is deliberate: a dripping tap reported at 23:00 should not wake anyone, but it must not vanish either.

## Assignment

Any member can assign, claim, or unassign. An assignee may be a member or "external" (vendor) with a free-text note. Assignment re-targets the alert and notifies only the new assignee. Unassigned issues belong to the household pool and alert the owner role.

## Photos

Optional, up to 5 per issue, ≤ 5 MB each, JPG/PNG/WebP, EXIF (including GPS) stripped on ingest. Stored server-side, served only to household members through an authenticated route (SECURITY.md §9, PRIVACY.md §6, proposed ADR-017). A photo is never required to submit or to resolve.

## Comments

Append-only, 1–1000 characters, optional photo. Comments do **not** notify anyone by default (silence is a feature here) — the issue's own alert carries the urgency. Closed issues reject new comments with a clear explanation and a "report a new issue" action.

## Resolution and follow-ups

Resolving offers optional follow-ups that create real entities in the right module: "add to maintenance" (a record/plan touch), "add a chore" (one-off occurrence), or nothing. Follow-ups reference the issue; they never delete or rewrite it. This is how HomeOps avoids a parallel "task system" hiding inside issues.

## Edge cases

1. **Two members acknowledge at once:** first wins; the second sees "Budi already took this" without error.
2. **Issue resolved before the delayed alert fires:** no alert is created (the condition is gone) — the delay is not a queue of stale problems.
3. **SAFETY issue at 02:00:** alert created and delivered (quiet hours bypassed); if the household's phone is off, the issue remains the top item on the dashboard.
4. **Photo upload fails mid-report:** the issue is still created; the detail page shows a retry for the photo (two-phase, I-ISSUE-005).
5. **Issue about a room that gets archived:** the issue stays valid, keeps its room reference as a snapshot label.
6. **Duplicate reports of the same leak:** the UI hints at nearby open issues while typing the title; merging is not automated, but linking is offered.
7. **HELPER reports an issue:** fully allowed — this is one of their three core capabilities — but they cannot close it.
8. **A `WONT_FIX` issue returns:** a new issue links to it; the history shows the decision and who made it.

## Accessibility

The report form is a single field plus optional controls; severity is a labelled radio group with plain-language descriptions ("Safety — could hurt someone"); status changes are announced; photo capture has a non-camera fallback (file picker) and a text-only path. See ACCESSIBILITY.md §7 and T-ISSUE-* assertions.

## Deliberately absent

Ticket numbers (ids exist but are not the interface), SLA timers, priority matrices with four dimensions, escalation ladders to "management", customer-facing status pages, auto-classification by AI, and sentiment analysis of comments. An issue in a home is a shared fact, not a ticket in a queue.
