/**
 * Message composer component shell.
 *
 * Requirements:
 * - FR-CHAT-003 (message length)
 * - FR-CHAT-006 (no attachments)
 *
 * See:
 * - CHAT.md §11
 * - ACCESSIBILITY.md §2
 *
 * COMPONENT SHELL ONLY.
 *
 * FR-CHAT-006: attachments are NOT supported. There is no file input and no
 * image paste handler anywhere in this product.
 */

export interface MessageComposerProps {
  onSend: (body: string) => void;
  disabled: boolean;
}

/** FR-CHAT-003. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * TODO(T-CHAT-001): implement the composer.
 *
 * When implemented it must:
 * - render a plain text input with an associated label
 * - submit on Enter; Shift+Enter inserts a newline
 * - show a visible "Message is too long" — never silently truncate
 * - contain NO file input and NO image paste handler (FR-CHAT-006)
 * - announce the character counter only at the threshold
 */
export function MessageComposer(_props: MessageComposerProps): React.JSX.Element {
  throw new Error('Not implemented: T-CHAT-001 (MessageComposer component shell)');
}
