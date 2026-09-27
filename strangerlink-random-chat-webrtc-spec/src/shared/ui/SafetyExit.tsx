/**
 * Safety exit — real implementation.
 */

import React from 'react';

export interface SafetyExitProps {
  onExit: () => void;
  label?: string;
}

export function SafetyExit(props: SafetyExitProps): React.JSX.Element {
  const { onExit, label = 'Exit' } = props;

  return (
    <button
      onClick={onExit}
      aria-label="Safety exit — leave immediately"
      style={{
        minWidth: '56px',
        minHeight: '44px',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: '#F3F4F6',
        color: '#111827',
        border: '1px solid #D1D5DB',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '14px',
      }}
    >
      {label}
    </button>
  );
}
