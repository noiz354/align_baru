/**
 * Message body component shell.
 *
 * Requirements:
 * - FR-CHAT-005 (inert links)
 * - NFR-SEC-001 (XSS)
 *
 * See:
 * - CHAT.md §10
 * - DESIGN.md §10
 * - SECURITY.md §1
 *
 * COMPONENT SHELL ONLY.
 *
 * CRITICAL: this component renders message content. `dangerouslySetInnerHTML`
 * is banned repository-wide by a lint rule (SECURITY.md §1, AC-1).
 */

export interface MessageBodyProps {
  body: string;
}

/**
 * TODO(T-CHAT-001): implement the message body.
 *
 * When implemented it must:
 * - render the body as TEXT ONLY, using React's default escaping
 * - never call dangerouslySetInnerHTML (lint rule)
 * - render URLs as inert text with the scheme visible
 * - never auto-fetch, never render a preview, never resolve short links
 * - render punycode as Unicode so homographs are visible
 * - never render markdown
 */
export function MessageBody(_props: MessageBodyProps): React.JSX.Element {
  throw new Error('Not implemented: T-CHAT-001 (MessageBody component shell)');
}
