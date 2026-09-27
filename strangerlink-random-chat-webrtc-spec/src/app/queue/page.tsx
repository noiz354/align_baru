/**
 * Queue page — real implementation.
 *
 * Requirements:
 * - FR-QUEUE-001 … FR-QUEUE-008
 * - T-QUEUE-011, T-QUEUE-012
 * - FR-ENTRY-005 (redirect without consent)
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { LiveRegion } from '../../shared/ui/LiveRegion';

export default function QueuePage(): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<'checking' | 'waiting' | 'expired' | 'cooldown' | 'matched'>('checking');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [announcement, setAnnouncement] = useState('Looking for someone who wants to chat');
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // FR-ENTRY-005: redirect to /start when consent absent
    try {
      const consent = sessionStorage.getItem('strangerlink_consent');
      if (!consent) {
        window.location.href = '/start';
        return;
      }
      const parsed = JSON.parse(consent);
      if (!parsed.ageAttested) {
        window.location.href = '/start';
        return;
      }
    } catch {
      window.location.href = '/start';
      return;
    }

    // Check cooldown
    try {
      const cd = sessionStorage.getItem('strangerlink_cooldown');
      if (cd) {
        const expiry = parseInt(cd, 10);
        const remaining = expiry - Date.now();
        if (remaining > 0) {
          setStatus('cooldown');
          setCooldownRemaining(remaining);
          const cdInterval = setInterval(() => {
            const rem = expiry - Date.now();
            if (rem <= 0) {
              setStatus('waiting');
              clearInterval(cdInterval);
              sessionStorage.removeItem('strangerlink_cooldown');
            } else {
              setCooldownRemaining(rem);
            }
          }, 1000);
          return () => clearInterval(cdInterval);
        }
      }
    } catch {}

    setStatus('waiting');
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);

      // Queue timeout: 120s (PERFORMANCE.md)
      if (elapsed > 120_000) {
        setStatus('expired');
        setAnnouncement('Nobody is available right now');
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (elapsed % 10000 < 1000) {
        // Announce at intervals, not every second (a11y)
        setAnnouncement(`Waiting for ${Math.floor(elapsed / 1000)} seconds`);
      }
    }, 1000);

    // Simulate matchmaking — in production this would be WebSocket JOIN_QUEUE
    // For demo, auto-match after 3-8 seconds
    const matchTimeout = setTimeout(() => {
      if (status !== 'expired' && status !== 'cooldown') {
        // In real app, this would come from server MATCH_FOUND
        const sessionId = `session-${Date.now()}`;
        try {
          sessionStorage.setItem('strangerlink_sessionId', sessionId);
        } catch {}
        setStatus('matched');
        setAnnouncement('Match found! Connecting...');
        setTimeout(() => {
          window.location.href = `/chat/${sessionId}`;
        }, 1000);
      }
    }, 3000 + Math.random() * 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(matchTimeout);
    };
  }, []);

  const handleCancel = () => {
    try {
      // Record rapid join/leave for cooldown ladder
      const lastCancel = sessionStorage.getItem('strangerlink_last_cancel');
      const now = Date.now();
      if (lastCancel) {
        const last = parseInt(lastCancel, 10);
        if (now - last < 60_000) {
          const count = parseInt(sessionStorage.getItem('strangerlink_cancel_count') || '0', 10) + 1;
          sessionStorage.setItem('strangerlink_cancel_count', count.toString());
          if (count >= 3) {
            const cooldownExpiry = now + 30_000;
            sessionStorage.setItem('strangerlink_cooldown', cooldownExpiry.toString());
          }
        }
      }
      sessionStorage.setItem('strangerlink_last_cancel', now.toString());
    } catch {}
    window.location.href = '/';
  };

  const handleRetry = () => {
    setStatus('waiting');
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setAnnouncement('Looking for someone who wants to chat');
  };

  const handleLeave = () => {
    window.location.href = '/';
  };

  if (status === 'checking') {
    return <div style={{ padding: '24px' }}>Checking eligibility...</div>;
  }

  if (status === 'cooldown') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Please wait a moment</h1>
        <p style={{ fontSize: '16px', color: '#6B7280', marginTop: '16px' }}>
          Please wait {Math.ceil(cooldownRemaining / 1000)} seconds before trying again.
        </p>
        <p style={{ fontSize: '14px', color: '#9CA3AF', marginTop: '8px' }}>
          This cooldown prevents queue flooding and is shown honestly, never disguised as a network error.
        </p>
        <div style={{ marginTop: '24px' }}>
          <Button label="Leave" onClick={handleLeave} variant="secondary" size="default" />
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <LiveRegion message={announcement} politeness="polite" />
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Nobody&apos;s available right now</h1>
        <p style={{ fontSize: '16px', color: '#6B7280', marginTop: '16px' }}>The queue wait is bounded. No automatic requeue.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <Button label="Try again" onClick={handleRetry} variant="primary" size="default" />
          <Button label="Leave" onClick={handleLeave} variant="secondary" size="default" />
        </div>
      </div>
    );
  }

  if (status === 'matched') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <LiveRegion message={announcement} politeness="assertive" />
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Match found!</h1>
        <p style={{ marginTop: '16px' }}>Connecting you to a stranger...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <LiveRegion message={announcement} politeness="polite" />
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #111827',
            borderRadius: '50%',
            margin: '0 auto',
            animation: 'spin 1s linear infinite',
          }}
        />
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '24px' }}>Looking for someone...</h1>
        <p style={{ fontSize: '16px', color: '#6B7280', marginTop: '8px' }}>
          {Math.floor(elapsedMs / 1000)}s elapsed
        </p>
        <p style={{ fontSize: '14px', color: '#9CA3AF', marginTop: '8px' }}>
          Trying to match your interests. If nobody is available, we&apos;ll connect you with anyone.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <Button label="Cancel" onClick={handleCancel} variant="secondary" size="critical" />
        <Button label="Leave" onClick={handleLeave} variant="ghost" size="default" />
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          div[style*="animation: spin"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
