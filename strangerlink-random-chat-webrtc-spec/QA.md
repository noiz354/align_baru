# StrangerLink — QA

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [TESTING.md](TESTING.md), [DESIGN.md](DESIGN.md), [docs/testing/MATRIX.md](docs/testing/MATRIX.md)

> **No QA has been performed.** These are the manual scenarios that must be executed before
> each vertical slice is considered done.

---

## 0. How to use this document

Each scenario has: **preconditions**, **steps**, **expected result**, and **pass criteria**.
Scenarios are grouped by slice. A scenario marked **[SAFETY]** is a release blocker if it
fails.

Two browser contexts are required for most scenarios. Use Playwright's multi-context
support or two real browsers.

---

## 1. Core journey scenarios

### QA-01 — Join queue **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | Fresh browser; no consent stored |
| **Steps** | 1. Open `/`. 2. Tap **Start**. 3. Attempt to check only the first age-gate box and tap **Continue**. 4. Check both boxes and tap **Continue**. 5. Select **Text**. 6. Tap **Find a stranger**. |
| **Expected** | Step 3: Continue is disabled. Step 4: proceeds. Step 6: waiting state with elapsed time and a visible **Cancel**. |
| **Pass criteria** | Continue is genuinely disabled, not merely styled so. Cancel is visible and operable. |

### QA-02 — Cancel queue

| | |
| --- | --- |
| **Preconditions** | In the waiting state |
| **Steps** | 1. Wait 3 seconds. 2. Tap **Cancel**. |
| **Expected** | Immediate return to mode selection. No match is created. The elapsed timer stops. |
| **Pass criteria** | Cancellation is immediate and visibly acknowledged. |

### QA-03 — Find match

| | |
| --- | --- |
| **Preconditions** | Two browsers, both consented, both in text mode, both queued |
| **Steps** | 1. Queue in browser A. 2. Queue in browser B. |
| **Expected** | Both transition to an active session. Neither sees any information about the other. |
| **Pass criteria** | Both reach `ACTIVE`. No name, avatar, location, or interest is displayed for the peer. |

### QA-04 — Send text

| | |
| --- | --- |
| **Preconditions** | Active session in two browsers |
| **Steps** | 1. Type "hello" in A and press Enter. 2. Observe B. 3. Reply in B. |
| **Expected** | Message appears in B, then the reply in A, in order. No read receipts, no typing indicators. |
| **Pass criteria** | Ordering is correct. No receipt or typing UI appears. |

### QA-05 — Peer disconnect

| | |
| --- | --- |
| **Preconditions** | Active session |
| **Steps** | 1. Close browser B's tab. |
| **Expected** | A shows **"Your stranger left the chat."** — not "connection lost", not a spinner. |
| **Pass criteria** | The exact disconnect state is correct (DESIGN.md §12). |

### QA-06 — Skip

| | |
| --- | --- |
| **Preconditions** | Active session |
| **Steps** | 1. Tap **Skip** in A. |
| **Expected** | A returns to a post-session screen offering a new match or exit. B sees "Your stranger left the chat." |
| **Pass criteria** | No confirmation modal intercepts the skip. |

### QA-07 — Requeue

| | |
| --- | --- |
| **Preconditions** | Post-session screen |
| **Steps** | 1. Tap **Find someone new**. 2. Queue with browser C. |
| **Expected** | A matches with C, not with B. |
| **Pass criteria** | Recent-peer avoidance prevents an immediate rematch (FR-MATCH-005). |

### QA-08 — Exit from every state **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | Various |
| **Steps** | Attempt to exit from: landing, age gate, mode selection, waiting, matched, connecting, active. |
| **Expected** | A single, always-visible control returns to a clean exit in every state. |
| **Pass criteria** | No state traps the user. No confirmation modal blocks a deliberate exit. |

---

## 2. Permission scenarios

### QA-09 — Camera denied

| | |
| --- | --- |
| **Preconditions** | Video mode selected; browser camera permission set to **Block** |
| **Steps** | 1. Match with a peer. 2. Tap **Turn on camera**. |
| **Expected** | "Camera access was blocked. You can still chat by text." with a link to browser settings and a **Continue with text** action. The session continues. |
| **Pass criteria** | A specific, recoverable state. **The session does not end.** (FR-MEDIA-004) |

### QA-10 — Microphone denied

| | |
| --- | --- |
| **Preconditions** | Audio mode; microphone permission blocked |
| **Steps** | 1. Match. 2. Tap **Turn on microphone**. |
| **Expected** | Specific denial state; session continues in text. |
| **Pass criteria** | Same as QA-09. |

### QA-11 — Permission dismissed

| | |
| --- | --- |
| **Steps** | Dismiss the browser permission prompt without choosing. |
| **Expected** | Treated as denied; the same recoverable state. |

### QA-12 — Permission revoked mid-session

| | |
| --- | --- |
| **Steps** | 1. Enable the camera. 2. Revoke permission in browser settings. |
| **Expected** | Media state → failed; the session continues in text; the user is informed. |

---

## 3. WebRTC scenarios

### QA-13 — WebRTC failure

| | |
| --- | --- |
| **Preconditions** | Video mode; network conditions that prevent direct P2P |
| **Steps** | 1. Match. 2. Attempt video. |
| **Expected** | A specific failure state: "Couldn't start the video call." with **Retry video**, **Continue with text**, and **Leave**. |
| **Pass criteria** | Never a generic spinner. Never a silent session end. (FR-MEDIA-007) |

### QA-14 — TURN fallback

| | |
| --- | --- |
| **Preconditions** | coturn available; direct P2P blocked |
| **Steps** | 1. Match in video mode. 2. Observe the connection. |
| **Expected** | Connection succeeds via relay. Metrics show `path=relay`. |
| **Pass criteria** | The user is not told which path was used; the metric records it. |

### QA-15 — TURN unavailable

| | |
| --- | --- |
| **Preconditions** | coturn stopped; direct P2P blocked |
| **Steps** | 1. Attempt video. |
| **Expected** | "Video is unavailable right now." with **Continue with text** and **Leave**. |
| **Pass criteria** | Text chat continues. A specific state is shown. |

### QA-16 — ICE restart

| | |
| --- | --- |
| **Preconditions** | Active video session on Wi-Fi |
| **Steps** | 1. Switch to cellular. |
| **Expected** | ICE restart attempted; either recovery with a brief indicator, or a clear failure state. |
| **Pass criteria** | The user is never left without information for more than 5 seconds. |

### QA-17 — Device switching

| | |
| --- | --- |
| **Preconditions** | Two cameras available |
| **Steps** | 1. Enable the camera. 2. Open the device selector. 3. Select the other camera. |
| **Expected** | The video source changes without ending the session. |

---

## 4. Safety scenarios

### QA-18 — Report peer **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | Active session |
| **Steps** | 1. Tap **Report**. 2. Select **Harassment**. 3. Tap **Submit report**. |
| **Expected** | The session ends. The reporter sees "Thanks — we've received your report." The peer sees only a session end. |
| **Pass criteria** | Exactly two taps from session to submitted. The peer is **not** told they were reported. (FR-REPORT-001, FR-REPORT-009) |

### QA-19 — Report after peer disconnect **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | Active session |
| **Steps** | 1. Close the peer's tab. 2. In the post-session state, submit a report. |
| **Expected** | The report is accepted against the ended session. |
| **Pass criteria** | FR-REPORT-002. This is the single most important report scenario. |

### QA-20 — Report from `CONNECTING` **[SAFETY]**

| | |
| --- | --- |
| **Steps** | Submit a report while media negotiation is in progress. |
| **Expected** | The report is accepted; the session ends. |

### QA-21 — Block peer **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | Active session |
| **Steps** | 1. Tap **Block**. 2. Confirm. 3. Requeue. |
| **Expected** | Session ends. "Blocked. They can't match with you again." The blocked peer is not rematched. |
| **Pass criteria** | One confirmation only. Blocked peer excluded. (FR-BLOCK-001, FR-BLOCK-002) |

### QA-22 — Block survives reload

| | |
| --- | --- |
| **Steps** | 1. Block a peer. 2. Reload the page. 3. Requeue. |
| **Expected** | The blocked peer is still excluded within the same browser session. |

### QA-23 — Moderation disconnect **[SAFETY]**

| | |
| --- | --- |
| **Preconditions** | A moderator ends the session via the admin surface |
| **Steps** | 1. Trigger a moderation disconnect. 2. Observe the client. |
| **Expected** | "This chat was ended by moderation." with an option to report if the user believes it is a mistake. |
| **Pass criteria** | **No rule, signal, actor, or reasoning is disclosed.** (NFR-SAFE-002) |

### QA-24 — Rate limit

| | |
| --- | --- |
| **Steps** | 1. Join and leave the queue rapidly five times. |
| **Expected** | A cooldown applies, shown honestly: "Please wait a few seconds before trying again." with the remaining time. |
| **Pass criteria** | Never disguised as a network error. |

### QA-25 — Restricted user

| | |
| --- | --- |
| **Preconditions** | The identity is restricted |
| **Steps** | 1. Attempt to join the queue. |
| **Expected** | "You can't start new chats right now." with a **Report a problem** action that always works. |
| **Pass criteria** | A restricted user can still report. No dead end. |

### QA-26 — Age gate bypass attempt **[SAFETY]**

| | |
| --- | --- |
| **Steps** | 1. Open `/queue` directly without consent. 2. Open `/chat/<any-id>` directly. |
| **Expected** | Both redirect to the age gate. |
| **Pass criteria** | FR-ENTRY-005. |

---

## 5. Network and resilience scenarios

### QA-27 — WebSocket disconnect and reconnect

| | |
| --- | --- |
| **Steps** | 1. Active session. 2. Disable the network for 3 seconds. 3. Re-enable. |
| **Expected** | "Reconnecting…" then recovery, or a clear "connection lost" state. |
| **Pass criteria** | The session is not silently ended within the reconnect window. |

### QA-28 — Stale session on reload

| | |
| --- | --- |
| **Steps** | 1. End a session. 2. Reload `/chat/<that-id>`. |
| **Expected** | "This chat has already ended." with a route to start a new chat. |

### QA-29 — Two tabs, one identity

| | |
| --- | --- |
| **Steps** | 1. Open the app in two tabs. 2. Queue in both. |
| **Expected** | The older tab receives `SESSION_SUPERSEDED` and is returned to a clean state. INV-1 holds. |

### QA-30 — Tab backgrounded on mobile

| | |
| --- | --- |
| **Steps** | 1. Active video session. 2. Background the tab for 2 minutes. 3. Return. |
| **Expected** | Either the session ended by timeout with a clear message, or it resumed with a degraded indicator. |

### QA-31 — Offline

| | |
| --- | --- |
| **Steps** | Disable the network entirely. |
| **Expected** | "You appear to be offline." with automatic retry. |

---

## 6. Mobile browser scenarios

### QA-32 — Mobile viewport

| | |
| --- | --- |
| **Preconditions** | 360 × 640 viewport, touch emulation |
| **Steps** | Walk every journey. |
| **Expected** | All controls reachable one-handed; touch targets ≥ 44 px; no horizontal scroll. |

### QA-33 — Mobile Safari / Chrome

| | |
| --- | --- |
| **Steps** | Repeat the core journey on iOS Safari and Android Chrome. |
| **Expected** | Identical behaviour. WebRTC and permission flows work on both. |

### QA-34 — Mobile network

| | |
| --- | --- |
| **Preconditions** | Network throttled to "Slow 4G" |
| **Steps** | Complete a text session; then attempt video. |
| **Expected** | Text works. Video either succeeds at reduced quality or fails with a specific state. |

### QA-35 — Orientation change

| | |
| --- | --- |
| **Steps** | Rotate during a video session. |
| **Expected** | Layout reflows; the PiP repositions; no control becomes unreachable. |

---

## 7. Accessibility scenarios

### QA-36 — Keyboard-only journey **[SAFETY]**

| | |
| --- | --- |
| **Steps** | Complete landing → age gate → queue → chat → skip → exit using only the keyboard. |
| **Expected** | Every control reachable and operable; visible focus throughout. |
| **Pass criteria** | NFR-A11Y-002. |

### QA-37 — Screen reader journey

| | |
| --- | --- |
| **Steps** | Repeat QA-36 with NVDA (Windows), VoiceOver (macOS/iOS), and TalkBack (Android). |
| **Expected** | Every state change announced; the report flow is fully operable. |

### QA-38 — Report accessibility **[SAFETY]**

| | |
| --- | --- |
| **Steps** | Reach and submit a report using only the keyboard, then using only a screen reader. |
| **Expected** | The report control is reachable without traversing the message list first. |
| **Pass criteria** | A user who cannot use a mouse can still report. |

### QA-39 — Reduced motion

| | |
| --- | --- |
| **Steps** | Enable `prefers-reduced-motion` and walk the journeys. |
| **Expected** | No animation; the waiting indicator is static; all functionality intact. |

---

## 8. Cross-cutting scenarios

### QA-40 — Storage blocked

| | |
| --- | --- |
| **Steps** | Block cookies and storage; repeat the core journey. |
| **Expected** | The app degrades to in-memory state and does not crash. |

### QA-41 — Long message

| | |
| --- | --- |
| **Steps** | Paste 5,000 characters into the message field. |
| **Expected** | A visible "Message is too long" message. Never silently truncated. |

### QA-42 — Link in message

| | |
| --- | --- |
| **Steps** | Send a URL. |
| **Expected** | Rendered as inert text with the scheme visible. No preview. No auto-fetch. |

### QA-43 — Image paste

| | |
| --- | --- |
| **Steps** | Copy an image and paste into the message field. |
| **Expected** | Ignored. No attachment is created. |

### QA-44 — Session timeout

| | |
| --- | --- |
| **Steps** | Remain in a session for 30 minutes without interacting. |
| **Expected** | "This chat ended because it ran too long." |

---

## 9. Release checklist

A vertical slice is not done until:

- [ ] All applicable QA scenarios above pass
- [ ] All `[SAFETY]` scenarios pass
- [ ] axe reports zero critical violations
- [ ] Keyboard-only journey passes
- [ ] Bundle budgets met
- [ ] No regression in the six disconnect states
- [ ] Report and Block remain reachable from every session state

---

## 10. Implementation status

No QA has been performed — there is nothing to test yet. These scenarios are the
acceptance criteria for the vertical slices in [ROADMAP.md](ROADMAP.md).
