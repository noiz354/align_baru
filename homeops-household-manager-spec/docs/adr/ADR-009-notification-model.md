# ADR-009: Notification Model — Alerts and Delivery Separated by Policy

## Status
Accepted

## Date
2026-09-26

## Context
An alert is a statement about the household's world; a notification is an interruption on someone's phone. Conflating them is the standard route to alert fatigue (DP-4): the domain starts "sending", recipient selection becomes implicit ("everyone"), and retries / channel failures leak into business transactions. HomeOps needs multiple channels over time (in-app, PWA push, email; later WhatsApp/Telegram/SMS), per-member preferences, quiet hours, escalation, and daily caps — while keeping alert truth (ADR-008) independent of transport. Delivery failures must never roll back domain changes (FR-NOTIF-008), and push subscriptions die routinely (410/404) requiring cleanup (FR-NOTIF-007).

## Problem
Where does the decision "should this member be interrupted on this channel right now?" live, and how is it made idempotently, observably, and without coupling domain transactions to third-party delivery?

## Decision Drivers
- FR-NOTIF-001/002: alert ≠ delivery; flow is event → alert → policy → delivery.
- FR-NOTIF-010: explicit recipient selection, never broadcast.
- FR-NOTIF-004/005: per-member type × channel matrix and quiet hours.
- FR-ALERT-013: daily caps with summarised overflow.
- FR-NOTIF-006/007/008: delivery records, subscription hygiene, no rollback on failure.
- Operationally simple: one process, no broker in v1 (ADR-013).
- Privacy: push payloads may appear on lock screens (NFR-PRIV-008).

## Options Considered
1. **Policy layer + delivery adapters + delivery-attempt records**, executed asynchronously after the domain transaction (outbox-driven).
2. **Send directly from domain/feature code** — smallest code; couples transactions to network I/O, makes dedupe/quiet hours per-call, and guarantees eventual inconsistency when a send fails mid-transaction.
3. **Third-party notification service (OneSignal/Courier/Firebase)** — fastest multi-channel; adds a vendor holding household data and a subscription-management dependency; conflicts with PRIVACY.md.
4. **Per-alert fan-out rows created at alert creation** — simple delivery queue but multiplies data and hard-codes policy at creation time, so preference changes cannot be retroactive.
5. **Client-side only (in-app badge, no push)** — zero infrastructure, but fails FR-PWA-003 and the "remind me while I'm out" use case that makes the product work.

## Decision
Adopt **(1)**: a three-part separation.

```text
domain event / tick
      ↓  (records state; never sends)
    Alert  (domain/alerts — durable, deduplicated, priority)
      ↓  (alert lifecycle transitions emit notification intents)
NotificationPolicy (features/notifications/policy)
      ├── recipient resolution: assigned member → role (owner/admin) → fallback rules
      ├── channel matrix lookup: alert type × priority × member preference
      ├── quiet hours evaluation (household + member), urgency override for URGENT
      ├── daily cap + grouping/summarisation
      └── produces 0..n NotificationIntent(s) (never sends)
      ↓
Delivery (server/notifications/*)
      ├── in-app: no-op at delivery time (the alert list *is* the in-app channel)
      ├── pwa-push: Web Push via VAPID, per-device subscription
      └── email: optional, invitation/recovery and digests first
      ↓
NotificationAttempt record (channel, outcome, error class, timestamps, dedupe key)
```

Rules:
- **Intents are idempotent** by `(alertId, memberId, channel, windowKey)`: re-evaluating the same alert in the same window never produces a second delivery.
- **Policy is pure**: `decideNotifications(alert, member, prefs, now) → NotificationIntent[]`, unit-testable with no I/O.
- **Recipient resolution order** (FR-NOTIF-010): (1) the assigned member if set and not away; (2) the role named by the alert type (e.g. `OWNER`/`ADMIN` for household-level alerts); (3) the definition's default owner; never "all members". Away members (FR-MEM-009) are skipped unless the alert is `URGENT`.
- **Quiet hours** suppress non-`URGENT` intents and re-queue them to the next allowed window (in-app remains current). `URGENT` bypasses quiet hours but is still capped and deduped.
- **Caps**: per member per day, delivered notifications are capped (default 5, configurable); overflow is summarised into one digest intent.
- **Delivery never blocks or rolls back domain state** (FR-NOTIF-008): attempts run after the transaction commits (outbox, ADR-013), with bounded retries and exponential backoff.
- **Subscription hygiene**: a `404/410` from the push service deletes the subscription row silently; `401/403` (VAPID misconfiguration) raises an operator-visible failure metric rather than retrying forever.
- **Payload minimisation** (NFR-PRIV-008): push payloads carry a short, non-sensitive summary plus a deep link; a household setting can reduce them to "HomeOps: something needs attention". Photos and free-text issue descriptions are **never** in payloads.
- **Email is optional in v1** (assumption A-4). The invitation and password-recovery flows must degrade gracefully when no mail provider is configured (documented in RUNBOOK.md).
- Channels are registered through a `NotificationChannel` port; adding WhatsApp/Telegram later adds an adapter, not a policy change.

## Consequences

### Positive
- Domain transactions stay fast and safe; a push outage cannot break "mark chore done".
- Recipient selection is explicit and testable — the structural answer to "don't notify everyone".
- Preference changes are effective immediately without touching alert rows.
- Delivery attempts give operators a diagnostic trail (NFR-OBS-003, RUNBOOK.md#push-failures).
- Adding a channel is additive; no changes in `domain/**`.

### Negative
- More moving parts than "send from the feature" — a policy layer, an outbox, and attempt records.
- Notification timing depends on the scheduler/outbox drain (delays of seconds to minutes if the process is idle/restarting).
- Summarised digests may be less immediately actionable than individual messages (accepted: fatigue reduction wins).
- Preference matrices risk being confusing; defaults must be excellent and the UI must show plain-language outcomes ("Push me for chores due today").
- Multi-device per member adds rows and cleanup paths.

## Risks
| Risk | Impact |
| --- | --- |
| Outbox not drained (no tick, crash) | Silent non-delivery |
| Duplicate intents from retries | Double notifications |
| Over-aggressive grouping | Missed urgency |
| Quiet hours + caps muting everything | Member misses an important item |
| Push payload leaking sensitive detail on a lock screen | Privacy breach |
| Subscription table grows with dead devices | Delivery noise and wasted sends |

## Mitigations
- Outbox drain is part of the scheduler tick and exposes metrics (`notifications_pending`, `notifications_failed`); a stalled drain is an operator alert (OPERATIONS.md#signals).
- Idempotent intent keys plus `NotificationAttempt` unique constraints make retries safe (tests planned in tests/integration/notifications-policy.test.ts).
- `URGENT` items bypass grouping and quiet hours by design; the digest always states counts by type so nothing is invisible.
- Cap overflow produces a digest rather than silence; members can raise the cap in settings.
- Payload rule is enforced by a single `buildPushPayload()` function with a redaction allow-list and unit tests.
- Subscription cleanup on 410/404 plus a periodic "prune subscriptions with N consecutive failures" job (T-NOTIF-007).

## Revisit Conditions
- Delivery latency or durability requirements exceed what the in-process outbox provides → adopt pg-boss (ADR-018 proposed).
- A second notification consumer appears (e.g. smart-home integration) requiring a real queue.
- Members report that digests hide things they needed immediately.

## References
- PRD.md — FR-NOTIF-001..010, FR-ALERT-011..013, NFR-PRIV-008
- docs/product/NOTIFICATIONS.md, docs/product/ALERTS.md
- SECURITY.md — §notification abuse, §secrets
- THREAT_MODEL.md — T-10 notification abuse
- src/server/notifications/*, src/features/notifications/* (skeletons)
- ADR-008 (alerts), ADR-013 (scheduling), ADR-014 (PWA push)
- TASKS.md — T-NOTIF-001..012
