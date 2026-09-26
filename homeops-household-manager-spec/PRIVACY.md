# PRIVACY.md — Privacy Principles & Data Handling

> 2026-09-26 · Status: **SPECIFIED, NOT IMPLEMENTED**
> HomeOps holds family-scale sensitive data: who is home when, what is broken, what is running out, and photos of the home. The product is deliberately **not** a surveillance tool: no presence, no location, no behaviour scoring, no analytics.

## 1. Principles

| # | Principle | Concrete consequence |
| --- | --- | --- |
| PP-1 | **Data minimisation** | Collect only what a feature needs. No birthdates, no phone numbers, no addresses, no government IDs, no financial data. Email is optional (invite links can be shared manually). |
| PP-2 | **Household isolation** | Data never leaves the household; there is no cross-household aggregation, comparison, or "similar households" feature (ADR-005). |
| PP-3 | **No third-party analytics or tracking** | No analytics SDKs, no pixels, no session replay, no heatmaps, no external fonts, no CDNs that observe users. |
| PP-4 | **Purpose-limited notifications** | Push payloads carry a minimal summary + deep link; no free text, no photos, no names-by-default (NFR-PRIV-008). |
| PP-5 | **Logs are not a data store** | Logs carry ids and outcomes, never content (NFR-PRIV-003, ADR-015). |
| PP-6 | **Retention is bounded and enforced** | Every high-volume record has a retention window and a prune job (table below). |
| PP-7 | **Deletion is possible and honest** | Records are hard-deleted when they have no audit value; soft-deleted with a grace period when they do; household deletion is an operator-verified process with a written procedure. |
| PP-8 | **Export belongs to the household** | The owner can export the household's data as JSON at any time (FR-SET-005, NFR-PRIV-005). |
| PP-9 | **No surveillance features** | No presence detection, geofencing, "who's home", read receipts, typing indicators, per-person statistics, streaks, or leaderboards (PRD NG-3, NG-7). |
| PP-10 | **Photos are first-class PII** | Access-controlled, EXIF-stripped (including GPS), never in notification payloads, never in logs, deletable. |
| PP-11 | **Children and guests** | The app targets adults. If a household stores another person's name (e.g. a helper or a guest in a note), that is the household's decision — but the app never requires it. |
| PP-12 | **Transparency with members** | Members can see what is recorded about their actions (activity history) — this is accountability, not surveillance: the same data is equally visible to everyone in the household. |

## 2. Data inventory (what is stored, why, and for how long)

| Data | Purpose | Sensitivity | Retention | Owner-visible? |
| --- | --- | --- | --- | --- |
| Account email | Sign-in, invitations, recovery | Medium (PII) | Until account deletion | Self only (not shown to other members by default — FR-MEM-005) |
| Display name, avatar colour | Identify members in the household | Low | Until membership ends; activity retains the display name snapshot | All members |
| Session records | Authentication | High | Session lifetime + 30 days audit trail | Self |
| Household name, timezone, settings | Product function | Low | Household lifetime | All members |
| Rooms and names | Product function | Low–Medium (reveals home layout) | Household lifetime | All members |
| Chore definitions/occurrences/completions | Product function (the core) | Medium (reveals routines) | Definitions: lifetime; occurrences/completions: 24 months, then pruned to aggregates-free deletion | All members |
| Trash containers, states, collections | Product function | Medium (reveals presence patterns near collection days) | 24 months | All members |
| Resources and levels | Product function | Low–Medium (reveals consumption) | Levels current; change history 24 months | All members |
| Assets, maintenance plans/records | Product function | Medium (reveals home contents) | Lifetime (this is the point of the record) | All members |
| Issues + comments | Product function | Medium–High (reveals home problems) | Open: indefinite; closed: archived after 12 months, retained while the household exists | All members |
| Photos/attachments | Optional evidence | High | With parent record + 30-day soft-delete grace | All members (household-scoped) |
| Alerts + transitions | Product function | Medium | 180 days after terminal state | All members |
| Notification intents/attempts, push subscriptions | Delivery | Medium (device endpoints) | Intents/attempts 90 days; subscriptions until invalidated or member removal | Self (subscription list only) |
| Activity events | History/accountability | Medium | 12 months default (configurable) | All members |
| Audit log (auth, roles, invites, exports) | Security | Medium–High | 12 months | Operator only (not in product UI) |
| Rate-limit buckets | Abuse protection | Low (hashed keys) | Window + 7 days | No |
| Backups | Recovery | High (everything) | 30 days rolling | Operator |

Not stored — ever: geolocation, IP addresses in product data (truncated in audit only), device fingerprints, contact lists, photos' EXIF, browsing history, third-party identifiers, advertising ids.

## 3. Retention schedule (enforced by the prune job)

| Table | Window | Notes |
| --- | --- | --- |
| `activity_event` | 12 months (`retain_until` column, default) | Household may configure 3–24 months in settings |
| `alert` + `alert_transition` | 180 days after `RESOLVED`/`EXPIRED` | Open alerts are never pruned |
| `notification_intent` / `notification_attempt` | 90 days | Counts retained in metrics only |
| `chore_completion` | 24 months | Households often want longer history; configurable at the *household* level, documented trade-off |
| `trash_state_event` / `trash_collection` | 24 months | |
| `resource_level_change` | 24 months | |
| `issue_comment` / `issue_transition` | With the issue (archived after 12 months closed) | |
| `rate_limit_bucket` | Window + 7 days | |
| `audit_log` | 12 months | Operator-only record |
| `attachment` | With parent + 30-day soft-delete grace | Files purged from storage after grace |
| Backups | 30 days rolling | Restore drills use a scratch database, not production |

Rules: pruning is **deferred and batched** (never a long lock), **logged as counts only**, and **idempotent**. A household setting may *shorten* windows, never extend them beyond the documented maxima without a DECISIONS.md entry.

## 4. Household isolation as a privacy control

| Aspect | Rule |
| --- | --- |
| Data scoping | Every household-scoped table carries `household_id`; ports require context (ADR-005). |
| No cross-household features | No benchmarks, no "other households also do X", no shareable public pages, no public profiles. |
| Invitations | Tokens are single-use, hashed at rest, expiring, revocable; joining reveals only the household name. |
| Member exit | Leaving/removal revokes sessions and subscriptions; historical records keep the display-name snapshot for accountability but the account link is removed from UI presentation. |
| Operator access | The operator (whoever runs the server) technically has database access. This is disclosed in-house; the product provides no admin UI to browse member content, so operator access requires deliberate database work. |

## 5. Logging restrictions (normative)

Allowed in logs: opaque ids (`householdId`, `actorId`, entity ids), event names, outcome codes, durations, counts, correlation/trace ids, error class names, job names, channel names, HTTP method + route template, HTTP status.

Forbidden in logs, metrics, traces, and error messages: member names, emails, room names, chore titles, issue titles/descriptions/comments, note fields, photo filenames or storage keys, invite tokens, session tokens, push endpoints or keys, household names, free-text of any kind.

Enforcement: the logger's typed allow-list (ADR-015) makes violations a type error; PR review checklist references this section; a redaction test is planned in VS-15.

## 6. Photos and attachments

| Aspect | Rule |
| --- | --- |
| Optional always | No flow requires a photo (PRD A-3) |
| Access | Served only through an authenticated household-scoped route; never public, never guessable, never listed |
| Metadata | EXIF stripped on ingest, including GPS and device identifiers |
| Payloads | Never included in push or email payloads |
| Display | Shown in-app only; no external image hosts |
| Deletion | Deleting the parent record soft-deletes the attachment; the purge job removes storage objects after a 30-day grace period |
| Storage decision | Filesystem volume vs object storage: proposed ADR-017; whichever is chosen, encryption at rest is the host's responsibility and is documented in DEPLOYMENT.md |

## 7. Member-facing rights & procedures

| Right | How it is honoured |
| --- | --- |
| **Access / export** | `exportHouseholdData` produces a JSON export (owner-only, 1/day, re-auth) covering household records, members, and history; attachments are listed with separate download links. |
| **Correction** | Members can edit or correct their own profile; completion corrections are recorded (reopen) rather than silently altered. |
| **Deletion of an account** | A member leaving can request account deletion; the household retains only the display-name snapshot needed for history integrity, and the account link is severed. |
| **Household deletion** | `requestHouseholdDeletion` opens an operator workflow: verify owner identity, take a final backup, delete household rows in a documented order, confirm in writing. No self-service destructive button. |
| **Withdrawal from a feature** | Any member can turn off notifications entirely (in-app truth remains) without losing access to the household. |

## 8. Notification privacy

| Setting | Default | Effect |
| --- | --- | --- |
| Payload verbosity | **Minimal** | Push shows "HomeOps: something needs attention" + deep link |
| Verbose payload (opt-in per household) | Off | Includes alert type and entity name *without* free text |
| Quiet hours | 22:00–07:00 household-local | Suppresses non-`URGENT` delivery |
| Daily cap | 5 per member | Overflow becomes one digest |
| Email channel | Off | Must be explicitly enabled |

Lock-screen exposure is treated as a privacy surface: the default assumes someone else may see the phone.

## 9. What HomeOps refuses to build

Presence/location tracking · "who is home" indicators · activity feeds of app usage · per-person productivity stats · streaks/points · read receipts · geofencing or arrival detection · cameras or sensor integrations · contact-book import · advertising or sponsored content · sharing household data with third parties · public share links to household content.

Any proposal in these areas is out of scope by PRD §4.2 and would require an explicit product decision, a new ADR, and a privacy review.

## 10. Privacy review checklist (per task)

- [ ] Does this collect a new field? If yes: is it required by a named requirement, and is it in §2?
- [ ] Is the new data household-scoped and covered by a retention rule?
- [ ] Could this record appear in a log, metric, trace, or notification payload?
- [ ] Does this introduce a third-party service (new boundary)? If yes, stop — that needs an ADR and a decision entry.
- [ ] Does this make any member's behaviour more visible to others than before? If yes, justify it in the task notes (and consider whether it is a surveillance feature by another name).
- [ ] Is the data deletable, and is deletion implemented for the new shape?
