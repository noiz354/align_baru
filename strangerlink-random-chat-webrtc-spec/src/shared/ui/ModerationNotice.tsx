/**
 * Moderation notice — real implementation.
 */

import React from 'react';

export interface ModerationNoticeProps {
  noticeClass: 'warning' | 'disconnected' | 'restricted' | 'banned';
  canReport: boolean;
  onReport: () => void;
}

export const MODERATION_COPY = {
  warning: 'Please keep the conversation respectful.',
  disconnected: 'This chat was ended by moderation. If you believe this is a mistake, you can report it.',
  restricted: 'You can’t start new chats right now.',
  banned: 'You can’t use this service right now.',
} as const;

export function ModerationNotice(props: ModerationNoticeProps): React.JSX.Element {
  const { noticeClass, canReport, onReport } = props;
  const message = MODERATION_COPY[noticeClass];

  return (
    <div
      role="alert"
      style={{
        padding: '16px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #F59E0B',
        borderRadius: '8px',
        margin: '16px',
      }}
    >
      <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.5' }}>{message}</p>
      {canReport && (
        <button
          onClick={onReport}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #D1D5DB',
            background: 'white',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Report a problem
        </button>
      )}
    </div>
  );
}
