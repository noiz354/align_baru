# StrangerLink — Component Inventory

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DESIGN.md](../../DESIGN.md), [docs/design/PAGES.md](PAGES.md), [ACCESSIBILITY.md](../../ACCESSIBILITY.md)

> **Component shells only.** No component is implemented. Shells exist in
> [src/shared/ui/](../../src/shared/ui/).

---

## 1. Primitives (`src/shared/ui/`)

| Component | Purpose | A11y commitment |
| --- | --- | --- |
| `Button` | All clickable actions | ≥ 44 × 44 px; visible focus; `aria-pressed` for toggles; critical controls ≥ 56 px |
| `Checkbox` | Age gate and consent | Real `<input type="checkbox">`; associated label; genuinely disabled Continue |
| `RadioGroup` | Report categories | Real radio inputs; arrow-key navigation; labelled group |
| `TextField` | Message composer and report note | Labelled; character counter announced at threshold only |
| `Sheet` | Report and block panels | Focus moves in on open, returns on close; Escape closes; focus trapped while open |
| `LiveRegion` | Session state announcements | Single polite region; debounced |
| `Banner` | Safety notices | Not `role="alert"` unless urgent; dismissible only where appropriate |
| `Spinner` / `WaitingIndicator` | Queue waiting | Static under `prefers-reduced-motion` |
| `ErrorState` | All failure states | Specific reason text; always offers Leave |
| `IconButton` | Media toggles | Accessible name required; never icon-only without a label |

---

## 2. Feature components

### 2.1 Entry (`features/safety/`)

| Component | Purpose |
| --- | --- |
| `AgeGate` | Two checkboxes + disabled Continue |
| `SafetyNotice` | The five disclosure statements, including the IP-exposure line for media modes |
| `ConsentAcknowledgement` | Versioned consent record |

### 2.2 Queue (`features/queue/`)

| Component | Purpose |
| --- | --- |
| `ModeSelector` | Text / Text+Audio / Text+Video; disabled with explanation when a kill switch is off |
| `InterestPicker` | Chip group from the closed vocabulary; visibly optional |
| `LanguagePicker` | Optional language selector |
| `QueueWaiting` | Elapsed time, explanation, Cancel |
| `QueueTimeout` | "Nobody's available right now" + Try again / Leave |
| `CooldownNotice` | Honest cooldown message with remaining time |

### 2.3 Session (`features/session/`)

| Component | Purpose |
| --- | --- |
| `SessionShell` | Layout container; no peer identity surface |
| `SessionStatus` | One of the six disconnect states |
| `PostSessionActions` | Find someone new / Leave |
| `SafetyExit` | Always-visible exit control |

### 2.4 Chat (`features/chat/`)

| Component | Purpose |
| --- | --- |
| `MessageList` | Ordered by sequence; focusable region for screen reader navigation |
| `MessageBody` | Text-only rendering; no `dangerouslySetInnerHTML`; inert links |
| `MessageComposer` | Text field only; no file input, no paste-image handling |
| `CharacterCounter` | Appears near the limit |
| `SessionControls` | Skip / Report / Block — never hidden, never in a menu |

### 2.5 Media (`features/media/`)

| Component | Purpose |
| --- | --- |
| `PeerVideo` | Peer video, `object-fit: cover`, fills container |
| `LocalVideoPiP` | Draggable PiP; `aria-hidden`; controls are the accessible surface |
| `MediaControls` | Mic, camera, device switch, skip, report, block; auto-hides except Skip and Report |
| `PermissionDeniedState` | Specific, recoverable message per media type |
| `MediaFailureState` | Specific failure reason; Continue with text / Leave |
| `DeviceSelector` | Native select; browser-provided labels only |

### 2.6 Safety (`features/reports/`, `features/blocks/`)

| Component | Purpose |
| --- | --- |
| `ReportSheet` | Category radio group + optional note; does not end the session |
| `ReportConfirmation` | Acknowledgement of receipt; no outcome or reasoning |
| `BlockConfirmation` | One-tap confirmation |
| `BlockConfirmation` | "Blocked. They can't match with you again." |
| `ModerationNotice` | Fixed allowlist copy; never discloses reasoning |

---

## 3. Component → requirement map

| Component | Requirements |
| --- | --- |
| `AgeGate` | FR-ENTRY-001, FR-ENTRY-002, FR-ENTRY-007 |
| `SafetyNotice` | FR-ENTRY-003, NFR-PRIV-003, NFR-SAFE-003 |
| `ConsentAcknowledgement` | FR-ENTRY-008, FR-ENTRY-009 |
| `ModeSelector` | FR-MEDIA-009, ADR-016 kill switches |
| `InterestPicker` | FR-MATCH-007, ADR-009 IM-1 … IM-7 |
| `QueueWaiting` | FR-QUEUE-005, NFR-A11Y-004 |
| `QueueTimeout` | FR-QUEUE-006, no infinite requeue |
| `SessionStatus` | NFR-SAFE-001, NFR-SAFE-002 |
| `MessageBody` | FR-CHAT-005, NFR-SEC-001 |
| `MessageComposer` | FR-CHAT-003, FR-CHAT-006 |
| `SessionControls` | FR-REPORT-001, FR-BLOCK-001, G-3 |
| `PeerVideo` / `LocalVideoPiP` | NFR-A11Y-003, FR-MEDIA-005 |
| `PermissionDeniedState` | FR-MEDIA-004 |
| `MediaFailureState` | FR-MEDIA-007 |
| `ReportSheet` | FR-REPORT-003, FR-REPORT-005 |
| `ReportConfirmation` | FR-REPORT-009 |
| `BlockConfirmation` | FR-BLOCK-003 |
| `ModerationNotice` | NFR-SAFE-002 |
| `SafetyExit` | NFR-SAFE-004 |
| `ErrorState` | NFR-SAFE-001, DESIGN.md §17 |

---

## 4. Forbidden component patterns

| Forbidden | Why |
| --- | --- |
| A peer profile header | No peer identity surface exists |
| A read-receipt indicator | Pressure mechanic |
| A typing indicator | Behavioural leakage |
| A file input in chat | FR-CHAT-006 |
| An image paste handler | FR-CHAT-006 |
| A link preview card | FR-CHAT-005 |
| A streak, badge, or score | Dark pattern |
| A "your stranger is waiting" notification | Manipulative urgency |
| A hidden report menu | G-3 |
| A confirmation modal on exit | Traps the user |
| `dangerouslySetInnerHTML` anywhere | NFR-SEC-001 |
| A markdown renderer for messages | Injection surface |

---

## 5. Implementation status

Shells for `Button`, `Checkbox`, `TextField`, `Sheet`, `LiveRegion`, `SessionStatus`,
`MessageBody`, `MessageComposer`, `SessionControls`, and `SafetyExit` exist in
[src/shared/ui/](../../src/shared/ui/) and throw `Not implemented`. The remainder are
specified here only.
