/**
 * Message composer — real implementation.
 */

import React, { useState, useRef } from 'react';

export interface MessageComposerProps {
  onSend: (body: string) => void;
  disabled: boolean;
}

export const MAX_MESSAGE_LENGTH = 2000;

export function MessageComposer(props: MessageComposerProps): React.JSX.Element {
  const { onSend, disabled } = props;
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const overLimit = value.length > MAX_MESSAGE_LENGTH;
  const empty = value.trim().length === 0;

  const handleSend = () => {
    if (empty || overLimit || disabled) return;
    onSend(value);
    setValue('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <label htmlFor="message-composer" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          Message
        </label>
        <textarea
          id="message-composer"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            minHeight: '44px',
            maxHeight: '120px',
            padding: '12px',
            borderRadius: '8px',
            border: overLimit ? '2px solid #DC2626' : '1px solid #D1D5DB',
            resize: 'none',
            fontSize: '16px',
            fontFamily: 'inherit',
          }}
          aria-describedby={overLimit ? 'char-counter-error' : 'char-counter'}
          aria-invalid={overLimit}
        />
        <button
          onClick={handleSend}
          disabled={disabled || empty || overLimit}
          style={{
            minWidth: '56px',
            minHeight: '44px',
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: disabled || empty || overLimit ? '#9CA3AF' : '#111827',
            color: 'white',
            border: 'none',
            cursor: disabled || empty || overLimit ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: overLimit ? '#DC2626' : '#6B7280' }}>
        <span id={overLimit ? 'char-counter-error' : 'char-counter'}>
          {overLimit ? `Message is too long (${value.length}/${MAX_MESSAGE_LENGTH})` : `${value.length}/${MAX_MESSAGE_LENGTH}`}
        </span>
        {overLimit && <span>Please shorten your message</span>}
      </div>
    </div>
  );
}
