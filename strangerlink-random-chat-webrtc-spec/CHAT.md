# StrangerLink — Text Chat Specification

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [SIGNALING.md](SIGNALING.md), [docs/realtime/FAILURE-MODEL.md](docs/realtime/FAILURE-MODEL.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md)

---

## 1. Position

**Text chat is the product.** Audio and video are optional additions. The text path must
be the most reliable thing in the system, because it is the only thing that works on a bad
network, an old phone, and a restrictive firewall.

**MVP recommendation: text only, no file uploads.** Justification below.

---

## 2. Ephemerality

| Property | Commitment |
| --- | --- |
| Durability | **None.** Messages are never written to a database, a log, or an object store |
| Lifetime | In-memory, for the duration of the session only |
| On session end | Messages are dropped with the session |
| Server retention | None (ADR-013 Tier 0) |
| Moderator visibility | None — there is nothing to see (ADR-010) |

This is a deliberate product decision with real costs, chiefly that a moderator cannot
reconstruct a conversation when investigating a report. It is accepted. Storing random
strangers' conversations is the largest privacy and liability risk available to this
product, and it buys us very little.

---

## 3. Ordering

- Each session maintains **two monotonic sequence numbers**, one per direction.
- A message carries `sequence` in its envelope (ADR-004).
- The receiver renders in `sequence` order, not arrival order.
- Out-of-order messages are buffered in a small window (bounded, e.g. 16) and then
  rejected with `MESSAGE_REJECTED`.
- Sequence numbers are per-session, so they restart at zero for every new session and
  carry no meaning across sessions.

---

## 4. Delivery status

| Status | Meaning | UI |
| --- | --- | --- |
| `pending` | Sent locally, not yet acknowledged by the server | Subtle indicator |
| `delivered` | Acknowledged by the server and relayed to the peer | No indicator |
| `rejected` | Rejected with a reason class | Visible message |

**What we do not do:**

- No read receipts. "Seen" in a stranger chat is a pressure mechanic.
- No typing indicators. They leak behavioural data and add noise.
- No delivery guarantees beyond the session. If the peer is gone, the message is gone.

### Rejection reason classes

| Reason class | Cause | User-visible? |
| --- | --- | --- |
| `too-long` | Over the length limit | Yes — "Message is too long" |
| `rate-limited` | Over the per-session message rate | Yes — "Slow down a moment" |
| `empty` | Whitespace only | No — the send button is disabled |
| `not-in-session` | Session no longer active | Yes — "This chat has ended" |
| `protocol-error` | Envelope invalid | No — connection closed |

---

## 5. Reconnect behaviour

The signaling plane may drop and reconnect. Chat must survive it where possible.

| Scenario | Behaviour |
| --- | --- |
| Disconnect during an active session | The session is **not** immediately ended. A bounded reconnect window applies |
| Reconnect within the window | The client resumes; the server re-sends the current sequence position; the client re-renders from its local buffer |
| Reconnect window expires | `ACTIVE → FAILED`, reason `transport-lost`. The user is told the connection was lost |
| Reconnect to a session that has ended | Rejected; the user is returned to a clean entry state (EC-08) |
| Reconnect to a session owned by another tab | Rejected; the older tab receives `SESSION_SUPERSEDED` (R8) |

**Messages sent while disconnected are not queued for later delivery.** A stranger chat
does not need store-and-forward semantics, and queueing would mean holding message content
in memory longer than the session. The user is told the message was not delivered.

---

## 6. Disconnect handling

| Situation | What the peer sees | What the local user sees |
| --- | --- | --- |
| Peer closes the tab | "Your stranger left the chat." | Nothing — they left |
| Peer's network drops and does not recover | "Your stranger left the chat." after the reconnect window | — |
| Peer skips | "Your stranger left the chat." | Post-session screen with New match / Leave |
| Peer reports | "This chat has ended." (no mention of a report) | Report confirmation |
| Peer blocks | "This chat has ended." | Block confirmation |
| Session times out | "This chat ended because it ran too long." | Same |
| Moderation ends it | "This chat was ended by moderation." | Same |

See [DESIGN.md](DESIGN.md) §12 — these six states must never be collapsed.

---

## 7. Message size and rate limits

| Limit | Value | Rationale |
| --- | --- | --- |
| Maximum message length | **2000 characters** | Fits a paragraph; blocks paste-flooding |
| Maximum messages per session | 300 | Blocks flooding; generous for a stranger chat |
| Maximum messages per 10 seconds | 10 | Blocks flooding; a human types slower |
| Maximum concurrent sessions per participant | 1 | INV-1 |
| Maximum session duration | 30 minutes | Bounded exposure for both parties |

All limits are enforced **server-side**. Client-side limits are a UX affordance only
(NFR-SEC-001).

---

## 8. Spam limits

Beyond the rate limits above:

- Identical message content sent more than 3 times in a row is rejected as `spam`.
- A message consisting only of a URL is allowed but rendered inert; a burst of
  URL-only messages from one participant raises a spam signal.
- Rapid-fire single-character messages raise a spam signal.
- Spam signals feed the behavioral abuse inputs in [MODERATION.md](MODERATION.md).

---

## 9. Abusive content handling

| Situation | Immediate behaviour |
| --- | --- |
| Peer sends harassment | The user reports; session ends; moderation case created |
| Peer sends a minor-safety concern | P0 escalation; session ends immediately (FR-REPORT-010) |
| Peer sends illegal content | P0 escalation; session ends; preservation per [SAFETY.md](SAFETY.md) |
| Peer sends threats | P0 escalation; session ends |
| Peer sends self-harm content | Escalation per [SAFETY.md](SAFETY.md) §self-harm |

**We do not run automated content classification on messages.** The reasons are in
ADR-010: it requires reading all content, which is a privacy cost we are not willing to
pay, and the false-positive rate on the users we most want to keep is unacceptable.

---

## 10. URL and link handling

| Rule | Detail |
| --- | --- |
| Links are inert by default | Displayed as plain text with the scheme visible |
| No auto-fetch | The client never requests a URL found in a message |
| No link previews | Nothing is fetched, so there is nothing to preview |
| Explicit open | The user taps "Open link"; it opens in a new tab with `rel="noopener noreferrer"` |
| No URL shortener resolution | We do not expand short links |
| Punycode / IDN display | Rendered with the Unicode form where the browser supports it, so homograph attacks are visible |

The threat model entry for malicious links is in [THREAT_MODEL.md](THREAT_MODEL.md).

---

## 11. Attachments

**Not supported.** There is no file input, no paste-handling for images, no drag-and-drop,
and no clipboard image path in the chat surface.

| Attempted vector | Behaviour |
| --- | --- |
| Pasting an image into the input | Ignored; the input is a text field |
| Dragging a file onto the chat | Ignored |
| Any file input element | Does not exist |

**Justification:** attachments are the primary vector for CSAM and other illegal content
in anonymous chat products. Without a durable, reviewable evidence and retention story,
and without server-side scanning, attachments are an unacceptable risk. If they are ever
added, they require a new ADR, a moderation architecture rewrite, and a legal review.

---

## 12. Rendering and injection safety

- Message content is rendered as **text only**. No HTML rendering, no markdown, no
  emoji shortcodes, no custom emoji.
- React's default escaping is the first line of defence; we additionally treat message
  content as untrusted at every boundary.
- No `dangerouslySetInnerHTML` anywhere in the chat surface. This is a lint rule.
- Long unbroken strings are wrapped; they cannot break layout.
- Zero-width and bidirectional-control characters are stripped on render.

---

## 13. Concurrency hazards specific to chat

| # | Hazard | Resolution |
| --- | --- | --- |
| C1 | Two messages arrive with the same sequence number | First wins; second is dropped as a duplicate |
| C2 | Sequence gap that never fills | After the buffer window, render what we have and mark the gap |
| C3 | Message sent as the session ends | Rejected with `not-in-session`; the user sees "This chat has ended" |
| C4 | Reconnect delivers a stale sequence position | The server's position is authoritative |
| C5 | Both peers send simultaneously | Independent per-direction sequences; no ordering conflict |
| C6 | Peer's socket dies between send and relay | The message is dropped; the peer sees "Your stranger left" |

---

## 14. Implementation status

The message contract exists in [src/shared/contracts/](src/shared/contracts/) and
[src/features/chat/](src/features/chat/). No send, receive, relay, or rate-limit logic is
implemented. Tracked as **T-CHAT-001** in [TASKS.md](TASKS.md).
