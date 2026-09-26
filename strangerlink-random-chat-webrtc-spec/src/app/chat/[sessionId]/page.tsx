/**
 * Chat page — active session.
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 * - FR-REPORT-001 (report reachable)
 * - FR-BLOCK-001 (block reachable)
 * - FR-MEDIA-001 … FR-MEDIA-009
 * - NFR-SAFE-001 (six disconnect states)
 * - NFR-SEC-003 (unguessable identifiers)
 *
 * See:
 * - docs/design/PAGES.md §1
 * - DESIGN.md §8, §12
 *
 * ROUTE SHELL ONLY. This page is not implemented.
 *
 * FR-ENTRY-005: this route must redirect to /start when consent is absent.
 * NFR-SEC-001: session membership is re-checked server-side on every request.
 * The session id in the URL is a capability, not an authorization.
 */

export default function ChatSessionPage(): React.JSX.Element {
  // TODO(T-SESSION-004): render the session shell with no peer identity surface.
  // TODO(T-CHAT-001): message list ordered by sequence; no read receipts, no
  //                   typing indicators.
  // TODO(T-CHAT-002): distinguish all six disconnect states — never collapse them.
  // TODO(T-SESSION-END-013): Skip, Report, and Block always visible; never hidden.
  // TODO(T-MEDIA-081): lazy-load the media bundle; text-only users never
  //                    download WebRTC code.
  throw new Error('Not implemented: T-SESSION-004 (chat route shell)');
}
