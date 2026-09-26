# Error Catalogue — HTTP & copy mapping

> One row per error code: the wire status, who sees what, and which task implements it.
> Domain semantics live in docs/domain/ERRORS.md; this file is the transport/copy view. Keep them in sync — the verify-docs gate checks that every code here exists there.

## Status code policy

| Status | Used when | Never used for |
| --- | --- | --- |
| 200 | Success, including idempotent replay | — |
| 400 | Malformed request shape that Zod cannot map to a field | Missing/invalid field values (that is 422) |
| 401 | No session, expired session, revoked session | Permission (403) |
| 403 | Authenticated, visible resource, role not allowed | Isolation failures (404) |
| 404 | Missing **or** not in this household | Genuinely distinguishable cases |
| 409 | State conflict: illegal transition, stale version, duplicate | Validation (422) |
| 410 | Expired one-time artifact (invite, reset link) | Deleted resources |
| 422 | Validation/business-rule value problems | Concurrency conflicts |
| 429 | Rate limit | Business limits (those are 422) |
| 500 | Unexpected error, logged with a correlation id | Anything we can name |
| 503 | Readiness failing (DB down, migrations mismatch) | Any user error |

## Mapping table

| Code | HTTP | Surface shown | Copy tone (T-1..T-7) | Task |
| --- | --- | --- | --- | --- |
| `VALIDATION_FAILED` | 422 | Inline under the field | Plain, specific, no blame | T-PLAT-006 |
| `NOT_FOUND` | 404 | Empty state or "back to list" | Matter-of-fact, no hints | T-PLAT-006 |
| `FORBIDDEN` | 403 | Inline banner | Names who can do it | T-PLAT-006 |
| `CONFLICT` | 409 | Toast + refresh affordance | "Someone changed this a moment ago." | T-PLAT-006 |
| `ALREADY_EXISTS` | 409 | Inline under the field | Names the duplicate value | T-PLAT-006 |
| `RATE_LIMITED` | 429 | Toast | Calm, no threshold disclosure | T-PLAT-025 |
| `INTERNAL` | 500 | Page-level error with id | Apologetic, actionable | T-PLAT-006 |
| `FEATURE_NOT_AVAILABLE` | 409 | Inline note | Names the fallback | T-NOTIF-009 |
| `SESSION_EXPIRED` | 401 | Redirect to sign-in | "Your session ended." | T-AUTH-001 |
| `SESSION_REVOKED` | 401 | Redirect + reason | "You were signed out on this device." | T-AUTH-004 |
| `LAST_OWNER_CANNOT_LEAVE` | 409 | Blocking dialog | Explains what to do first | T-MEM-004 |
| `OWNER_TRANSFER_REQUIRED` | 409 | Blocking dialog | Step-by-step | T-MEM-004 |
| `MEMBER_ALREADY_IN_HOUSEHOLD` | 409 | Inline | Neutral fact | T-MEM-001 |
| `INVITE_EXPIRED` | 410 | Page-level | Offers a new invite | T-MEM-002 |
| `INVITE_ALREADY_USED` | 409 | Page-level | Explains single use | T-MEM-003 |
| `QUIET_HOURS_INVALID` | 422 | Inline | Suggests turning quiet hours off | T-NOTIF-004 |
| `TIMEZONE_INVALID` | 422 | Inline select | Pick from list | T-HH-001 |
| `ROLE_NOT_PERMITTED` | 403 | Inline banner | "Only owners and admins…" | T-AUTH-004 |
| `ROOM_NAME_TAKEN` | 409 | Inline | Suggests a suffix | T-ROOM-001 |
| `ROOM_IN_USE` | 409 | Dialog | Explains the choice that must be made | T-ROOM-008 |
| `ROOM_OVERRIDE_EXPIRED` | 409 | Toast | Silent refresh | T-ROOM-004 |
| `ROOM_OVERRIDE_TOO_LONG` | 422 | Inline | Names the maximum | T-ROOM-004 |
| `ROOM_LIMIT_REACHED` | 422 | Inline with "continue anyway" | Honest nudge, not a wall | T-ROOM-001 |
| `OCCURRENCE_NOT_OPEN` | 409 | Toast + refresh | Neutral | T-CHORE-004 |
| `OCCURRENCE_STALE` | 409 | Toast + refresh | "Someone changed this a moment ago." | T-CHORE-004 |
| `SNOOZE_TOO_LONG` | 422 | Inline | Offers pause instead | T-CHORE-008 |
| `SKIP_REASON_REQUIRED` | 422 | Inline chip row | "One tap is enough." | T-CHORE-007 |
| `REOPEN_WINDOW_CLOSED` | 409 | Inline | Suggests asking an owner | T-CHORE-005 |
| `RECURRENCE_RULE_INVALID` | 422 | Inline | Lists supported patterns | T-CHORE-021 |
| `RECURRENCE_INTERVAL_INVALID` | 422 | Inline number field | Bounds stated | T-CHORE-021 |
| `DEFINITION_ARCHIVED` | 409 | Inline | Offers restore | T-CHORE-003 |
| `ADHOC_REQUIRES_TITLE` | 422 | Inline | "A few words is enough." | T-CHORE-006 |
| `TRASH_INVALID_TRANSITION` | 409 | Toast + refresh | Neutral; the UI hides impossible actions anyway | T-TRASH-002 |
| `TRASH_RESET_REASON_REQUIRED` | 422 | Inline | Suggests "collected" | T-TRASH-007 |
| `CONTAINER_ARCHIVED` | 409 | Inline | Read-only explanation | T-TRASH-001 |
| `TRASH_NAME_TAKEN` | 409 | Inline | — | T-TRASH-001 |
| `RESOURCE_MODE_MISMATCH` | 422 | Inline | Explains the tracking mode | T-RES-002 |
| `RESOURCE_LEVEL_INVALID` | 422 | Inline | — | T-RES-004 |
| `RESOURCE_THRESHOLD_INVALID` | 422 | Inline pair of fields | Explains the ordering | T-RES-015 |
| `RESOURCE_NAME_TAKEN` | 409 | Inline | — | T-RES-001 |
| `RESOURCE_MODE_CHANGE_REQUIRES_CONFIRM` | 409 | Confirmation dialog | States the level reset | T-RES-007 |
| `SHOPPING_ITEM_ALREADY_BOUGHT` | 409 | Silent | No error shown | T-SHOP-003 |
| `FREQUENCY_INVALID` | 422 | Inline schedule builder | Shows valid examples | T-MNT-002 |
| `LEAD_TIME_INVALID` | 422 | Inline | Bounds stated | T-MNT-002 |
| `SERVICE_DATE_IN_FUTURE` | 422 | Inline date | Suggests snooze | T-MNT-005 |
| `ASSET_NAME_TAKEN` | 409 | Inline | — | T-MNT-001 |
| `RECORD_TARGET_INVALID` | 422 | Internal | — | T-MNT-005 |
| `PLAN_ALREADY_PAUSED` | 409 | Silent | — | T-MNT-009 |
| `ISSUE_INVALID_TRANSITION` | 409 | Toast + refresh | Neutral | T-ISSUE-001 |
| `ISSUE_CLOSED_READONLY` | 409 | Inline note | Offers a new issue | T-ISSUE-008 |
| `ISSUE_TITLE_REQUIRED` | 422 | Inline | "A few words is enough." | T-ISSUE-002 |
| `ISSUE_CLOSE_NOT_PERMITTED` | 403 | Inline banner | Names permitted roles | T-ISSUE-007 |
| `ISSUE_WONT_FIX_REASON_REQUIRED` | 422 | Inline | Short reason | T-ISSUE-007 |
| `COMMENT_BODY_INVALID` | 422 | Inline | Length bounds | T-ISSUE-008 |
| `ATTACHMENT_REJECTED` | 422 | Inline | Type/size/count limits | T-ISSUE-006 |
| `ALERT_TERMINAL` | 409 | Toast + refresh | Neutral | T-ALERT-015 |
| `ALERT_ALREADY_ACKNOWLEDGED` | 409 | Silent | — | T-ALERT-015 |
| `ALERT_NOT_ASSIGNED_TO_YOU` | 403 | Inline banner | Names the current recipient | T-ALERT-015 |
| `SNOOZE_ALREADY_ACTIVE` | 409 | Toast | "Extended instead." | T-ALERT-016 |
| `CHANNEL_DISABLED` | 409 | Inline | Deep link to settings | T-NOTIF-004 |
| `PUSH_PERMISSION_DENIED` | 422 | Inline help | Recovery steps by platform | T-NOTIF-007 |
| `SUBSCRIPTION_INVALID` | 422 | Inline | Re-enable this device | T-NOTIF-007 |
| `TEST_NOTIFICATION_LIMIT` | 429 | Inline | Friendly, states limit | T-NOTIF-012 |
| `EMAIL_NOT_CONFIGURED` | 409 | Inline | Offers shareable link | T-NOTIF-009 |
| `HOUSEHOLD_NOT_FOUND` | 404 | Redirect to onboarding | — | T-HH-001 |
| `IDEMPOTENCY_REPLAY` | 200 | Success (no error UI) | — | T-PLAT-007 |

## Copy rules applied (from DESIGN.md §17)

1. Say what happened, then what to do — never "Error 422".
2. Never blame the member ("You entered an invalid value" ✗ → "That amount doesn't look right" ✓).
3. Never invent urgency for a recoverable state.
4. Offer the next step inline wherever possible (retry, refresh, escalate, undo).
5. Unknown error → calm message + short reference id; never a stack trace or SQL text.
