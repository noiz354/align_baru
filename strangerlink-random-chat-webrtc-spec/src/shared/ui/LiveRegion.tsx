/**
 * Live region — real implementation.
 */

import React, { useEffect, useState, useRef } from 'react';

export interface LiveRegionProps {
  message: string;
  politeness: 'polite' | 'assertive';
}

export const ANNOUNCEMENT_DEBOUNCE_MS = 1000;

export function LiveRegion(props: LiveRegionProps): React.JSX.Element {
  const [currentMessage, setCurrentMessage] = useState(props.message);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrentMessage(props.message);
    }, ANNOUNCEMENT_DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [props.message]);

  return (
    <div
      aria-live={props.politeness}
      aria-atomic="true"
      role="status"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}
    >
      {currentMessage}
    </div>
  );
}
