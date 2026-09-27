/**
 * Session controls — real implementation.
 *
 * Requirements:
 * - FR-REPORT-001, FR-BLOCK-001, FR-CHAT-009
 * - T-SESSION-END-013
 * - Always visible, keyboard reachable without traversing message list
 */

import React from 'react';

export interface SessionControlsProps {
  onSkip: () => void;
  onReport: () => void;
  onBlock: () => void;
  onLeave: () => void;
}

export function SessionControls(props: SessionControlsProps): React.JSX.Element {
  const { onSkip, onReport, onBlock, onLeave } = props;

  const buttonStyle: React.CSSProperties = {
    minWidth: '56px',
    minHeight: '56px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    flex: 1,
  };

  return (
    <div
      role="toolbar"
      aria-label="Session controls"
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px',
        borderTop: '1px solid #E5E7EB',
        backgroundColor: 'white',
      }}
    >
      <button
        onClick={onSkip}
        style={{ ...buttonStyle, backgroundColor: '#F3F4F6', color: '#111827' }}
        aria-label="Skip to next stranger"
        tabIndex={0}
      >
        Skip
      </button>
      <button
        onClick={onReport}
        style={{ ...buttonStyle, backgroundColor: '#FEF3C7', color: '#92400E' }}
        aria-label="Report this stranger"
        tabIndex={0}
      >
        Report
      </button>
      <button
        onClick={onBlock}
        style={{ ...buttonStyle, backgroundColor: '#FEE2E2', color: '#991B1B' }}
        aria-label="Block this stranger"
        tabIndex={0}
      >
        Block
      </button>
      <button
        onClick={onLeave}
        style={{ ...buttonStyle, backgroundColor: '#111827', color: 'white' }}
        aria-label="Leave chat"
        tabIndex={0}
      >
        Leave
      </button>
    </div>
  );
}
