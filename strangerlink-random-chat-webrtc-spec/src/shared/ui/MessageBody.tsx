/**
 * Message body — real implementation, XSS safe.
 *
 * Requirements:
 * - FR-CHAT-005 (inert links)
 * - NFR-SEC-001 (XSS)
 * - T-CHAT-001
 */

import React, { useState } from 'react';

export interface MessageBodyProps {
  body: string;
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function MessageBody(props: MessageBodyProps): React.JSX.Element {
  const { body } = props;
  const [showLink, setShowLink] = useState<Record<string, boolean>>({});

  // Split by URLs but render as inert text by default
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = body.split(urlRegex);

  return (
    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
      {parts.map((part, idx) => {
        if (isUrl(part)) {
          const visible = showLink[part];
          if (!visible) {
            return (
              <span key={idx} style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#6B7280', fontFamily: 'monospace', fontSize: '14px' }}>{part}</span>
                <button
                  onClick={() => setShowLink(prev => ({ ...prev, [part]: true }))}
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #D1D5DB',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Open link
                </button>
              </span>
            );
          } else {
            return (
              <a
                key={idx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563EB', textDecoration: 'underline' }}
              >
                {part}
              </a>
            );
          }
        }
        // React's default escaping prevents XSS — no dangerouslySetInnerHTML
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}
