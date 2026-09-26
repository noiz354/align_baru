/**
 * Session status component shell.
 *
 * Requirements:
 * - NFR-SAFE-001 (six distinct disconnect states)
 * - NFR-SAFE-002 (no moderation reasoning)
 * - NFR-A11Y-005 (announce state changes)
 *
 * See:
 * - DESIGN.md §12
 * - ACCESSIBILITY.md §9
 * - docs/realtime/FAILURE-MODEL.md §4
 *
 * COMPONENT SHELL ONLY.
 */

import type { SessionDisconnectState } from '../../features/chat/chat.service';

export interface SessionStatusProps {
  state: SessionDisconnectState;
  onLeave: () => void;
  onRetry?: () => void;
}

/**
 * TODO(T-CHAT-002): implement the session status surface.
 *
 * When implemented it must:
 * - render the fixed copy for the state, from DISCONNECT_COPY
 * - NEVER collapse two states into one generic "disconnected"
 * - NEVER present a moderation disconnect as a network error
 * - NEVER disclose the rule, the signal, or the actor for a moderation
 *   disconnect (NFR-SAFE-002)
 * - always offer Leave, and Report a problem where applicable
 * - announce the state change through a polite live region (NFR-A11Y-005)
 */
export function SessionStatus(_props: SessionStatusProps): React.JSX.Element {
  throw new Error('Not implemented: T-CHAT-002 (SessionStatus component shell)');
}
