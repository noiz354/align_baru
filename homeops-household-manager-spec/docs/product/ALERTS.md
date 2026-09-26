# Product Spec — Alerts

> Requirements: FR-ALERT-001..014 · ADR: ADR-008 (the alert rules) · Design: docs/design/PAGES.md §8, DESIGN.md §8 · Tasks: T-ALERT-001..035

## Purpose

An alert is HomeOps saying **"someone needs to act, here's why, here's who"** — exactly once, to the right person. The design goal is not more alerts; it is alerts people still believe after six months.

## The five questions every alert answers

1. **What happened?** — "Kitchen bin is full."
2. **Why does it matter?** — "Collection is tomorrow morning."
3. **Who should act?** — "Budi" (and why him: assigned).
4. **What can I do?** — "Mark collected" / "Snooze 1 h" / "Assign".
5. **When is action expected?** — "before 07:00 tomorrow".

If any of these is missing, the alert is malformed and creation fails validation (T-ALERT-024).

## Types and default priorities

| Type | Source | Default priority | Notes |
| --- | --- | --- | --- |
| `CHORE_DUE` | occurrence due today | ATTENTION | Often collapsed into the dashboard's Due today, no push |
| `CHORE_OVERDUE` | occurrence past due | IMPORTANT | Escalates once |
| `TRASH_FULL` | container FULL | ATTENTION (IMPORTANT on collection day) | |
| `TRASH_COLLECTION_DUE` | schedule window opens | IMPORTANT | |
| `RESOURCE_LOW` | grouped low items | ATTENTION | One row, many items |
| `RESOURCE_CRITICAL` | grouped critical/empty items | IMPORTANT | Critical items always named individually |
| `MAINTENANCE_DUE` | lead time reached | ATTENTION | |
| `MAINTENANCE_OVERDUE` | past the service date | IMPORTANT | |
| `ISSUE_REQUIRES_ATTENTION` | issue severity + delay | ATTENTION → URGENT | SAFETY = URGENT immediately |
| `HOUSEHOLD_REMINDER` | household note | INFO | Expires; quiet; never pushes by default |

Room status is **not** an alert type: it is a derived consequence of the work above (ADR-010), so there is only ever one reason to act.

## Lifecycle

```text
(desired state detected) ──▶ OPEN ──▶ ACKNOWLEDGED ──▶ RESOLVED
                              │           │
                              ├──▶ SNOOZED ──▶ (auto-reopen at snoozedUntil)
                              └──▶ EXPIRED  (INFO only, by age)
```

| Rule | Detail |
| --- | --- |
| Creation | The engine reconciles desired state with existing alerts; it creates only what is genuinely missing |
| Dedupe | One non-terminal alert per dedupe key (type + entity); repeated detection **refreshes** the existing row (priority, expectedBy, content) — never duplicates |
| Acknowledgement ≠ resolution | "I've seen it" stops escalation but the alert stays open and visible with the owner's name |
| Resolution | Automatic when the condition disappears (with a recorded reason) or manual with a reason; a still-true condition that is manually resolved may legitimately re-open later |
| Snooze | Bounded (default max 24 h, household-configurable); the alert leaves the attention strip but stays on `/alerts`; it re-opens automatically at expiry |
| Escalation | Only IMPORTANT/URGENT, only unacknowledged, at most once per cooldown (default 24 h); widens the recipient set and/or raises priority on the **same** alert |
| Expiry | INFO alerts expire after a household-configured age (default 14 days); valuable alerts never expire |
| Terminal states | `RESOLVED` and `EXPIRED`; acting on a terminal alert returns `ALERT_TERMINAL` |

## Dedupe keys

| Type | Key | Consequence |
| --- | --- | --- |
| `CHORE_DUE` / `CHORE_OVERDUE` | `chore:<occurrenceId>` | One alert per occurrence; completing it closes the alert |
| `TRASH_FULL` / `TRASH_COLLECTION_DUE` | `trash:<containerId>:full` / `:due` | One per container per condition (two bins = two alerts, deliberately) |
| `RESOURCE_LOW` / `RESOURCE_CRITICAL` | `resource:<householdId>:low` / `:critical` | Grouped: one row listing items |
| `MAINTENANCE_DUE` / `MAINTENANCE_OVERDUE` | `maintenance:<planId>` | Priority change, not a new alert |
| `ISSUE_REQUIRES_ATTENTION` | `issue:<issueId>` | Acknowledgement stops escalation |
| `HOUSEHOLD_REMINDER` | `reminder:<reminderId>` | One per note |

Keys are opaque ids, never titles or names (no PII in keys).

## Recipients (never broadcast)

Resolution order: **assigned member → role target (e.g. owners/admins for household-level) → OWNER fallback**. Away members are skipped unless the alert is URGENT. Removed members are never selected. The chosen recipient and the *reason* are stored, so "why did I get this?" has an answer.

A household reminder or an unassigned resource alert goes to owners/admins — not to everyone. If a household genuinely wants everyone notified, that is expressed as a personal subscription preference per member, not as a broadcast default.

## Fatigue controls (explicit, all of them)

| Control | Default | Where configured |
| --- | --- | --- |
| Dedupe (one alert per problem) | always on | ADR-008, not configurable |
| Grouping (low supplies in one row) | always on | not configurable |
| Critical visibility (never grouped away) | always on | not configurable |
| Quiet hours | 22:00–07:00 household-local | household + personal override |
| Daily cap (per member, delivered intents) | 5 | personal (household bounds it) |
| Overflow digest | 1/day | automatic |
| Snooze | 1 h / tonight / tomorrow / weekend | per alert |
| Escalation cooldown | 24 h, once | household |
| INFO expiry | 14 days | household |
| Per-type delivery toggle | sensible defaults (chore-due off by push) | personal |
| Channel matrix | in-app always; push for assigned work | personal |

**In-app alerts are never suppressed** — the dashboard and `/alerts` always show the full truth; quiet hours only affect the phone.

## Explain-why surface

Every alert has a detail view showing: the type, the triggering condition, when it was first detected, priority **and why**, the recipient **and why**, every state transition with actor, and the action that will resolve it. This is the single most effective anti-fatigue feature: people trust alerts they understand.

## Settings

Household (OWNER/ADMIN): escalation delay, snooze maximum, INFO expiry, quiet hours default, daily cap ceiling, per-type enablement **for delivery only**.
Personal: channel matrix, quiet hours override, snooze defaults, per-type delivery toggles.
Nothing can disable *creation* of an alert — only its delivery. (If the household doesn't want the underlying condition tracked at all, they should pause the chore or archive the resource; the product should not have a "pretend nothing is wrong" switch.)

## Edge cases

1. **Alert created while the recipient is away:** created normally, delivery suppressed with reason `AWAY`, visible in-app when they return.
2. **The condition disappears before the first delivery:** the alert resolves (reason recorded) and any queued intent is suppressed as stale.
3. **Someone resolves a still-true condition manually:** warning shown ("we still detect this — it may come back"); if detected again, a new alert opens under the same dedupe key.
4. **Two problems of the same type at once:** separate keys, separate alerts (never merged) — except grouped supplies, where merging is the point.
5. **A member is removed mid-alert:** the recipient is recomputed on the next evaluation; notifications never target a removed member.
6. **A very old unresolved alert:** it stays visible, and its age is shown; it is never auto-resolved to make the list look clean.
7. **50 low items:** one grouped alert with the 5 worst named plus a count; the list page shows them all.
8. **Timezone change:** expectedBy values are recomputed for future evaluations; history keeps the times they happened.

## Deliberately absent

Push for every event, "alert on everyone", repeated nagging every N minutes, badges that count INFO items, gamified urgency, AI summaries of alerts, and an alert inbox that can be muted wholesale (per-type delivery toggles are the honest version of that).
