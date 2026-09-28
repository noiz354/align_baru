/**
 * Queue page — real implementation via WebSocket signaling.
 *
 * Requirements:
 * - FR-QUEUE-001 … FR-QUEUE-008
 * - T-QUEUE-011, T-QUEUE-012
 * - FR-ENTRY-005 (redirect without consent)
 * - ADR-003 (ws), ADR-004 (signaling), STATE_MACHINE.md
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { LiveRegion } from '../../shared/ui/LiveRegion';
import { createSignalingClient } from '../../features/signaling/signaling.client';

export default function QueuePage(): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<'checking' | 'waiting' | 'expired' | 'cooldown' | 'matched'>('checking');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [announcement, setAnnouncement] = useState('Looking for someone who wants to chat');
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<ReturnType<typeof createSignalingClient> | null>(null);
  const participantIdRef = useRef<string>('');

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

      if (elapsed > 120_000) {
        setStatus('expired');
        setAnnouncement('Nobody is available right now');
        if (intervalRef.current) clearInterval(intervalRef.current);
        // close ws if still waiting
        wsRef.current?.close().catch(()=>{});
      } else if (elapsed % 10000 < 1000) {
        setAnnouncement(`Waiting for ${Math.floor(elapsed / 1000)} seconds`);
      }
    }, 1000);

    // Real signaling: connect to realtime ws and JOIN_QUEUE
    let cancelled = false;
    (async () => {
      try {
        // participantId persisted per browser context
        let pid = sessionStorage.getItem('strangerlink_participantId');
        if (!pid) {
          pid = crypto.randomUUID();
          sessionStorage.setItem('strangerlink_participantId', pid);
        }
        participantIdRef.current = pid;

        const mode = (sessionStorage.getItem('strangerlink_mode') as any) || 'TEXT';
        const interestsRaw = sessionStorage.getItem('strangerlink_interests');
        let interestIds: string[] = [];
        try { interestIds = interestsRaw ? JSON.parse(interestsRaw) : []; } catch {}
        const language = sessionStorage.getItem('strangerlink_language') || null;
        const consentRaw = sessionStorage.getItem('strangerlink_consent');
        let consentVersion = 1;
        try { const c = consentRaw ? JSON.parse(consentRaw) : {}; consentVersion = c.consentVersion || 1; } catch {}

        // Derive realtime URL: ws://localhost:3001 or wss://3001-...e2b.app for preview
        function getRealtimeUrl(): string {
          if (typeof window === 'undefined') return 'ws://localhost:3001';
          const host = window.location.hostname;
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          if (host.includes('e2b.app')) {
            return `${protocol}//${host.replace(/^\d+-/, '3001-')}`;
          }
          // localhost:3105 -> localhost:3001
          return `${protocol}//${host}:3001`;
        }
        const wsUrl = (process.env.NEXT_PUBLIC_REALTIME_URL as string) || getRealtimeUrl();
        const client = createSignalingClient(wsUrl);
        wsRef.current = client;

        client.onMessage((msg: any) => {
          if (cancelled) return;
          if (msg.type === 'MATCH_FOUND') {
            const sessionId = msg.payload?.sessionId || msg.sessionId;
            if (!sessionId) return;
            try { sessionStorage.setItem('strangerlink_sessionId', sessionId); } catch {}
            // store peer role if needed
            try { sessionStorage.setItem('strangerlink_sessionRole', msg.payload?.peerRole || ''); } catch {}
            setStatus('matched');
            setAnnouncement('Match found! Connecting...');
            setTimeout(() => {
              if (!cancelled) window.location.href = `/chat/${sessionId}`;
            }, 600);
          } else if (msg.type === 'ERROR') {
            const code = msg.payload?.code;
            if (code === 'RATE_LIMITED' || code === 'RESTRICTED') {
              const retryMs = msg.payload?.retryAfterMs || 30000;
              const expiry = Date.now() + retryMs;
              try { sessionStorage.setItem('strangerlink_cooldown', expiry.toString()); } catch {}
              setStatus('cooldown');
              setCooldownRemaining(retryMs);
            } else if (code === 'QUEUE_CANCELLED' || msg.type === 'QUEUE_CANCELLED') {
              setStatus('expired');
              setAnnouncement('Queue cancelled');
            }
          } else if (msg.type === 'QUEUE_CANCELLED') {
            setStatus('expired');
            setAnnouncement('Queue cancelled');
          } else if (msg.type === 'SESSION_ENDED' || msg.type === 'PEER_LEFT') {
            // should not happen in queue, but handle
          }
        });

        client.onDisconnect((reason) => {
          if (cancelled) return;
          // if we were matched, we already navigated; if still waiting, show reconnecting briefly
          if (status !== 'matched' && status !== 'expired' && status !== 'cooldown') {
            setAnnouncement('Reconnecting…');
            // the client will auto-reconnect via its own backoff; we keep waiting
          }
        });

        await client.connect(pid);

        // Send JOIN_QUEUE
        const joinMsg: any = {
          type: 'JOIN_QUEUE',
          messageId: crypto.randomUUID(),
          sessionId: null,
          fromParticipantId: pid,
          sequence: 1,
          sentAt: new Date().toISOString(),
          payload: {
            mode,
            interestIds,
            language,
            regionConstraint: null,
            consentVersion,
          },
        };
        await client.send(joinMsg);
      } catch (e) {
        // If ws fails (e.g., server not running), we stay in waiting but surface that it's trying
        // Do not fallback to fake setTimeout match — that would be hallucinated evidence
        console.error('queue ws error', e);
        if (!cancelled) setAnnouncement('Connecting to matching service…');
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      // do not close ws on unmount if matched (navigation will handle), but close if still waiting and user leaves
      // For now, keep ws open until navigation or explicit cancel
    };
  }, []);

  const handleCancel = () => {
    try {
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
    // close ws and leave queue
    wsRef.current?.close().catch(()=>{});
    window.location.href = '/';
  };

  const handleRetry = () => {
    setStatus('waiting');
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setAnnouncement('Looking for someone who wants to chat');
    // reload to re-join queue via ws
    window.location.reload();
  };

  const handleLeave = () => {
    wsRef.current?.close().catch(()=>{});
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
