# NOTIFICATIONS

Timely, minimal, respectful messages that help people attend and follow up — and nothing else.

Requirements: FR-NOTIF-001…010 · ADRs: 0015 (outbox), 0018 (time) · Privacy: `PRIVACY.md` §Contact use

---

## 1. Principles

1. **Few.** Every notification must be actionable or reassuring. If it is neither, it is not sent.
2. **One purpose per message.** No marketing, no "you might also like", no engagement nudges
   (`NFR-ETH-004`).
3. **No secrets in the open.** Tokens and codes travel only through access-controlled channels
   (`FR-NOTIF-010`).
4. **Quiet by default.** In-app notifications are a dot, not a modal; the app never interrupts a
   participant to promote anything.
5. **Opt-out is real** for non-essential classes; operational messages (cancellation, venue change,
   accessibility confirmation) cannot be disabled because they are part of the service the
   participant signed up for.
6. **Truthful time.** Reminders for prayer-relative events say "sekitar 05.15" when the time is an
   estimate (ADR-0018).

## 2. Catalogue

| Key | Trigger event | Audience | Channel (MVP) | Dedupe key | Class |
|---|---|---|---|---|---|
| `registration.confirmed` | `ParticipantRegistered` | registrant | in-app + email | `registration.confirmed:{registrationId}` | essential |
| `registration.waitlisted` | `ParticipantWaitlisted` | registrant | in-app + email | `registration.waitlisted:{registrationId}` | essential |
| `waitlist.offer` | `WaitlistOfferIssued` | registrant | in-app + email | `waitlist.offer:{offerId}` | essential (with deadline) |
| `event.reminder` | cron (configurable: 24 h and/or 2 h before) | registrants | in-app + email | `event.reminder:{eventId}:{leadMinutes}` | optional |
| `event.starting_soon` | cron (30 min before) | registrants **and** volunteers on duty | in-app (+ push where available) | `event.starting_soon:{eventId}` | optional |
| `event.cancelled` | `KajianCancelled` | registrants + waitlisted | in-app + email | `event.cancelled:{eventId}` | essential |
| `event.rescheduled` | `KajianRescheduled` | registrants + waitlisted | in-app + email | `event.rescheduled:{eventId}:{scheduleChangeId}` | essential |
| `event.location_changed` | event venue change | registrants | in-app + email | `event.location:{eventId}:{changeId}` | essential |
| `audio.available` | `AudioPublished` | attendees (checked-in) + registrants | in-app + email | `audio.available:{eventId}` | optional |
| `transcript.available` | `TranscriptPublished` | attendees + registrants | in-app + email | `transcript.available:{eventId}` | optional |
| `feedback.request` | scheduled after `KajianCompleted` (next morning) | attendees (+ registrants, marked separately) | in-app + email | `feedback.request:{eventId}:{recipientRef}` | optional, **max once** |
| `checkin.window_open` | `CheckInWindowOpened` | volunteers on duty | in-app | `checkin.window:{eventId}:{entranceId}` | essential |
| `review.assigned` | `TranscriptDrafted` (policy requires review) | reviewers | in-app + email | `review.assigned:{transcriptId}:{userId}` | essential |
| `review.overdue` | cron (age > threshold) | organizer + reviewer | in-app + email | `review.overdue:{transcriptId}:{dayBucket}` | essential |
| `ops.audio_upload_failed` | `AudioUploadFailed` | organizer + audio operator | in-app + email | `ops.upload_failed:{sessionId}` | essential (operational) |
| `ops.audio_health` | `RecordingHealthDegraded` | audio operator (immediate) | in-app (+ push) | `ops.health:{sessionId}:{reason}` | essential (immediate) |
| `ops.transcription_failed` | `TranscriptionFailed` | organizer | in-app + email | `ops.transcription_failed:{jobId}` | essential |
| `ops.capacity_near` | `CapacityReached`/threshold | organizer | in-app | `ops.capacity:{eventId}:{bucket}` | operational |
| `ops.checkin_failure_rate` | metric threshold | organizer + admin | in-app + email | `ops.checkin_failure:{eventId}:{hourBucket}` | operational |
| `member.invited` | `MemberInvited` | invitee | email | `member.invited:{invitationId}` | essential |
| `speaker.verification_decided` | `SpeakerVerificationChanged` | speaker | email | `speaker.verification:{speakerId}:{status}` | essential |
| `moderation.decided` | `ModerationDecisionRecorded` | content owner | in-app + email | `moderation.decided:{decisionId}` | essential |

Rules: the table above is the **complete** catalogue for MVP. Adding a notification requires a
product decision (a line in this table, a dedupe key, a class, and a task in `TASKS.md`) — the
mechanism does not invite ad-hoc messages.

## 3. Channels

| Channel | MVP | Notes |
|---|---|---|
| **In-app** | Yes (default, always written) | The product's own record of what it told the user; visible in `/notifikasi`; no external dependency, so the system is useful even if email fails |
| **Email** | Yes | Requires a configured provider (transactional). Templates in Bahasa Indonesia and English. Plain-text alternative required |
| **Web push** | OPTIONAL (P1) | Limited on iOS; used only for time-critical operational messages (recording health, event starting) |
| **WhatsApp / SMS / Telegram** | OPTIONAL (post-MVP) | Highest user preference in Indonesia, but adds a vendor, costs per message, template approvals, and a data-processing relationship. The adapter port exists (`NotificationChannel`); no MVP dependency (`docs/research/STACK-2026.md` §18) |

The system must be fully functional with **no external channel configured**: in-app only.

## 4. Delivery architecture (ADR-0015)

```
domain transaction
   └─ writes notification_intent (dedupe_key unique) ← same transaction as the state change
        └─ pg-boss job: notifications.dispatch
             ├─ resolve recipient (registration capability / user / mosque contact)
             ├─ apply preferences + class rules
             ├─ render template (locale, plain-language, no secrets)
             ├─ call NotificationChannel adapter (email/in-app/push)
             └─ record attempt outcome; retry with backoff; dead-letter after max attempts
```

Guarantees:

- **No lost notifications:** the intent is committed with the domain change; a crash before dispatch
  leaves a `PENDING` intent that the worker picks up.
- **No duplicates:** `UNIQUE (dedupe_key)`; a retry either dispatches the same intent once or is
  rejected at insert time.
- **No blocking:** dispatch never runs inside a request transaction (registration and check-in
  latency must not depend on an email provider).
- **Visible failures:** dead-lettered intents appear in `/operasional` and raise
  `NOTIFICATION_FAILURE_RATE_HIGH`.
- **Cancellable:** when an event is cancelled, pending reminders for it are cancelled (not sent
  late), and the cancellation message is dispatched first.

## 5. Timing rules

| Message | Timing |
|---|---|
| Confirmation | immediately after registration |
| Reminder | configurable lead times (default: 24 h before; optional 2 h before) — for prayer-relative events, relative to the resolved estimate when available |
| Starting soon | 30 min before (only for those who have not checked in; checked-in people are excluded — a notification that states the obvious is noise) |
| Feedback request | next morning 08.00 local **or** 2 h after the event ends, whichever is later; never during the night |
| Audio/transcript available | when published, but suppressed if the same person already received ≥ 2 messages for this event in the last 24 h (no pile-up) |

Quiet hours (default 21.00–06.00 local): nothing optional is sent. Essential operational messages
(cancellation of a Subuh kajian) are exempt because they are time-critical.

## 6. Content rules (templates)

Every message contains: what happened or will happen, the essential facts (mosque, venue, time in
venue timezone), and a single action link. No promotional language, no exclamation marks, no emoji
in operational messages, no urgency theatre.

| Do | Don't |
|---|---|
| "Kajian ba'da Subuh dibatalkan. Alasan: pemateri berhalangan. Kajian berikutnya: Minggu, 18 Oktober." | "❗KAJIAN DIBATALKAN❗ jangan sampai ketinggalan update terbaru kami!" |
| "Rekaman kajian sudah tersedia: <link>" | "Rekaman baru! Yuk dengerin dan bagikan ke teman-teman!" |
| "Silakan beri umpan balik tentang penyelenggaraan (anonim, 1 menit): <link>" | "Bantu kami jadi lebih baik dengan rating Anda!" |

Token handling in templates: a link to `/pendaftaran/<capability>` may appear in **email/in-app**
(access-controlled, single-recipient, signed). For WhatsApp/SMS (if ever enabled), the message
contains a short redemption code instead, which the participant exchanges on the site.

## 7. Preferences

- Stored per subject (user account or contact hash) with classes: `essential` (cannot be disabled),
  `reminders`, `content_updates`, `feedback_requests`, `operations`.
- Defaults: all optional classes **on** except `content_updates` (default off — people who want the
  archive will visit it; unsolicited "new recording" messages become noise).
- Unsubscribe link in every email (one click, no login required, using the signed contact token).
- Preference changes take effect at dispatch time; queued but not-yet-dispatched messages are
  re-evaluated.

## 8. Failure handling

| Failure | Behaviour |
|---|---|
| Email provider unavailable | Retry with backoff; dead-letter after max attempts; alert; the in-app notification still exists |
| Invalid/bounced address | Mark the contact as `undeliverable` after N hard bounces (no global block), surface it to the organizer as "hubungi peserta lain cara"; never silently drop future essential messages without telling the organizer |
| Provider rate limit | Respect it; queue; never drop essential messages |
| Duplicate dispatch attempt | Blocked by `dedupe_key` |
| Recipient deleted their data | Pending intents for that subject are cancelled (retention interplay) |
| Event cancelled while reminders are queued | Reminders are cancelled; the cancellation message supersedes them |

## 9. What we do not do

1. No marketing messages, ever — the platform does not have a marketing channel.
2. No re-engagement campaigns ("we haven't seen you in a while").
3. No messages about other mosques' events to a participant who attended elsewhere.
4. No notification of a person's attendance to anyone else (including organizers of other events).
5. No third-party messaging vendor in the critical path of MVP.
6. No badge counts that induce anxiety: a quiet dot, and a list.

## 10. Acceptance criteria

1. Exactly one reminder per configured lead time per event per recipient, even under worker retries
   (dedupe test).
2. No notification is sent with a token in plain text through a non-access-controlled channel
   (test asserts template rendering blocks token fields per channel).
3. A cancelled event produces a cancellation message and **no** subsequent reminder (integration
   test).
4. The in-app record always exists even when email fails (test).
5. Optional classes respect preferences, essentials cannot be disabled (test).
6. Quiet hours are respected for optional messages (time-injected test).
