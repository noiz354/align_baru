# StrangerLink — Design

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [PRD.md](PRD.md), [ACCESSIBILITY.md](ACCESSIBILITY.md), [docs/design/PAGES.md](docs/design/PAGES.md)

---

## 1. UX principles

The product should feel seven things, in this order of priority:

| # | Principle | What it means concretely |
| --- | --- | --- |
| 1 | **SAFE BY DEFAULT** | Media is off. Reporting is visible. Leaving is one tap. Safety copy is honest, not reassuring. |
| 2 | **FAST** | The landing page ships minimal JS. The queue screen appears instantly. No spinners where a skeleton will do. |
| 3 | **PRIVATE** | No account, no profile, no name field anywhere. The UI never implies we are storing the conversation. |
| 4 | **SIMPLE** | One primary action per screen. No settings maze. No onboarding carousel. |
| 5 | **LOW FRICTION** | Landing → matched in under 30 seconds with three taps. Interests are optional. |
| 6 | **CLEARLY MODERATED** | The user can see that moderation exists and that reports are actioned — without being told how enforcement works. |
| 7 | **MOBILE FRIENDLY** | Designed for a 360 px viewport one-handed on 4G first; desktop is an enhancement. |

### What we will not do (dark patterns)

Explicitly forbidden in this product:

- **Forced camera access.** Media is opt-in, per mode, per session.
- **Hidden reporting.** The report control is always visible in an active session. It is
  never behind a menu, never in a footer, never removed.
- **Infinite requeue loops.** There is no "keep going" trap. After a bounded number of
  consecutive skips, the user is offered an exit.
- **Deceptive safety claims.** We do not say "100% safe", "fully moderated", or
  "verified users".
- **Addictive gamification.** No streaks, no badges, no scores, no "you've talked to 47
  strangers!".
- **Public popularity scores.** No metrics about the user are shown to anyone.
- **Manipulative engagement.** No notification baiting, no "your stranger is waiting!",
  no artificial scarcity.
- **Confusing exits.** No modal that intercepts a deliberate exit. Leaving is always one
  action and always succeeds.

**The product should make exiting easy.** This is a design requirement, not a sentiment.

---

## 2. Information architecture

```
/                    Landing
  └── /start         Age gate + consent + safety notice
        └── /queue   Mode + interests + waiting state
              └── /chat/[sessionId]   Active session
                    └── /report       Report flow (sheet or page)
  └── /safety        Safety centre (static)
  └── /privacy       Privacy notice (static)
  └── /terms         Terms (static)
  └── /settings      Local preferences only
```

Full inventory: [docs/design/PAGES.md](docs/design/PAGES.md).

---

## 3. Landing page (`/`)

**Purpose:** Explain the product in five seconds and get out of the way.

**Content**

- Product name and a one-line description: "Talk to a stranger. Text, audio, or video.
  No account needed."
- Three honest value points: *No sign-up*, *Skip anytime*, *Report and block built in*.
- A single primary call to action: **Start chatting**.
- A visible, non-buried link to **Safety** and **18+ only**.

**Behaviour**

- The CTA navigates to `/start`. It does **not** open a camera, request a permission, or
  join a queue.
- No autoplaying media, no animated hero video of people's faces (it implies recording).
- No cookie banner wall on first paint; only strictly necessary storage is used before
  consent.

**States**

| State | Rendering |
| --- | --- |
| Default | As above |
| Previously consented (same browser session) | CTA label becomes **Continue** and routes straight to `/queue` |
| Reduced motion | No entrance animations |

---

## 4. Age gate (`/start`)

**Purpose:** Satisfy FR-ENTRY-002 … FR-ENTRY-007 without becoming a speed bump.

**Content**

- A plain statement: **"This service is for adults 18 and over."**
- An explanation of what that means here: conversations are with random strangers,
  content is **not** screened in real time, and you may encounter offensive material.
- Two checkboxes, **both unchecked by default**:
  1. "I am 18 or older."
  2. "I understand that conversations are with random strangers and are not screened in
     real time. I can leave or report at any time."
- A primary action: **Continue**, disabled until both boxes are checked.
- A link: **Why do we ask?** → `/safety`

**Rules**

- No pre-checked boxes. No "by continuing you agree" buried in a paragraph.
- The Continue button is genuinely disabled, not merely styled as disabled.
- The gate is keyboard operable; the checkboxes are real `<input type="checkbox">` with
  associated labels.
- Screen reader announces the gate's purpose on focus.
- Direct navigation to `/queue` or `/chat/[sessionId]` without consent redirects here
  (FR-ENTRY-005).

**Honesty note:** this is self-attestation. The copy does not claim verification. See
[docs/safety/AGE-GATING.md](docs/safety/AGE-GATING.md).

---

## 5. Safety notice

Displayed **after** the age gate and **before** mode selection, on `/start`:

- "You are about to be connected with a random stranger."
- "They may say or show things you find offensive."
- "You can leave at any time with one tap."
- "You can report or block them at any time."
- For media modes, additionally: "During a video or audio call, the other person may be
  able to determine your approximate location from your internet connection."
  (ADR-014 disclosure requirement.)

The notice is skippable only by scrolling past it, never by a dismiss button that hides
it permanently on first visit.

---

## 6. Mode selection (`/queue`, initial view)

**Content**

- Three large, clearly labelled options:
  - **Text** — "Type only. Nothing is recorded."
  - **Text + Audio** — "Add your microphone. You can mute anytime."
  - **Text + Audio + Video** — "Add your camera. You can turn it off anytime."
- A short line under the media options: "Your camera and microphone are off until you
  choose to turn them on."
- Optional interests: a chip picker from a **closed vocabulary** (ADR-009). A "Skip" link
  beside it.
- Optional language selector.
- A primary action: **Find a stranger**.

**Rules**

- Text is the default selected mode.
- Media options are **disabled with an explanation** if the kill switch is off
  (ADR-016), never silently hidden.
- Interests are visibly optional. The label reads "Interests (optional)".
- Copy says "we'll **try** to match your interests" — never "we will match your
  interests" (ADR-009 MR-3).

---

## 7. Waiting state (`/queue`, waiting)

**Purpose:** Make waiting feel bounded and make leaving trivial.

**Content**

- Animated but calm indicator (respects `prefers-reduced-motion`).
- Elapsed wait time, updating every second.
- A plain explanation: "Looking for someone who wants to chat…"
- If interests were selected: "Trying to match your interests. If nobody is available,
  we'll connect you with anyone."
- A prominent **Cancel** button.
- A quiet secondary action: **Leave**.

**Rules**

- The wait is bounded. After the queue timeout (see [PERFORMANCE.md](PERFORMANCE.md)),
  the state changes to an explicit "Nobody available right now" screen offering **Try
  again** and **Leave**. No infinite requeue.
- A cooldown after rapid join/leave is shown honestly: "Please wait a few seconds before
  trying again." It does not pretend to be a network error.
- The elapsed timer is announced to assistive technology at intervals, not every second.

---

## 8. Matched state (`/chat/[sessionId]`)

**Purpose:** Get two strangers talking with the least possible ceremony.

**Layout (text mode)**

```
┌─────────────────────────────────────┐
│ [Safety]  StrangerLink     [⋮]      │  ← top bar, minimal
├─────────────────────────────────────┤
│                                     │
│   message list (newest at bottom)   │
│                                     │
│   "You're connected. Say hi."       │  ← only before first message
│                                     │
├─────────────────────────────────────┤
│ [ Message…                ] [Send]  │
├─────────────────────────────────────┤
│  [Skip]   [Report]   [Block]        │  ← always visible
└─────────────────────────────────────┘
```

**Layout (video mode)**

- Peer video fills the viewport; local video is a small draggable picture-in-picture in a
  corner, initially bottom-right.
- Controls overlay the bottom: mute mic, camera off, switch camera, skip, report, block.
- The control bar auto-hides after inactivity and returns on tap, **except** the report
  and skip controls, which never hide.
- Text chat is available in a collapsible drawer so the two modes are not mutually
  exclusive.

**Rules**

- **Report and Block are never hidden, never in a menu, never disabled.** (G-3)
- There is no profile header for the peer. No name, no avatar, no "online since".
- The session does not display a "connection quality" flattery. It shows factual state.
- Both peers see the same control set; nothing is asymmetric.

---

## 9. Chat controls

| Control | Behaviour | Accessibility |
| --- | --- | --- |
| Message input | Autofocuses on match; Enter sends; Shift+Enter newlines | Labelled, described by character counter |
| Character counter | Appears near the limit (e.g. 1800/2000) | `aria-live="polite"` at threshold only |
| Send | Disabled when empty or over limit | Disabled state announced |
| **Skip** | Ends session, offers new match | `aria-keyshortcuts` documented |
| **Report** | Opens report sheet; does **not** end session | Focus moves to sheet; Escape closes |
| **Block** | Ends session after one confirmation | Confirmation is focus-trapped |
| Leave / exit | Always available; one action; no confirmation trap | Visible on every screen |

**Keyboard controls**

| Key | Action |
| --- | --- |
| `Enter` | Send message |
| `Shift+Enter` | Newline |
| `Esc` | Close report sheet / cancel block / leave session |
| `Tab` | Standard focus order |
| `Ctrl/Cmd + Enter` | Send (alternative) |

---

## 10. Message rendering and link handling

- Messages render as **text only**. No HTML rendering of user content. React's default
  escaping is the first line; we additionally treat message content as untrusted.
- **Links are inert by default.** A URL in a message is displayed as plain text with the
  scheme visible. It is **not** a hyperlink until the user explicitly chooses "Open link",
  and even then it opens in a new tab with `rel="noopener noreferrer"`.
  (FR-CHAT-005)
- **No link previews.** The client never fetches a URL found in a message.
- **No attachments, no images, no files** (FR-CHAT-006). The input is a text field only.
- Emoji render as text. No custom emoji, no stickers, no GIF picker.
- A message over the length limit is rejected with a visible message, never silently
  truncated (EC-17).

---

## 11. Video layout specifics

- **Aspect handling:** peer video uses `object-fit: cover` and fills the container; local
  video uses `object-fit: cover` in a fixed-aspect PiP.
- **Permission prompts are user-initiated.** The browser permission dialog appears only
  after an explicit tap on "Turn on camera".
- **Device switching** exposes an enumerated list from `enumerateDevices()`, filtered to
  video inputs. Labels come from the browser; we do not invent names.
- **No filters, no beauty mode, no virtual backgrounds.** They add complexity and imply a
  social-performance dimension we do not want.

---

## 12. Disconnect states

This is the most important section in this document. **The UI must clearly distinguish
these six states** (NFR-SAFE-001). Collapsing them into "disconnected" is a design
failure that makes the product feel broken and untrustworthy.

| State | What the user sees | Tone | Action offered |
| --- | --- | --- | --- |
| **Peer disconnected** | "Your stranger left the chat." | Neutral, factual | New match / Leave |
| **Connection failure (media)** | "Couldn't start the video call. Your internet connection may be blocking it." | Neutral, technical | Retry video / Continue with text / Leave |
| **Network issue** | "Your connection dropped. Trying to reconnect…" then success or failure | Calm, transient | Automatic; Leave always available |
| **Session timeout** | "This chat ended because it ran too long." | Neutral | New match / Leave |
| **Moderation disconnect** | "This chat was ended by moderation." | Neutral, non-specific | Report if you believe this is wrong / New match / Leave |
| **You blocked them** | "You blocked this person. They can't match with you again." | Confirmatory | New match / Leave |
| **You were blocked** | "This chat has ended." | Neutral | New match / Leave |

### What we never say

- Never "You have been banned for violating rule 4.2b" — that is confidential moderation
  reasoning (NFR-SAFE-002).
- Never "Your stranger reported you" — it enables retaliation and teaches evasion.
- Never "Connection lost" when the peer simply left.
- Never a generic spinner with no explanation for more than 5 seconds.

### Moderation disconnect copy

The copy is deliberately minimal: "This chat was ended by moderation." If the user
believes it is a mistake, they may report it — which creates an auditable appeal path —
but they are not told what triggered it.

---

## 13. Report flow

**Entry:** the always-visible **Report** control in an active session.

**Behaviour**

1. Tapping Report opens a sheet. **The session continues.**
2. The sheet lists the categories from [docs/safety/REPORTING.md](docs/safety/REPORTING.md):
   harassment, sexual content, minor safety, threats, hate, spam, scam, illegal content,
   other.
3. A single-select is required; a free-text note is optional.
4. The note field carries a hint: "Please don't include personal information about
   yourself or others."
5. Primary action: **Submit report**. Secondary: **Cancel** (returns to the session).
6. On submit: the session ends, the peer is not informed, and the user sees:
   "Thanks — we've received your report. Our moderation team reviews every report."
7. Then: **Find someone new** / **Leave**.

**Rules**

- Never more than two taps from session to submitted report.
- The category list is ordered by severity for the *reporter's* benefit but all categories
  are equally easy to select.
- "Minor safety" and "Illegal content" are visually distinguished as urgent, without
  editorialising.
- The reporter is never shown the outcome, the moderation reasoning, or a timeline
  (FR-REPORT-009).

---

## 14. Block flow

**Entry:** the always-visible **Block** control.

**Behaviour**

1. Tapping Block opens a small confirmation: "Block this person? They won't be matched
   with you again." with **Block** and **Cancel**.
2. Confirming ends the session immediately.
3. The user sees: "Blocked. They can't match with you again."
4. Then: **Find someone new** / **Leave**.

**Rules**

- One confirmation, never two. Accidental blocks are annoying but recoverable; a
  two-step gauntlet is worse.
- Blocking never requires an explanation (FR-BLOCK-006).
- Block state persists across a reload within the browser session (FR-BLOCK-004).
- The UI is honest about limits: blocking prevents rematching **through StrangerLink**. It
  does not prevent the person from returning under a new identity. See
  [docs/safety/BLOCKING.md](docs/safety/BLOCKING.md).

---

## 15. Moderation feedback

The user needs to know moderation exists without being told how it works.

**What the user sees**

- On `/safety`: a plain description of what is moderated, what happens when you report,
  and what the limits are.
- After a report: an acknowledgement of receipt.
- After a moderation disconnect: "This chat was ended by moderation."

**What the user never sees**

- Which rule was triggered.
- What signal detected it.
- Whether an automated system or a human acted.
- What action was taken against the other person.
- Anything that would help an abuser calibrate their behaviour.

This asymmetry is deliberate and is documented as a requirement (NFR-SAFE-002).

---

## 16. Mobile layout

- **Viewport target:** 360 × 640 as the minimum design width.
- **One-handed reach:** primary actions in the bottom third. Skip/Report/Block sit in a
  bottom bar reachable by thumb.
- **Touch targets:** ≥ 44 × 44 CSS px (NFR-A11Y-003).
- **No hover-dependent interactions.** Every hover affordance has a tap equivalent.
- **Viewport:** `viewport-fit=cover` with safe-area insets respected.
- **Orientation:** portrait is the primary design; landscape is supported for video.
- **Text size:** respects the user's font-size setting; no fixed px body text below 16 px
  to avoid iOS zoom-on-focus.
- **Data:** no images in the chat surface; the video PiP is the only heavy element.

---

## 17. Empty and error states

| State | Rendering |
| --- | --- |
| No one in queue | "Looking for someone…" with elapsed time, then the bounded-timeout state |
| Queue timeout | "Nobody's available right now." + Try again / Leave |
| Peer left immediately | "Your stranger left the chat." + New match / Leave |
| Camera denied | "Camera access was blocked. You can still chat by text." + How to enable / Continue with text |
| Microphone denied | Same pattern |
| WebRTC failed, TURN unavailable | "Couldn't connect the call. Your network may be blocking it." + Continue with text / Leave |
| WebSocket disconnected | "Reconnecting…" then either recovery or "Connection lost" + Leave |
| Stale session on reload | "This chat has already ended." + Start a new chat |
| Rate limited / cooldown | "Please wait a few seconds before trying again." with the remaining time |
| Restricted or banned | "You can't start new chats right now." + **Report a problem** (always available) |
| Generic failure | "Something went wrong." + Try again / Leave + Report a problem |
| Offline | "You appear to be offline." + automatic retry |

Every error state offers **Leave** and, where relevant, **Report a problem**. No dead
ends.

---

## 18. Accessibility summary

Full plan: [ACCESSIBILITY.md](ACCESSIBILITY.md).

- WCAG 2.2 AA target.
- All controls keyboard operable; visible focus indicators; logical focus order.
- Session state changes announced via a polite live region.
- Focus moves to the report sheet on open and returns to the trigger on close.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for large text and UI boundaries.
- `prefers-reduced-motion` respected everywhere.
- No information conveyed by colour alone.
- Touch targets ≥ 44 × 44 px.

---

## 19. Component inventory

See [docs/design/COMPONENTS.md](docs/design/COMPONENTS.md). Component **shells** exist in
[src/shared/ui/](src/shared/ui/) and are unimplemented.

---

## 20. Design decisions and their rationale

| Decision | Rationale |
| --- | --- |
| Text is the default mode | Lowest friction, lowest risk, works on the worst networks |
| Media is opt-in per session | Prevents forced camera access; a dark pattern we refuse |
| Report/Block never hidden | G-3: safety must be one action away |
| Six distinct disconnect states | NFR-SAFE-001: collapsing them destroys trust |
| Interests from a closed vocabulary | ADR-009: prevents interests becoming a profile |
| No peer profile header | Reinforces anonymity; removes social-performance pressure |
| Bounded queue wait | Prevents infinite requeue loops |
| Exit always one action | The product must make leaving easy |
| No link previews | Prevents the client fetching attacker-controlled URLs |
