/**
 * Landing page — real implementation.
 *
 * Requirements:
 * - G-1 (first-time user can complete full journey)
 * - DESIGN.md §3
 * - T-A11Y-121
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '../shared/ui/Button';

export default function LandingPage(): React.JSX.Element {
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    try {
      const consent = sessionStorage.getItem('strangerlink_consent');
      if (consent) setHasConsented(true);
    } catch {
      // Storage unavailable — degrade gracefully (EC-23)
    }
  }, []);

  const handleStart = () => {
    window.location.href = hasConsented ? '/queue' : '/start';
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '24px 0' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>StrangerLink</h1>
        <p style={{ fontSize: '18px', color: '#6B7280', margin: '8px 0 0 0' }}>
          Talk to a stranger. Text, audio, or video. No account needed.
        </p>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
            <span style={{ fontSize: '16px' }}>No sign-up required</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '24px' }}>⏭️</span>
            <span style={{ fontSize: '16px' }}>Skip anytime with one tap</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <span style={{ fontSize: '16px' }}>Report and block built in</span>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <Button
            label={hasConsented ? 'Continue' : 'Start chatting'}
            onClick={handleStart}
            variant="primary"
            size="critical"
          />
        </div>

        <div style={{ fontSize: '14px', color: '#6B7280' }}>
          <p>18+ only. Conversations are not screened in real time.</p>
          <p>
            <a href="/safety" style={{ color: '#2563EB', textDecoration: 'underline' }}>
              Safety information
            </a>
            {' · '}
            <a href="/privacy" style={{ color: '#2563EB', textDecoration: 'underline' }}>
              Privacy
            </a>
          </p>
        </div>
      </div>

      <footer style={{ padding: '24px 0', borderTop: '1px solid #E5E7EB', fontSize: '12px', color: '#9CA3AF' }}>
        <p>StrangerLink — ephemeral chat, no message storage, safety first.</p>
      </footer>
    </div>
  );
}
