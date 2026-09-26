# Product Spec — Notifications

> Requirements: FR-NOTIF-001..012, FR-ALERT-012..013 · ADR: ADR-009 (delivery model), ADR-014 (PWA/push) · Design: docs/design/PAGES.md §10, DESIGN.md §12 · Tasks: T-NOTIF-001..012, T-PWA-006

## Purpose

Deliver the *right* alert to the *right* person on the *right* channel — and nothing else. Alerts live in the app; notifications are how the app reaches a person who isn't looking at it.

## Separation of concerns (ADR-009)

```text
domain conditions ──▶ Alert (created by the engine, always visible in-app)
                          │
                          ▼
                   pure policy: decideNotifications(alert, recipients, prefs, clock)
                          │  ──▶ intents (ids only) into the outbox, same transaction
                          ▼
                   drain job ──▶ channel adapters (push / email)
                          ▼
                   attempts (outcome recorded, payload never stored)
```

The domain never knows about channels; the policy never performs I/O; the adapters never decide *whether* to send.

## Channels

| Channel | v1 scope | Notes |
| --- | --- | --- |
| In-app | always on, never suppressed | The dashboard and `/alerts` are the truth |
| Web Push | assigned work, URGENT anything, escalations | Requires an installed PWA on iOS; permission asked in settings only |
| Email | invitations and password recovery only | Optional dependency (ADR-019); absent → shareable links (PRD A-4) |
| Chat apps / SMS / WhatsApp | not in v1 | Explicitly rejected: no third-party household data flows (PRD NG-6) |

## Recipients

Resolved by the alert engine (see ALERTS.md §Recipients): assigned member → role target → OWNER fallback; away members skipped except URGENT; removed members never. Notifications never broadcast. If no valid recipient exists, the alert is still created and shown, and the delivery is recorded as suppressed with reason `NO_RECIPIENT` (visible to operators as a configuration smell).

## Preferences model

| Setting | Scope | Default |
| --- | --- | --- |
| Per-type × channel matrix | personal | in-app on; push on for assigned/URGENT; email off |
| Quiet hours | household default + personal override | 22:00–07:00 |
| Daily cap (delivered intents) | personal, bounded by the household ceiling | 5 |
| Digest | automatic when the cap is hit | 1/day, next allowed window |
| Device list + permission state | personal, per device | — |
| Test notification | personal | limited to 3/day |

Copy in settings is behaviour-first ("Push me when: a chore I own is due"), never implementation-first ("subscribe to topic chore.due").

## Delivered intents, suppression reasons, caps

Every potential delivery lands in exactly one bucket, and the reason is recorded:

| Outcome | Reason codes |
| --- | --- |
| Delivered | — |
| Suppressed | `QUIET_HOURS` · `CAP_REACHED` · `AWAY` · `CHANNEL_DISABLED` · `DUPLICATE` · `NO_RECIPIENT` · `STALE` (alert resolved before delivery) |
| Failed | `TRANSIENT` (retried with backoff) · `PERMANENT` (subscription pruned or dead-lettered) |

Caps count **delivered** intents, not alerts — so a quiet week is never "used up" by suppressed items. URGENT deliveries are always delivered and still counted (the cap informs, it does not silence urgent work). Overflow becomes a single digest listing counts per type with deep links.

## Quiet hours

Household-local windows (crossing midnight supported). During quiet hours: alert **creation** is unaffected, in-app is unaffected, deliveries are queued to the next allowed moment, and the queued item is dropped if the condition resolved meanwhile (`STALE`). SAFETY issues and URGENT alerts bypass quiet hours — that bypass is a product decision, not a user one (ALERTS.md §Severity).

## Push specifics

- Subscription stored per device, endpoint hashed; replaced on re-subscribe; `404/410` responses prune silently; repeated transient failures prune after a threshold.
- Payload is **minimal by default** (PRIVACY.md §8): "HomeOps · something needs attention" plus a deep link that opens the app. Verbose mode (opt-in, per member) may include the alert type and entity name ("Kitchen bin is full").
- Payloads never contain notes, comments, photos, member names, or household names. A lock screen is a public surface.
- Tagging collapses repeats: a refreshed alert replaces its own notification instead of stacking.
- Install guidance is contextual (after the second session) and never on first load (PATTERN §13 / docs/design/PAGES.md §12).

## Email specifics (v1)

Two transactional templates only: invitation and password reset. No digest emails, no marketing, no alert emails in v1 (revisit only if push proves insufficient). Links are single-use with expiries (invite 7 days, reset 30 minutes). If no provider is configured, the UI offers a shareable invitation link instead of failing.

## "Why didn't I get this?"

A member can open any alert and see: recipient + reason, channel decisions, whether it was delivered, suppressed (with reason), or failed, and when it will be retried. This transparency is intentional and cheap — the data already exists in the attempts table (ids only).

## Edge cases

1. **Member has no devices:** in-app only; the settings page says so plainly rather than pretending push is active.
2. **Device clock/timezone differs from the household:** delivery windows use the household timezone plus the member's quiet-hour override — never the device clock.
3. **Cap reached on a busy day with one URGENT:** the URGENT is delivered; the digest covers the rest.
4. **Alert resolved between queueing and delivery:** intent marked `STALE`, nothing sent, no notification about nothing.
5. **Permission revoked in the browser:** next drain records a permanent failure, the subscription is pruned, and settings show "notifications are blocked — here's how to fix it".
6. **Two devices, same member:** both receive; the app collapses duplicate presentation by alert id.
7. **A household with push fully disabled:** purely in-app. This is a legitimate configuration and must not generate repeated "enable notifications" prompts (max one gentle offer, dismissible, remembered).

## Deliberately absent

Notification categories that re-notify every N minutes, "urgent" marketing templates, read receipts shown to other members, per-member delivery statistics (only aggregate ratios are measured — OBSERVABILITY.md), SMS/WhatsApp integrations, and any payload containing user-written text.
