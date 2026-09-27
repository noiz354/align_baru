/**
 * Text field — real implementation.
 */

import React from 'react';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  counterThreshold?: number;
  multiline?: boolean;
  placeholder?: string;
  id?: string;
}

export function TextField(props: TextFieldProps): React.JSX.Element {
  const { label, value, onChange, maxLength, counterThreshold = 800, multiline, placeholder, id } = props;
  const fieldId = id || `textfield-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const showCounter = maxLength && value.length >= counterThreshold;
  const overLimit = maxLength ? value.length > maxLength : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label htmlFor={fieldId} style={{ fontSize: '14px', fontWeight: 600 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: overLimit ? '2px solid #DC2626' : '1px solid #D1D5DB',
            fontSize: '16px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
          aria-describedby={showCounter ? `${fieldId}-counter` : undefined}
          aria-invalid={overLimit}
        />
      ) : (
        <input
          type="text"
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: overLimit ? '2px solid #DC2626' : '1px solid #D1D5DB',
            fontSize: '16px',
            fontFamily: 'inherit',
          }}
          aria-describedby={showCounter ? `${fieldId}-counter` : undefined}
          aria-invalid={overLimit}
        />
      )}
      {showCounter && maxLength && (
        <span id={`${fieldId}-counter`} style={{ fontSize: '12px', color: overLimit ? '#DC2626' : '#6B7280' }}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}
