# AUTHORIZATION MATRIX

The authoritative mapping of **roles → permissions → scope**. Implemented by
`src/server/auth/permissions.ts` (declarative, testable) and enforced by `requirePermission()`.

## 1. Roles

| Role key | Meaning | Typical holder | Scope |
|---|---|---|---|
| `PARTICIPANT` | Attends kajian; may have an account for convenience | Jamaah | own registrations only |
| `SPEAKER` | The person teaching | Ustadz/ustadzah | own profile, own events' content (review/approve own talk) |
| `MOSQUE_ADMIN` | Runs the mosque's records | Takmir/pengurus | assigned mosques only |
| `ORGANIZER` | Creates and runs kajian | Panitia | organization (optionally a mosque subset) |
| `VOLUNTEER` | Entrance operations | Relawan | one event/venue shift (device-bound) |
| `AUDIO_OPERATOR` | Records the session | Operator audio | recording for assigned events |
| `TRANSCRIPT_REVIEWER` | Reviews transcripts | Reviewer | assigned transcripts |
| `MODERATOR` | Content reports and takedowns | Platform trust role | platform-wide content, no participant data |
| `PLATFORM_ADMIN` | Operates the platform | Product operator | platform-wide, audited |

Role assignment rules: a member may hold multiple roles (`FR-ORG-002`); roles may be limited to a
subset of mosques (`FR-ORG-005`); `SPEAKER` is granted by claiming a profile, not by an organizer.
Deployments need not use every role; a one-mosque deployment may collapse several roles into one
account, but the **permission set stays separable** so that work can be delegated later.

## 2. Permission catalogue

Permissions are `<resource>.<action>` strings. Scope is `ORG` (organization), `MOSQUE` (mosque
subset), `EVENT` (a specific event), `OWN` (the actor's own record), or `PLATFORM`.

| Permission | Scope | Notes |
|---|---|---|
| `mosque.create` / `mosque.write` | ORG / MOSQUE | |
| `venue.write` | MOSQUE | capacity, entrances, access notes |
| `speaker.create` | ORG | no ownership of the person |
| `speaker.write` | ORG / OWN | `OWN` when the speaker claimed the profile |
| `speaker.claim` | OWN | initiates verification |
| `speaker.verify` | PLATFORM | sets verification status with evidence |
| `speaker.suspend` | PLATFORM | moderation action |
| `program.write` | ORG | recurrence and defaults |
| `program.generate` | ORG | generate events from a program |
| `event.create` / `event.write` | ORG / MOSQUE | |
| `event.publish` / `event.cancel` | ORG / MOSQUE | |
| `registration.read` | EVENT | list/search registrations |
| `registration.manage` | EVENT | promote from waitlist, correct registration contact |
| `registration.cancel.own` | OWN | participant capability |
| `checkin.context` | EVENT | read context/counts |
| `checkin.validate` | EVENT + device binding | the hot path |
| `checkin.manual` | EVENT | name lookup, short code |
| `checkin.walk_in` | EVENT | create walk-in |
| `checkin.window.write` | EVENT | open/close the check-in window |
| `attendance.read` | EVENT | summary |
| `attendance.correct` | EVENT | corrections with reason |
| `attendance.export` | EVENT | CSV export (field selection, reason) |
| `recording.operate` | EVENT | start/stop/pause a session |
| `audio.read` | EVENT / PUBLIC | `PUBLIC` only when published and policy allows |
| `audio.download` | EVENT / PUBLIC | per policy |
| `audio.process` | EVENT | trigger processing |
| `audio.publish` | EVENT | publish recording |
| `transcription.request` | EVENT | policy-gated |
| `transcript.read` | EVENT / PUBLIC | drafts: EVENT only |
| `transcript.review` | EVENT | edit/draft revisions |
| `transcript.approve` | EVENT | **separate from review** — a named approval act |
| `content.publish` | EVENT | publish audio/transcript bundle |
| `content.unpublish` | EVENT / PLATFORM | owner or moderator, reason required |
| `content.manage.chapters` / `content.manage.materials` | EVENT | |
| `feedback.read` | EVENT | organizer view |
| `feedback.read.aggregate` | EVENT (speaker) | aggregate only, n ≥ 5 |
| `feedback.report` | EVENT / PLATFORM | report abuse |
| `feedback.export` | EVENT | audited, reason required |
| `member.grant` / `member.revoke` | ORG | cannot exceed the actor's own authority |
| `moderation.decide` | PLATFORM | unpublish/suspend/restore |
| `audit.read` | ORG / PLATFORM | scoped to own org for organizers |
| `ops.retention` / `ops.provider` | PLATFORM | retention runs, provider configuration |
| `event.read.public` / `mosque.read.public` / `speaker.read.public` / `content.read.public` | PUBLIC | unauthenticated read of published data |

## 3. Matrix

Legend: ✓ = allowed · ✓* = allowed with a reason recorded and audited · ✓ᵈ = allowed with device
binding · — = not allowed · ⬤ = allowed for their own record only.

| Permission | PARTICIPANT | SPEAKER | MOSQUE_ADMIN | ORGANIZER | VOLUNTEER | AUDIO_OP | REVIEWER | MODERATOR | ADMIN |
|---|---|---|---|---|---|---|---|---|---|
| `mosque.create/write` | — | — | ✓ (own mosques) | ✓ | — | — | — | — | ✓ |
| `venue.write` | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| `speaker.create` | — | ⬤ | ✓ | ✓ | — | — | — | — | ✓ |
| `speaker.write` | — | ⬤ | ✓ | ✓ | — | — | — | ✓* | ✓ |
| `speaker.claim` | — | ✓ | — | — | — | — | — | — | ✓ |
| `speaker.verify` | — | — | — | — | — | — | — | — | ✓* |
| `speaker.suspend` | — | — | — | — | — | — | — | ✓* | ✓* |
| `program.write/generate` | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| `event.create/write` | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| `event.publish/cancel` | — | — | ✓ | ✓ | — | — | — | ✓* | ✓ |
| `registration.read` | ⬤ | — | ✓ | ✓ | — | — | — | — | ✓* |
| `registration.manage` | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| `checkin.context` | — | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| `checkin.validate` | — | — | ✓ | ✓ | ✓ᵈ | — | — | — | ✓ |
| `checkin.manual` | — | — | ✓ | ✓ | ✓ | — | — | — | ✓ |
| `checkin.walk_in` | — | — | ✓ | ✓ | ✓ | — | — | — | ✓ |
| `checkin.window.write` | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| `attendance.read` | ⬤ | — | ✓ | ✓ | ✓ (counts only) | — | — | — | ✓* |
| `attendance.correct` | — | — | ✓ | ✓* | — | — | — | — | ✓* |
| `attendance.export` | — | — | ✓* | ✓* | — | — | — | — | ✓* |
| `recording.operate` | — | — | ✓ | ✓ | — | ✓ | — | — | ✓ |
| `audio.read` | ✓ (published) | ✓ (own events) | ✓ | ✓ | — | ✓ | ✓ (for review) | ✓ | ✓ |
| `audio.download` | per policy | ✓ (own) | ✓ | ✓ | — | ✓ | ✓ (review copy) | ✓ | ✓ |
| `audio.process` | — | — | ✓ | ✓ | — | ✓ | — | — | ✓ |
| `audio.publish` | — | ✓*(own talk) | ✓ | ✓ | — | — | — | ✓ | ✓ |
| `transcription.request` | — | ✓ (own) | ✓ | ✓ | — | — | — | — | ✓ |
| `transcript.read` | ✓ (published) | ✓ (own, draft) | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| `transcript.review` | — | ✓ (own) | ✓ | ✓ | — | — | ✓ | — | ✓ |
| `transcript.approve` | — | ✓*(own talk) | — | ✓* | — | — | ✓* | — | ✓ |
| `content.publish` | — | ✓*(own talk) | ✓ | ✓ | — | — | — | — | ✓ |
| `content.unpublish` | — | ⬤ | ✓ | ✓* | — | — | ✓* | ✓* | ✓* |
| `feedback.read` | — | — | ✓ | ✓ | — | — | — | — | ✓* |
| `feedback.read.aggregate` | — | ✓ (own events, n ≥ 5) | ✓ | ✓ | — | — | — | — | ✓ |
| `feedback.report` | ⬤ | ⬤ | ✓ | ✓ | — | — | — | ✓ | ✓ |
| `feedback.export` | — | — | ✓* | ✓* | — | — | — | — | ✓* |
| `member.grant/revoke` | — | — | ✓ (≤ own authority) | ✓ (≤ own authority) | — | — | — | — | ✓ |
| `moderation.decide` | — | — | — | — | — | — | — | ✓* | ✓* |
| `audit.read` | — | — | ✓ (org) | ✓ (org) | — | — | — | ✓ (content only) | ✓ |
| `ops.*` | — | — | — | — | — | — | — | — | ✓* |

## 4. Rules that the matrix cannot express (must be implemented as guards)

1. **Scope, not just role.** `ORGANIZER` of mosque A has no rights at mosque B, even in the same
   organization, when their membership is limited to A (`FR-ORG-005`).
2. **Ownership checks on `OWN` grants.** A speaker may review their own transcript only if
   `speaker_id` on the event equals their claimed profile.
3. **Device binding** for check-in: the permission is valid only for the bound event/venue, and
   re-binding is an audited action.
4. **Policy gating on top of permissions.** `content.publish` still fails if the event's
   `PUBLISH_*` policy is `NONE`/`INTERNAL` or if the transcript is not approved (ADR-0012).
5. **Reason-required actions** (`✓*`): attendance corrections, exports, moderation decisions,
   transcript approval overrides, unpublish, verification, role escalation. Reason ≥ 8 characters,
   stored in the audit event.
   *Implementation note (T-SEC-002, 2026-09-27):* where a cell in §3 shows a plain `✓` for a key that
   `REASON_REQUIRED_PERMISSIONS` in `src/shared/contracts/permissions.ts` lists (`event.cancel`,
   `transcript.publish`, `attendance.correct`, `audit.export`, `platform.config.manage`), the stricter
   rule wins — a reason is required for **every** role that holds the key, because the contract list and
   the matrix must not disagree in the permissive direction. The matrix is transcribed into
   `AUTHORIZATION_MATRIX` (53 rows) with a `doc` field naming its source row here; `speaker.claim` is
   folded into `speaker.write`.
6. **No self-escalation.** A member cannot grant themselves a role, cannot grant a role they do not
   hold, and cannot widen their own mosque scope.
7. **Platform-admin actions are audited and enumerated.** There is no "superuser bypass" flag;
   admin access to participant data requires a reason and is logged.

## 5. Verification

| Test | Assertion |
|---|---|
| Matrix table test | Every (role, permission) pair in `src/server/auth/permissions.ts` matches this document |
| Isolation suite | Cross-org access returns 404 on every scoped endpoint |
| Scope test | An organizer limited to mosque A cannot write to mosque B |
| Device-binding test | A check-in request from an unbound device is rejected |
| Escalation test | A member cannot grant a role beyond their authority |
| Reason test | Every `✓*` action without a reason is rejected |
| Public-surface test | Public endpoints expose only published content per policy |

**Status (2026-09-27, T-SEC-002).** The matrix is data in `src/server/auth/permissions.ts` and the single
choke point is `requirePermission`. `tests/integration/security/permissions.test.ts` walks all 53 × 9
cells, asserts the reason rule for every `✓*` key, refuses self-approval and self-escalation, and
statically proves that every route file under `src/app/api` either calls `requirePermission` or is listed
with a reason in `src/server/auth/public-routes.ts` (the "one auditable place" ADR-0017 layer 5 asks for).
Rules 1–3 and 6 are enforced inside `requirePermission`; rule 4 (policy gating) needs the event policy
model (`T-EVENT-005`) and rule 7's durable audit store is `T-SEC-007` — until then these events go through
the interim security-event sink.
