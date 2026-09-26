# StrangerLink — User Journeys

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [PRD.md](../../PRD.md), [DESIGN.md](../../DESIGN.md), [docs/design/PAGES.md](../design/PAGES.md)

---

## 1. Journey 1 — First-time text chat (happy path)

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/` | Reads, taps **Start** | Navigate to `/start` |
| 2 | User | `/start` | Checks "I am 18 or older" | Continue still disabled |
| 3 | User | `/start` | Checks the understanding box | Continue enabled |
| 4 | User | `/start` | Taps **Continue** | Consent recorded; mode selection shown |
| 5 | User | `/start` | Scrolls the safety notice | Notice visible; no permanent dismiss |
| 6 | User | `/start` | Selects **Text** (default) | Mode selected |
| 7 | User | `/start` | Skips interests | Interests optional; no penalty |
| 8 | User | `/start` | Taps **Find a stranger** | Queue join; navigate to `/queue` |
| 9 | System | `/queue` | — | Waiting state with elapsed time and **Cancel** |
| 10 | System | `/queue` | — | Match found; session created |
| 11 | User | `/chat/[id]` | Types "hi", presses Enter | Message relayed; peer receives it |
| 12 | User | `/chat/[id]` | Taps **Skip** | Session ends; post-session screen |
| 13 | User | Post-session | Taps **Leave** | Clean exit to `/` |

**Target elapsed time:** under 30 seconds from step 1 to step 10 on a warm device and a
good network (G-1).

---

## 2. Journey 2 — Report a peer

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/chat/[id]` | Taps **Report** | Report sheet opens; **session continues** |
| 2 | User | Report sheet | Selects **Harassment** | Category selected |
| 3 | User | Report sheet | Optionally adds a note | Note length-bounded; hint warns against personal information |
| 4 | User | Report sheet | Taps **Submit report** | Report recorded; **session ends** |
| 5 | System | Post-session | — | "Thanks — we've received your report." Peer is **not** told |
| 6 | System | Backend | — | Moderation case created with severity P1 |
| 7 | User | Post-session | Taps **Find someone new** or **Leave** | Requeue or exit |

**Guarantee:** two taps from session to submitted report. No name, email, or phone is
requested at any point.

---

## 3. Journey 3 — Block a peer

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/chat/[id]` | Taps **Block** | Confirmation: "Block this person? They won't be matched with you again." |
| 2 | User | Confirmation | Taps **Block** | Block recorded; session ends immediately |
| 3 | System | Post-session | — | "Blocked. They can't match with you again." |
| 4 | User | Post-session | Taps **Find someone new** | Requeue; block re-checked at candidate selection (R5) |

**Guarantee:** exactly one confirmation. No explanation is required (FR-BLOCK-006).

---

## 4. Journey 4 — Peer disappears

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | Peer | — | Closes the tab | Transport lost |
| 2 | System | User's `/chat/[id]` | — | Reconnect window opens (15 s) |
| 3a | System | User's screen | — | If no recovery: **"Your stranger left the chat."** |
| 3b | User | Post-session | Taps **Find someone new** or **Leave** | Requeue or exit |
| 4 | User | Post-session | Taps **Report** | Report accepted against the ended session (FR-REPORT-002) |

**Guarantee:** the user sees the correct one of the six disconnect states, never a generic
spinner.

---

## 5. Journey 5 — Camera denied

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/start` | Selects **Text + Audio + Video** | Mode selected |
| 2 | User | `/start` | Taps **Find a stranger** | Matched in video mode |
| 3 | User | `/chat/[id]` | Taps **Turn on camera** | Browser permission prompt appears |
| 4 | User | Browser | Taps **Block** | `NotAllowedError` |
| 5 | System | `/chat/[id]` | — | "Camera access was blocked. You can still chat by text." + settings link + **Continue with text** |
| 6 | User | `/chat/[id]` | Taps **Continue with text** | Session continues in text |

**Guarantee:** a permission denial never ends the session (FR-MEDIA-004).

---

## 6. Journey 6 — Video fails, TURN unavailable

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/chat/[id]` | Enables video | ICE gathering; direct fails |
| 2 | System | `/chat/[id]` | — | TURN attempted; coturn unavailable |
| 3 | System | `/chat/[id]` | — | "Couldn't connect the call. Your network may be blocking it." + **Continue with text** + **Leave** |
| 4 | User | `/chat/[id]` | Taps **Continue with text** | Session continues in text |

**Guarantee:** media failure never silently ends the session (FR-MEDIA-007).

---

## 7. Journey 7 — Moderated out

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | Moderator | `/admin/moderation` | Applies `disconnect` | Session ended |
| 2 | System | User's `/chat/[id]` | — | **"This chat was ended by moderation."** + **Report if you believe this is a mistake** |
| 3 | User | Post-session | Taps **Report** | Report creates an auditable appeal path |

**Guarantee:** no rule, signal, actor, or reasoning is disclosed (NFR-SAFE-002). The user
can always challenge the decision.

---

## 8. Journey 8 — Rate limited

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | `/queue` | Joins and cancels five times rapidly | Cooldown ladder triggers |
| 2 | System | `/queue` | — | "Please wait a few seconds before trying again." + remaining time |
| 3 | User | `/queue` | Waits | Cooldown expires; queue join permitted |

**Guarantee:** the cooldown is shown honestly and is never disguised as a network error.

---

## 9. Journey 9 — Restricted user

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | System | `/queue` | Ban or restriction detected | "You can't start new chats right now." |
| 2 | User | `/queue` | Taps **Report a problem** | Report accepted — a banned user can still report |

**Guarantee:** no dead end. Reporting is never disabled.

---

## 10. Journey 10 — Two tabs

| Step | Actor | Screen | Action | System response |
| --- | --- | --- | --- | --- |
| 1 | User | Tab A | Joins the queue | Ticket issued |
| 2 | User | Tab B | Joins the queue | New socket supersedes the old |
| 3 | System | Tab A | — | `SESSION_SUPERSEDED`; Tab A returns to a clean entry state |
| 4 | System | Tab B | — | Continues normally |

**Guarantee:** INV-1 holds. The older tab is told, not silently broken (R8).

---

## 11. Journey 11 — Keyboard-only user

| Step | Actor | Action | System response |
| --- | --- | --- | --- |
| 1 | User | `Tab` to **Start**, `Enter` | `/start` |
| 2 | User | `Tab` to checkboxes, `Space` | Both checked; Continue enabled |
| 3 | User | `Tab` to **Continue**, `Enter` | Mode selection |
| 4 | User | `Tab` to **Find a stranger**, `Enter` | Queue |
| 5 | System | — | Focus moves to the session `h1` |
| 6 | User | `Tab` to **Report** | Report is reachable without traversing the message list |
| 7 | User | `Escape` | Closes the report sheet; focus returns to the trigger |

**Guarantee:** NFR-A11Y-002. A user who cannot use a mouse can still report.

---

## 12. Journey 12 — Network switch during video

| Step | Actor | Action | System response |
| --- | --- | --- | --- |
| 1 | User | Active video on Wi-Fi | `connected` |
| 2 | User | Switches to cellular | `disconnected`; ICE restart attempted |
| 3a | System | — | Recovery: brief "Reconnecting…" then normal |
| 3b | System | — | Failure: specific failure state; **Continue with text** offered |

**Guarantee:** at most one automatic restart. `disconnected` (transient) and `failed`
(terminal) are never conflated.

---

## 13. Journey summary

| Journey | Slice | Primary requirements |
| --- | --- | --- |
| 1 — First-time text chat | VS-1 … VS-5 | FR-ENTRY, FR-QUEUE, FR-MATCH, FR-CHAT |
| 2 — Report | VS-6 | FR-REPORT-001 … FR-REPORT-010 |
| 3 — Block | VS-6 | FR-BLOCK-001 … FR-BLOCK-006 |
| 4 — Peer disappears | VS-4, VS-5 | NFR-SAFE-001, FR-REPORT-002 |
| 5 — Camera denied | VS-9, VS-10 | FR-MEDIA-003, FR-MEDIA-004 |
| 6 — Video fails | VS-10, VS-11 | FR-MEDIA-007 |
| 7 — Moderated out | VS-7, VS-12 | NFR-SAFE-002, FR-MOD-003 |
| 8 — Rate limited | VS-13 | FR-SAFE-001, FR-SAFE-002 |
| 9 — Restricted | VS-7 | FR-SAFE-004 |
| 10 — Two tabs | VS-3, VS-5 | INV-1 |
| 11 — Keyboard only | VS-0 onward | NFR-A11Y-002 |
| 12 — Network switch | VS-10 | NFR-REL-002 |

---

## 14. Edge cases by journey

| Edge case | Journey | Expected behaviour |
| --- | --- | --- |
| EC-01 both peers skip | 1, 4 | One session end; both land cleanly |
| EC-02 cancel at match instant | 1 | Match aborted; both return to `WAITING` |
| EC-05 report while ending | 2, 4 | Report accepted against the terminal session |
| EC-06 block during requeue | 3 | Blocked peer excluded |
| EC-09 camera denied | 5 | Recoverable state; text continues |
| EC-11 WebRTC fails, TURN down | 6 | Specific failure state; text continues |
| EC-12 Wi-Fi → cellular | 12 | ICE restart; then recovery or clear failure |
| EC-15 direct URL to a session | any | Redirected to entry |
| EC-16 two tabs | 10 | Older tab superseded and informed |
| EC-19 rapid join/leave | 8 | Cooldown, shown honestly |
| EC-20 report after session end | 4 | Accepted |
| EC-23 storage blocked | 1 | In-memory degradation; no crash |
