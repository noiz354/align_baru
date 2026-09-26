# StrangerLink — Accessibility

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DESIGN.md](DESIGN.md), [TESTING.md](TESTING.md), [QA.md](QA.md)

---

## 0. Target

**WCAG 2.2 Level AA** for all user-facing flows.

This is not aspirational. Accessibility failures in this product are **safety** failures:
a user who cannot find the report button, or cannot operate it with a keyboard, cannot
protect themselves. Every requirement below is therefore also a safety requirement.

---

## 1. Keyboard controls

| Requirement | Detail |
| --- | --- |
| NFR-A11Y-002 | All interactive controls are reachable and operable by keyboard alone |
| Tab order | Follows visual order; no positive `tabindex` |
| Focus visible | A visible focus indicator on every focusable element, ≥ 3:1 contrast against the adjacent background |
| No keyboard traps | Except deliberate modal focus trapping in the report and block confirmation sheets, which have a documented escape |
| Skip link | A "Skip to main content" link on content-heavy pages |
| Shortcuts | Documented and discoverable; never single-key without a modifier |

### Keyboard map

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move focus |
| `Enter` | Activate; send message |
| `Shift+Enter` | Newline in the message field |
| `Space` | Activate buttons and toggles |
| `Escape` | Close the report sheet; cancel a block; leave the session |
| `Ctrl/Cmd + Enter` | Send message (alternative) |
| Arrow keys | Navigate the interest chip group and the device selector |

---

## 2. Screen reader support

| Requirement | Detail |
| --- | --- |
| Labels | Every control has an accessible name; no unlabelled icon buttons |
| Roles | Native HTML elements preferred; ARIA only where no native equivalent exists |
| Live regions | Session state changes announced via `aria-live="polite"` |
| Landmarks | `main`, `nav`, `banner`, `contentinfo` used correctly |
| Headings | A logical heading hierarchy on every page; no skipped levels |
| Descriptions | `aria-describedby` for controls whose purpose is not fully conveyed by the name |

### What is announced

| Event | Announcement |
| --- | --- |
| Entering the queue | "Looking for someone to chat with" |
| Match found | "You're connected with a stranger" |
| Message received | **Not announced per message** — a polite summary at intervals, to avoid flooding |
| Peer left | "Your stranger left the chat" |
| Report submitted | "Your report has been submitted" |
| Block created | "You blocked this person" |
| Moderation disconnect | "This chat was ended by moderation" |
| Connection lost | "Your connection was lost" |
| Rate limited | "Please wait before trying again" |

**Per-message announcements are deliberately suppressed.** Announcing every message in a
fast conversation makes a screen reader unusable. Instead, a polite region summarises at
intervals, and the message list is a focusable region the user can navigate.

---

## 3. Video control accessibility

| Requirement | Detail |
| --- | --- |
| Camera/mic toggles | Real buttons with `aria-pressed` reflecting state |
| State announcement | "Camera on" / "Camera off" announced on toggle |
| Device selector | A native `<select>` where possible, with browser-provided labels |
| PiP video | `aria-hidden` on the decorative local preview; controls are the accessible surface |
| Peer video | Labelled as the peer's video; no `alt`-style description of the stranger |
| Controls auto-hide | **Report and Skip never hide** (DESIGN.md §8); hidden controls remain in the tab order and return on focus |
| Focus order in video mode | Controls are reachable without hunting for a hidden bar |

---

## 4. Focus management

| Situation | Behaviour |
| --- | --- |
| Route change | Focus moves to the new page's `h1`; the previous focus is not left dangling |
| Report sheet opens | Focus moves to the sheet; the trigger is remembered |
| Report sheet closes | Focus returns to the trigger |
| Block confirmation opens | Focus moves to the confirmation; focus is trapped while open |
| Session ends | Focus moves to the post-session action group |
| Modal opens | Focus trapped; `Escape` closes; background is inert |
| Error appears | Focus moves to the error, or the error is announced politely if focus should not move |
| Content updates | Focus is never stolen unexpectedly |

---

## 5. Captions and media

| Requirement | Detail |
| --- | --- |
| MVP position | There is no server-side media processing, so **no live captions are provided** |
| Disclosure | This is stated honestly in the safety notice for media modes |
| PLANNED | Browser-native captions where available (e.g. system-level live captions) |
| Not planned | Server-side transcription — it would require capturing media, which is forbidden (FR-MEDIA-008) |
| Audio-only mode | No captions; the user is told this before selecting the mode |

**We do not claim caption support we cannot deliver.** Captioning stranger media would
require processing media, which would require capturing it, which we will not do.

---

## 6. Contrast

| Requirement | Value |
| --- | --- |
| Body text | ≥ 4.5:1 |
| Large text (≥ 24 px, or ≥ 18.66 px bold) | ≥ 3:1 |
| UI component boundaries | ≥ 3:1 |
| Focus indicators | ≥ 3:1 against adjacent background |
| Disabled controls | Exempt from the contrast requirement, but must still be distinguishable |

Contrast is verified in CI on the design tokens, and manually on composite surfaces (video
overlays are the hard case).

---

## 7. Touch target sizes

| Requirement | Value |
| --- | --- |
| NFR-A11Y-003 | All touch targets ≥ 44 × 44 CSS px |
| Minimum spacing | ≥ 8 px between adjacent targets |
| Critical controls | Skip, Report, Block, and the message field are **≥ 56 × 56 px** |
| Video overlay controls | ≥ 48 × 48 px |

Verified by an automated axe check in E2E.

---

## 8. Reduced motion

| Requirement | Detail |
| --- | --- |
| NFR-A11Y-004 | `prefers-reduced-motion: reduce` is respected everywhere |
| What changes | The queue waiting indicator becomes static; transitions are instant; no parallax or scale animations |
| What does not change | Functionality; all controls remain operable |

---

## 9. Status announcements

| Requirement | Detail |
| --- | --- |
| NFR-A11Y-005 | Session state changes are announced |
| Mechanism | A single polite live region, not one per component |
| Content | State name and, where useful, elapsed time |
| Suppression | Rapid successive changes are debounced to avoid flooding |
| Errors | Announced with the reason class, not a raw error string |

---

## 10. Disconnect and report accessibility

These are the most important accessibility requirements in this document.

| Requirement | Detail |
| --- | --- |
| Report reachable by keyboard | `Tab` to the Report button from anywhere in the session without traversing the message list first |
| Report shortcut | A documented keyboard path that does not require mouse precision |
| Report in every state | Available in `CREATED`, `WAITING`, `MATCHED`, `CONNECTING`, and `ACTIVE` |
| Block reachable by keyboard | Same as Report |
| Disconnect reason announced | Every one of the six disconnect states (DESIGN.md §12) is announced with a distinct message |
| Post-session actions focusable | "Find someone new" and "Leave" are the first tab stops after a session ends |
| Report form accessible | Category is a real radio group; the note is a labelled textarea with a character counter announced at the threshold |

---

## 11. Cognitive accessibility

| Requirement | Detail |
| --- | --- |
| Plain language | Safety copy is written at a target reading level appropriate to the audience; no legal jargon in the age gate |
| No time pressure | No countdown that forces a decision, except the honest queue wait display |
| Consistent layout | Control positions do not move between screens |
| Reversible actions | Skip and Leave are always available; no destructive action without confirmation |
| No dark patterns | See [DESIGN.md](DESIGN.md) §1 — the forbidden list |

---

## 12. Testing

| Test | Tool | Phase |
| --- | --- | --- |
| Automated axe scan on every page | Playwright + axe | VS-0 onward |
| Keyboard-only walkthrough of every journey | Manual + scripted | VS-3 onward |
| Screen reader walkthrough (NVDA, VoiceOver, TalkBack) | Manual | VS-6 onward |
| Contrast verification on design tokens | Automated | VS-0 |
| Touch target size check | Automated axe rule | VS-0 |
| Focus management verification | Automated + manual | VS-3 onward |
| Reduced-motion verification | Automated | VS-0 |
| Live region announcement verification | Manual | VS-3 onward |

**Zero critical violations is the CI gate.** See [TESTING.md](TESTING.md).

---

## 13. Known limitations

| Limitation | Position |
| --- | --- |
| No live captions for media | Disclosed; would require capturing media |
| Screen reader support for WebRTC media is browser-dependent | We control the controls, not the media element semantics |
| Older browsers | The Tailwind v4 floor (Safari 16.4+, Chrome 111+, Firefox 128+) limits the oldest supported browser |
| Very small viewports | 320 px is supported but the video PiP becomes cramped; landscape is recommended |

---

## 14. Implementation status

No accessibility tests exist yet. Component shells are in
[src/shared/ui/](src/shared/ui/). Tracked as **T-A11Y-121** in [TASKS.md](TASKS.md).
