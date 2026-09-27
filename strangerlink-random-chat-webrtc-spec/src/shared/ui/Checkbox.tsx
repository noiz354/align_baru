/**
 * Checkbox component — real implementation.
 */

import React from 'react';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  describedBy?: string;
  disabled?: boolean;
  id?: string;
}

export function Checkbox(props: CheckboxProps): React.JSX.Element {
  const { label, checked, onChange, describedBy, disabled, id } = props;
  const checkboxId = id || `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '8px 0' }}>
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={describedBy}
        style={{ width: '20px', height: '20px', marginTop: '2px' }}
      />
      <label htmlFor={checkboxId} style={{ fontSize: '16px', lineHeight: '1.5', cursor: 'pointer' }}>
        {label}
      </label>
    </div>
  );
}
