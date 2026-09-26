# ADR-0015 — Outbox-driven notifications with channel adapters

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, SRE, Privacy
- Requirements affected: FR-NOTIF-004/006/007/010 · Related: ADR-0010, `NOTIFICATIONS.md`, ADR-0007 (dedupe patterns)

## Context

Notifications are triggered by domain facts across many modules: `ParticipantRegistered`
(confirmation), `RegistrationCancelled`, `KajianCancelled`, `KajianRescheduled`,
`EventReminderDue` (cron), `RecordingPublished`, `TranscriptPublished`, `FeedbackRequestDue`.

Two failure modes matter:

1. **Lost notification:** the database commit succeeded but the send failed or was never
   scheduled (process crash between commit and send).
2. **Duplicate notification:** a retry after a partial failure sends twice — annoying for a
   confirmation, embarrassing for a "kajian dimulai sebentar lagi".

Notification delivery must also be **channel-agnostic**, because WhatsApp/SMS may be desired
later, and it must be able to **never block** a user-facing transaction (sending email inside a
registration request is a latency and availability hazard).

## Decision

Use the **transactional outbox** pattern:

1. Domain modules write a `notification_intent` row (and a generic `domain_events` row) **inside
   the same transaction** as the state change that caused it.
2. A worker consumer (`notifications.dispatch`) claims intents via pg-boss (ADR-0010), resolves
   the recipient's channel preference, renders from a message template, and calls a
   `NotificationChannel` adapter.
3. Each intent has a **dedupe key** — a stable string derived from
   `(eventType, aggregateId, recipientId, purpose)` — with a unique constraint, so the same
   intent cannot be dispatched twice.
4. Delivery attempts are tracked (`attempts`, `last_error`, `next_attempt_at`) with exponential
   backoff, and exhaustion moves the intent to a dead-letter state that is **visible to
   operators** and surfaced as an alert (`NOTIFICATION_FAILURE_RATE_HIGH`).
5. Channels in MVP: **in-app** (always written, no external dependency) and **email**. Web
   push, WhatsApp, SMS, Telegram are OPTIONAL adapters behind the same port; the product must
   work with none of them.
6. Content rules: templates contain **no secrets and no tokens** in a channel that is not
   access-controlled (`FR-NOTIF-010`). Deep links are signed, short-lived and single-purpose.
7. Recipient preferences are respected at dispatch time (opt-out for non-essential classes);
   operational messages (cancellation, venue change) cannot be opted out of
   (`FR-NOTIF-008`).

## Alternatives considered

- **Send inline in the request.** *Costs:* provider latency and outages break core flows;
  duplicates on client retry; no retry semantics. *Rejected outright.*
- **Fire-and-forget after commit (`void send()`).** *Costs:* lost notifications on crash,
  invisible failures, no audit. *Rejected.*
- **Directly enqueue a pg-boss job in the transaction (no intent table).** *Gains:* slightly
  less code. *Costs:* couples notification semantics to queue internals; makes "what should have
  been sent?" unanswerable during an incident; complicates dedupe across retries.
  *Rejected:* the intent table is the audit record as well as the queue input.
- **Third-party notification platform (e.g. a managed messaging service) in MVP.** *Costs:* a
  vendor in the critical path, per-message cost, and a data-processing relationship for contact
  details. *Deferred* to OPTIONAL adapters with the same port.
- **WhatsApp-first delivery.** *Costs:* a dependency on a channel the mosque does not control,
  template approval processes, and cost per conversation. *Rejected for MVP* despite genuine
  user preference in Indonesia — it is the first OPTIONAL adapter once the platform is stable,
  and the interface is designed for it.

## Consequences

**Positive:** no lost or duplicate notifications by construction; delivery is asynchronous and
cannot block registration or check-in; failures are visible and retryable; a new channel is one
adapter; the intent table answers "why did this person not get a reminder?" during an incident.

**Negative:** notification is eventually consistent (seconds to minutes) — acceptable for all
current purposes; the worker must exist for notifications to flow (documented in `RUNBOOK.md`);
template rendering becomes a small subsystem with its own tests.

**Neutral:** in-app notifications are written even when email fails, so a participant always has
an in-product record.

## Enforcement

- `UNIQUE(dedupe_key)` on `notification_intents`; a concurrency test dispatches the same intent
  twice and asserts one delivery.
- A test asserts no notification intent row is created when the enclosing transaction rolls
  back.
- A test asserts templates cannot render without a locale and that no template includes a token
  field.
- No module outside `notifications` may call an email/push provider client (lint rule).

## Revisit trigger

Reopen if: a deployment requires guaranteed sub-minute delivery (not expected); a channel
provider's rate limits require a dedicated queue per channel; or the intent table becomes a
performance issue (then archive dispatched intents aggressively via `RETENTION.md`).
