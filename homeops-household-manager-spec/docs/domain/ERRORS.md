# Domain Error Catalogue

> Domain errors are **expected outcomes**, not exceptions. They are returned as values through `OperationResult` (see docs/api/CONVENTIONS.md) unless noted as invariant-breach errors, which are thrown and mapped at the boundary.
> Naming: `SCREAMING_SNAKE` code, stable forever, one meaning each. Never reuse a code for a new condition — add a new one.

## Structure

```ts
type DomainError = { readonly code: ErrorCode; readonly message: string; readonly details?: Readonly<Record<string, string | number>> };
```

`message` is developer-facing English (logs, tests). The member sees copy chosen by the UI from `code` — never the raw message (DESIGN.md §10, copy rules T-1..T-7).

## Result-shaping conventions

| Check | Rule |
| --- | --- |
| Validation failure | Return `VALIDATION_FAILED` with `details.fields`; never throw |
| Not found **or not yours** | Always `NOT_FOUND` — never `FORBIDDEN`, never a hint that the row exists (SECURITY.md §3) |
| Permission | `FORBIDDEN` only when the resource is visible to the caller but the action is not allowed |
| Conflict | `CONFLICT` (state changed) or `ALREADY_EXISTS` (uniqueness) — both carry the conflicting field |
| Idempotent replay | The original success result, not an error (`clientRequestId` hit) |
| Invariant breach | Throw; the boundary logs it with a correlation id and returns a generic `INTERNAL` to the member |

## Household, membership, auth

| Code | Meaning | When | HTTP | Member-facing copy (summary) |
| --- | --- | --- | --- | --- |
| `HOUSEHOLD_NOT_FOUND` | No household in context | Session valid, no membership | 404 | Internal (redirects to onboarding) |
| `LAST_OWNER_CANNOT_LEAVE` | Would leave no owner | Remove/demote the last OWNER | 409 | "Someone has to stay as owner. Make another member an owner first." |
| `OWNER_TRANSFER_REQUIRED` | Operation needs an owner change first | Deleting owner account | 409 | "Transfer ownership before you delete your account." |
| `MEMBER_ALREADY_IN_HOUSEHOLD` | Invitation to an existing member | Accept invite | 409 | "They're already part of this household." |
| `INVITE_EXPIRED` | Link older than 7 days | Accept invite | 410 | "This invite has expired. Ask for a new one." |
| `INVITE_ALREADY_USED` | Single-use violation | Accept invite | 409 | "This invite was already used." |
| `QUIET_HOURS_INVALID` | start == end and not empty | Settings | 422 | "Quiet hours can't be the whole day. Leave them off instead." |
| `TIMEZONE_INVALID` | Not an IANA id | Settings | 422 | "Pick a timezone from the list." |
| `SESSION_EXPIRED` | Session invalid/revoked | Any | 401 | "Your session ended. Sign in again." |
| `SESSION_REVOKED` | Session removed by an owner or device sign-out | Any request from that session | 401 | "You were signed out on this device." |
| `ROLE_NOT_PERMITTED` | Role lacks the permission | Admin action | 403 | "Only owners and admins can do that." |

## Rooms

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `ROOM_NAME_TAKEN` | Duplicate name (case-insensitive) | 409 | "There's already a room called that." |
| `ROOM_IN_USE` | Archive blocked by open work that must be handled first | 409 | "This room still has work planned. Choose what happens to it first." |
| `ROOM_OVERRIDE_EXPIRED` | Override already expired when acted on | 409 | "That note has already expired." |
| `ROOM_OVERRIDE_TOO_LONG` | Exceeds household maximum | 422 | "That's further ahead than this household allows." |
| `ROOM_LIMIT_REACHED` | Soft cap (50) exceeded | 422 | "That's a lot of rooms — archive one or continue anyway." |

## Chores & recurrence

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `OCCURRENCE_ALREADY_OPEN` | Materialisation would stack | — (internal, logged not shown) | — |
| `OCCURRENCE_NOT_OPEN` | Completing/skipping a resolved occurrence | 409 | "This one was already handled. Refresh to see the latest." |
| `OCCURRENCE_STALE` | Client acted on an outdated version | 409 | "Someone changed this a moment ago. Refresh and try again." |
| `SNOOZE_TOO_LONG` | Beyond household maximum | 422 | "You can snooze up to <max>. For longer, pause the chore instead." |
| `SKIP_REASON_REQUIRED` | Missing reason | 422 | "Let everyone know why (one tap is enough)." |
| `REOPEN_WINDOW_CLOSED` | Beyond 24 h | 409 | "It's been more than 24 hours — ask an owner if this needs correcting." |
| `RECURRENCE_RULE_INVALID` | Unknown/incomplete rule | 422 | "That repeat pattern isn't one we support." |
| `RECURRENCE_INTERVAL_INVALID` | N < 1 or absurdly large | 422 | "Pick an interval between 1 and 365." |
| `DEFINITION_ARCHIVED` | Acting on an archived definition | 409 | "This is archived. Restore it first." |
| `ADHOC_REQUIRES_TITLE` | Empty ad-hoc title | 422 | "Give it a short name." |

## Trash

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `TRASH_INVALID_TRANSITION` | Illegal state move | 409 | "That change isn't possible from the current state." |
| `TRASH_RESET_REASON_REQUIRED` | Reset from FULL without a reason | 422 | "Tell us why (collected, emptied elsewhere…)." |
| `CONTAINER_ARCHIVED` | Acting on an archived container | 409 | Internal + archived hint |
| `TRASH_NAME_TAKEN` | Duplicate container name | 409 | "There's already a bin called that." |

## Resources & shopping

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `RESOURCE_MODE_MISMATCH` | Level fields don't match the mode | 422 | "This item tracks <mode>, so that value doesn't apply." |
| `RESOURCE_LEVEL_INVALID` | Negative quantity / unknown level | 422 | "That amount doesn't look right." |
| `RESOURCE_THRESHOLD_INVALID` | `criticalAt >= lowAt` or out of bounds | 422 | "The 'critical' level has to be lower than the 'low' level." |
| `RESOURCE_NAME_TAKEN` | Duplicate name | 409 | "You already track something with that name." |
| `RESOURCE_MODE_CHANGE_REQUIRES_CONFIRM` | Mode change without explicit confirmation | 409 | "Changing how this is tracked resets its current level." |
| `SHOPPING_ITEM_ALREADY_BOUGHT` | Marking an already-bought item | 409 | No user-visible error (silent refresh) |

## Maintenance

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `FREQUENCY_INVALID` | N < 1, empty months, impossible combination | 422 | "That schedule can't be built. Try a different frequency." |
| `LEAD_TIME_INVALID` | Outside 0–90 days | 422 | "Remind me between 0 and 90 days ahead." |
| `SERVICE_DATE_IN_FUTURE` | Recording a service in the future | 422 | "Services are recorded after they happen. Use 'not done yet' to snooze." |
| `ASSET_NAME_TAKEN` | Duplicate asset name | 409 | "You already have an item with that name." |
| `RECORD_TARGET_INVALID` | Neither/ both plan and asset | 422 | Internal |
| `PLAN_ALREADY_PAUSED` | Pausing twice | 409 | Silent no-op in UI |

## Issues

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `ISSUE_INVALID_TRANSITION` | Illegal status move | 409 | "That's not a step this issue can take right now." |
| `ISSUE_CLOSED_READONLY` | Comment on a closed issue | 409 | "This is closed. Report a new issue if it came back." |
| `ISSUE_TITLE_REQUIRED` | Empty title | 422 | "What's the problem? A few words is enough." |
| `ISSUE_CLOSE_NOT_PERMITTED` | HELPER attempting close | 403 | "Only the reporter, an owner or an admin can close this." |
| `ISSUE_WONT_FIX_REASON_REQUIRED` | Missing reason | 422 | "A short reason keeps everyone on the same page." |
| `COMMENT_BODY_INVALID` | Empty or > 1000 chars | 422 | "Comments can be up to 1000 characters." |
| `ATTACHMENT_REJECTED` | Type/size/count violation | 422 | "That file can't be used. Photos up to 5 MB (JPG, PNG, WebP)." |

## Alerts

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `ALERT_TERMINAL` | Acting on a resolved/expired alert | 409 | "This alert is already closed." |
| `ALERT_ALREADY_ACKNOWLEDGED` | Repeated acknowledge | 409 | Silent no-op in UI |
| `ALERT_NOT_ASSIGNED_TO_YOU` | Acknowledge by a non-recipient without authority | 403 | "This one is assigned to someone else." |
| `SNOOZE_ALREADY_ACTIVE` | Snoozing an already-snoozed alert | 409 | Extends it (allowed) — informational |
| `DEDUPE_CONFLICT` | Two creators raced on one key | — internal | Retried as a refresh |

## Notifications

| Code | Meaning | HTTP | Copy |
| --- | --- | --- | --- |
| `CHANNEL_DISABLED` | Sending on a disabled channel | 409 | "Turn this channel on in settings first." |
| `PUSH_PERMISSION_DENIED` | Browser permission denied | 422 | "Your browser is blocking notifications. Here's how to fix it." |
| `SUBSCRIPTION_INVALID` | Malformed/expired endpoint | 422 | "This device needs to be re-enabled for notifications." |
| `TEST_NOTIFICATION_LIMIT` | 3/day exceeded | 429 | "You've already sent a few test notifications today." |
| `EMAIL_NOT_CONFIGURED` | Email channel requested without a provider | 409 | "Email isn't set up yet — use the shareable link." |

## Cross-cutting

| Code | Meaning | HTTP | Notes |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | Schema/shape invalid | 422 | `details.fields` lists each field + rule |
| `NOT_FOUND` | Missing **or** not in this household | 404 | Deliberately indistinguishable |
| `FORBIDDEN` | Visible but not permitted | 403 | Never used for isolation failures |
| `CONFLICT` | Stale write | 409 | Carries the current version |
| `ALREADY_EXISTS` | Uniqueness | 409 | Carries the conflicting field |
| `RATE_LIMITED` | Limit exceeded | 429 | `details.retryAfterSeconds`; no threshold disclosure |
| `IDEMPOTENCY_REPLAY` | Not an error: original result returned | 200 | Tested per operation |
| `FEATURE_NOT_AVAILABLE` | Disabled by configuration (e.g. email off) | 409 | Copy names the fallback |
| `INTERNAL` | Unexpected; logged with correlation id | 500 | Member sees a short id, never a stack trace |

## Rules for adding a code

1. Check first whether an existing code already means this. Two codes must never overlap.
2. Add the code here, add it to `src/shared/errors/codes.ts`, and add a row to docs/api/ERROR-CATALOG.md mapping it to HTTP + copy.
3. Write the negative test in the same PR — a code without a test is an unused branch.
4. Never change the meaning of an existing code; membership in a released API is permanent.
