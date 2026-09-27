/**
 * Session status — six distinct disconnect states.
 *
 * Requirements:
 * - NFR-SAFE-001 (six states never collapsed)
 * - NFR-SAFE-002 (no moderation reasoning)
 * - T-CHAT-002
 */

import React from 'react';
import type { SessionDisconnectState } from '../../features/chat/chat.service';
import { DISCONNECT_COPY } from '../../features/chat/chat.service';
import { LiveRegion } from './LiveRegion';

export interface SessionStatusProps {
  state: SessionDisconnectState;
  onLeave: () => void;
  onRetry?: () => void;
}

export function SessionStatus(props: SessionStatusProps): React.JSX.Element {
  const { state, onLeave, onRetry } = props;
  const copy = DISCONNECT_COPY[state];

  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <LiveRegion message={copy} politeness="polite" />
      <div
        role="status"
        style={{
          padding: '24px',
          backgroundColor: '#F9FAFB',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          marginBottom: '16px',
        }}
      >
        <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>
          {state === 'peer-disconnected' && 'Stranger left'}
          {state === 'connection-failure' && 'Connection failed'}
          {state === 'moderation-disconnect' && 'Ended by moderation'}
          {state === 'user-block' && 'Blocked'}
          {state === 'session-timeout' && 'Chat timed out'}
          {state === 'network-issue' && 'Connection lost'}
        </p>
        <p style={{ fontSize: '16px', color: '#6B7280', margin: 0 }}>{copy}</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              minWidth: '56px',
              minHeight: '44px',
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: '#111827',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        )}
        <button
          onClick={onLeave}
          style={{
            minWidth: '56px',
            minHeight: '44px',
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#E5E7EB',
            color: '#111827',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
