/**
 * Moderation notice component shell.
 *
 * Requirements:
 * - NFR-SAFE-002 (never disclose confidential moderation reasoning)
 *
 * See:
 * - DESIGN.md §15
 * - MODERATION.md §5
 * - SIGNALING.md §3.4
 *
 * COMPONENT SHELL ONLY.
 */

export interface ModerationNoticeProps {
  noticeClass: 'warning' | 'disconnected' | 'restricted' | 'banned';
  canReport: boolean;
  onReport: () => void;
}

/**
 * The fixed allowlist of moderation copy.
 *
 * CRITICAL (NFR-SAFE-002): these strings are the ONLY permitted moderation
 * copy. They must never contain the triggering rule, the signal, the actor
 * type, or any detail that would help an abuser calibrate. Adding a string
 * to this allowlist requires a Trust & Safety review.
 */
export const MODERATION_COPY = {
  warning: 'Please keep the conversation respectful.',
  disconnected:
    'This chat was ended by moderation. If you believe this is a mistake, you can report it.',
  restricted: 'You can’t start new chats right now.',
  banned: 'You can’t use this service right now.',
} as const;

/**
 * TODO(T-SAFE-052): implement the moderation notice.
 *
 * When implemented it must:
 * - render copy selected from MODERATION_COPY only
 * - always offer Report — a user can always challenge an enforcement decision
 * - never render a rule citation, a signal name, or an actor type
 */
export function ModerationNotice(_props: ModerationNoticeProps): React.JSX.Element {
  throw new Error('Not implemented: T-SAFE-052 (ModerationNotice shell)');
}
