# StrangerLink — Page Inventory

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DESIGN.md](../../DESIGN.md), [docs/design/COMPONENTS.md](COMPONENTS.md)

> **Route shells only.** No page is implemented. Each entry below is a specification for a
> route that will be built in a future vertical slice.

---

## 1. Public pages

### `/` — Landing

| Property | Value |
| --- | --- |
| **Purpose** | Explain the product in five seconds and route to `/start` |
| **Auth** | None |
| **Slice** | VS-0 |
| **Primary action** | **Start chatting** → `/start` |
| **Content** | Product name, one-line description, three value points, 18+ statement, links to Safety and Privacy |
| **Must not** | Open a camera, request a permission, join a queue, or autoplay media |
| **States** | Default; previously-consented (CTA becomes **Continue**); reduced motion |
| **A11y** | Single `h1`; CTA is the first tab stop; skip link |

### `/start` — Age gate, consent, safety notice, mode selection

| Property | Value |
| --- | --- |
| **Purpose** | Satisfy FR-ENTRY-001 … FR-ENTRY-010 |
| **Auth** | None; consent is presented, not a credential |
| **Slice** | VS-1 |
| **Sections** | Age gate (two unchecked checkboxes) → safety notice → mode selection → optional interests → **Find a stranger** |
| **Must not** | Pre-check a box; hide the disclaimer; claim to verify age |
| **States** | Gate unsatisfied; gate satisfied; mode disabled by kill switch; cooldown active |
| **A11y** | Real checkboxes with labels; Continue genuinely disabled; focus moves to the first error |

### `/queue` — Waiting state

| Property | Value |
| --- | --- |
| **Purpose** | Make waiting bounded and leaving trivial |
| **Auth** | Consent required; redirects to `/start` without it |
| **Slice** | VS-2 |
| **Primary actions** | **Cancel**; secondary **Leave** |
| **Content** | Elapsed wait time; honest explanation; interest-preference note |
| **States** | Waiting; queue timeout (retry or exit); cooldown; restricted |
| **A11y** | Elapsed time announced at intervals, not every second; static indicator under reduced motion |

### `/chat/[sessionId]` — Active session

| Property | Value |
| --- | --- |
| **Purpose** | The conversation surface |
| **Auth** | Consent **and** session membership; re-checked server-side on every request |
| **Slice** | VS-3 (match), VS-4 (chat), VS-9/VS-10 (media) |
| **Layout** | Message list; composer; bottom bar with **Skip**, **Report**, **Block**, **Leave** |
| **Must not** | Display any peer identity; hide Report or Block; show read receipts or typing indicators |
| **States** | Connecting; active; peer left; connection failure; network issue; timeout; moderation disconnect; blocked; superseded; stale |
| **A11y** | Report reachable without traversing the message list; state changes announced; PiP is `aria-hidden` |

### `/report` — Report flow

| Property | Value |
| --- | --- |
| **Purpose** | Submit a safety report |
| **Auth** | Consent required |
| **Slice** | VS-6 |
| **Entry** | From an active session, and from the post-session state |
| **Behaviour** | Opening does **not** end the session; submitting does |
| **Content** | Category radio group; optional note with a "don't include personal information" hint |
| **States** | Category unselected; submitting; submitted; duplicate; rate limited |
| **A11y** | Focus moves to the sheet and returns on close; Escape closes; category is a real radio group |

### `/safety` — Safety centre

| Property | Value |
| --- | --- |
| **Purpose** | Explain what is moderated, what happens on report, and the limits |
| **Auth** | None |
| **Slice** | VS-0 (static), VS-7 (enforcement detail) |
| **Content** | The eight limitations from [SAFETY.md](../../SAFETY.md) §1, in plain language |
| **Must not** | Claim perfect moderation; claim verified ages; claim complete anonymity |
| **A11y** | Logical heading hierarchy; plain language |

### `/privacy` — Privacy notice

| Property | Value |
| --- | --- |
| **Purpose** | Disclose data practices, including the IP-exposure residual risk |
| **Auth** | None |
| **Slice** | VS-0 |
| **Content** | Data inventory; retention schedule; cookie policy; the IP-exposure disclosure |
| **Must not** | Omit the IP-exposure disclosure; claim E2EE |
| **A11y** | Logical heading hierarchy |

### `/terms` — Terms of service

| Property | Value |
| --- | --- |
| **Purpose** | Terms of use |
| **Auth** | None |
| **Slice** | VS-0 |
| **Content** | Standard terms, reviewed by counsel |
| **A11y** | Logical heading hierarchy |

### `/settings` — Local settings

| Property | Value |
| --- | --- |
| **Purpose** | Client-side preferences and safety state |
| **Auth** | None (no accounts exist) |
| **Slice** | VS-6 |
| **Content** | Consent status and version; block list; reduced-motion preference; links to Safety and Privacy |
| **Must not** | Imply a server-side profile; offer account settings |
| **States** | Storage unavailable (degrades gracefully) |

---

## 2. Admin pages — **NOT BUILT**

These are specified for completeness. They are **not** part of any current slice beyond
VS-7 and VS-12, and none exists.

### `/admin/moderation`

| Property | Value |
| --- | --- |
| **Purpose** | Moderation case queue |
| **Auth** | Individual admin account; MFA; role `moderator`+ |
| **Slice** | VS-12 |
| **Content** | Cases with severity, status, category, session metadata |
| **Must not** | Show chat content or media — neither exists |

### `/admin/reports`

| Property | Value |
| --- | --- |
| **Purpose** | Report search and triage |
| **Auth** | Role `moderator`+ |
| **Slice** | VS-12 |
| **Content** | Report detail with category, note, session metadata, reporter/peer identities |
| **Must not** | Show chat content; allow bulk export of personal data without an audited reason |

### `/admin/bans`

| Property | Value |
| --- | --- |
| **Purpose** | Ban management and appeals |
| **Auth** | Read: `moderator`. Issue/extend: `senior-moderator`. Revoke: `senior-moderator` |
| **Slice** | VS-7 (records), VS-12 (surface) |
| **Content** | Ban records, appeal queue, review schedule |
| **Must not** | Show IP addresses or device fingerprints in a ban record |

### `/admin/metrics`

| Property | Value |
| --- | --- |
| **Purpose** | Safety metrics |
| **Auth** | Role `moderator`+ |
| **Slice** | VS-14 |
| **Content** | Aggregate safety metrics only |
| **Must not** | Show chat content, report notes, or individual timelines |

---

## 3. Route → requirement map

| Route | Requirements |
| --- | --- |
| `/` | G-1, G-5 |
| `/start` | FR-ENTRY-001 … FR-ENTRY-010, FR-MEDIA-003 |
| `/queue` | FR-QUEUE-001 … FR-QUEUE-008, FR-SAFE-002 |
| `/chat/[sessionId]` | FR-CHAT-001 … FR-CHAT-009, FR-MEDIA-001 … FR-MEDIA-009, FR-REPORT-001, FR-BLOCK-001, NFR-SAFE-001 |
| `/report` | FR-REPORT-001 … FR-REPORT-010 |
| `/safety` | NFR-SAFE-003, FR-SAFE-007 |
| `/privacy` | NFR-PRIV-001 … NFR-PRIV-006 |
| `/terms` | — |
| `/settings` | FR-ENTRY-009, FR-BLOCK-004 |
| `/admin/*` | FR-MOD-001 … FR-MOD-008, NFR-SEC-008, NFR-OBS-001 |

---

## 4. Navigation rules

| Rule | Detail |
| --- | --- |
| No chat before consent | `/queue` and `/chat/[sessionId]` redirect to `/start` |
| Session URL is a capability | `uuidv7`, server-generated, plus a server-side membership check |
| Exit always reachable | Every page has a visible route to a clean exit |
| Admin is separate | No navigation link from public pages to `/admin/*` |
| Safety and Privacy always linked | From `/` and from `/settings`, never buried |

---

## 5. Implementation status

Route shells exist for `/`, `/start`, `/queue`, `/chat/[sessionId]`, and `/safety`. The
remaining routes are specified but not shelled. None is implemented.
