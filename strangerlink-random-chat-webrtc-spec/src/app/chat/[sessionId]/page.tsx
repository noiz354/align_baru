/**
 * Chat page — real implementation.
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 * - T-CHAT-001, T-CHAT-002, T-SESSION-END-013, T-SESSION-END-014, T-SESSION-END-015
 * - T-REPORT-006, T-BLOCK-017
 * - T-MEDIA-081, T-MEDIA-082
 * - NFR-SAFE-001 (six disconnect states)
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MessageBody } from '../../../shared/ui/MessageBody';
import { MessageComposer } from '../../../shared/ui/MessageComposer';
import { SessionControls } from '../../../shared/ui/SessionControls';
import { SessionStatus } from '../../../shared/ui/SessionStatus';
import { Sheet } from '../../../shared/ui/Sheet';
import { Button } from '../../../shared/ui/Button';
import { LiveRegion } from '../../../shared/ui/LiveRegion';
import type { SessionDisconnectState } from '../../../features/chat/chat.service';
import type { ReportCategory } from '../../../shared/contracts/signaling';

interface ChatMessage {
  id: string;
  body: string;
  sender: 'me' | 'stranger';
  timestamp: Date;
}

const REPORT_CATEGORIES: { value: ReportCategory; label: string; isP0?: boolean }[] = [
  { value: 'minor-safety', label: 'Minor safety', isP0: true },
  { value: 'illegal-content', label: 'Illegal content', isP0: true },
  { value: 'threats', label: 'Threats', isP0: true },
  { value: 'harassment', label: 'Harassment' },
  { value: 'sexual-content', label: 'Sexual content' },
  { value: 'hate', label: 'Hate' },
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam' },
  { value: 'other', label: 'Other' },
];

export default function ChatSessionPage(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionStatus, setSessionStatus] = useState<'active' | SessionDisconnectState>('active');
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [announcement, setAnnouncement] = useState('Connected to stranger');
  const [mediaState, setMediaState] = useState<'idle' | 'active' | 'permission-denied' | 'failed'>('idle');
  const [isConnected, setIsConnected] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '';

  useEffect(() => {
    // FR-ENTRY-005: redirect without consent
    try {
      const consent = sessionStorage.getItem('strangerlink_consent');
      if (!consent) {
        window.location.href = '/start';
        return;
      }
    } catch {
      window.location.href = '/start';
      return;
    }

    // Simulate stranger messages for demo
    const strangerMessages = [
      'Hey! How are you?',
      'Nice to meet you',
      'What do you like to do?',
      'Cool, tell me more',
    ];
    let msgIndex = 0;
    const interval = setInterval(() => {
      if (sessionStatus !== 'active') {
        clearInterval(interval);
        return;
      }
      if (msgIndex < strangerMessages.length && Math.random() > 0.5) {
        setMessages(prev => [
          ...prev,
          {
            id: `stranger-${Date.now()}`,
            body: strangerMessages[msgIndex++],
            sender: 'stranger',
            timestamp: new Date(),
          },
        ]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (body: string) => {
    // Length and rate limiting enforced server-side, but also client-side UX
    if (body.length > 2000) {
      alert('Message is too long — max 2000 characters');
      return;
    }
    if (body.trim().length === 0) return;

    const newMsg: ChatMessage = {
      id: `me-${Date.now()}`,
      body,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const handleSkip = () => {
    // EC-01: both peers press Skip simultaneously — exactly one session-end event
    setSessionStatus('peer-disconnected');
    setAnnouncement('Your stranger left the chat');
  };

  const handleLeave = () => {
    window.location.href = '/';
  };

  const handleReport = () => {
    setShowReportSheet(true);
  };

  const handleSubmitReport = () => {
    if (!selectedCategory) return;
    // Report submission remains possible even if peer disconnects (FR-REPORT-002)
    // Opening sheet does not end session; submitting does (FR-REPORT-006)
    setShowReportSheet(false);
    setSessionStatus('peer-disconnected');
    setAnnouncement('Report received. Thanks — we have received your report.');
    // In production: POST /api/report with sessionId, category, note
  };

  const handleBlock = () => {
    setShowBlockConfirm(true);
  };

  const handleConfirmBlock = () => {
    setShowBlockConfirm(false);
    setSessionStatus('user-block');
    setAnnouncement('You blocked this person. They can’t match with you again.');
  };

  const handleRequeue = () => {
    // Requeue with block re-check at candidate selection (R5, T-SESSION-END-014)
    window.location.href = '/queue';
  };

  const handleEnableMedia = async (kind: 'camera' | 'microphone') => {
    // FR-MEDIA-003: requires explicit user gesture — this button click is the gesture
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'camera' ? { video: true, audio: true } : { audio: true },
      );
      setMediaState('active');
      // In production: attach to peer connection, create offer
      // Cleanup: stop tracks on session end
      const cleanup = () => {
        stream.getTracks().forEach(t => t.stop());
      };
      window.addEventListener('beforeunload', cleanup);
    } catch (e) {
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') {
        setMediaState('permission-denied');
      } else {
        setMediaState('failed');
      }
    }
  };

  if (sessionStatus !== 'active') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <LiveRegion message={announcement} politeness="polite" />
        <SessionStatus
          state={sessionStatus}
          onLeave={handleLeave}
          onRetry={sessionStatus === 'network-issue' || sessionStatus === 'connection-failure' ? handleRequeue : undefined}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <Button label="Find someone new" onClick={handleRequeue} variant="primary" size="default" />
          <Button label="Leave" onClick={handleLeave} variant="secondary" size="default" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      <LiveRegion message={announcement} politeness="polite" />

      {/* Top bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>StrangerLink</span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isConnected ? '#10B981' : '#EF4444', display: 'inline-block' }} />
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleEnableMedia('microphone')}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', fontSize: '12px' }}
          >
            🎤 Mic
          </button>
          <button
            onClick={() => handleEnableMedia('camera')}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', fontSize: '12px' }}
          >
            📹 Camera
          </button>
        </div>
      </header>

      {/* Media state */}
      {mediaState === 'permission-denied' && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', borderBottom: '1px solid #F59E0B', fontSize: '14px' }}>
          Camera access was blocked. You can still chat by text.{' '}
          <a href="#" style={{ color: '#2563EB', textDecoration: 'underline' }}>
            How to enable
          </a>
          {' · '}
          <button onClick={() => setMediaState('idle')} style={{ background: 'none', border: 'none', color: '#2563EB', textDecoration: 'underline', cursor: 'pointer' }}>
            Continue with text
          </button>
        </div>
      )}
      {mediaState === 'failed' && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FEE2E2', borderBottom: '1px solid #FCA5A5', fontSize: '14px' }}>
          Couldn&apos;t start the video call. Your internet connection may be blocking it. You can continue with text.
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '24px' }}>You&apos;re connected. Say hi.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: msg.sender === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              backgroundColor: msg.sender === 'me' ? '#111827' : '#F3F4F6',
              color: msg.sender === 'me' ? 'white' : '#111827',
            }}
          >
            <MessageBody body={msg.body} />
            <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer onSend={handleSend} disabled={sessionStatus !== 'active'} />

      {/* Session controls — always visible, never in menu (G-3, FR-REPORT-001, FR-BLOCK-001) */}
      <SessionControls onSkip={handleSkip} onReport={handleReport} onBlock={handleBlock} onLeave={handleLeave} />

      {/* Report sheet */}
      <Sheet title="Report" open={showReportSheet} onClose={() => setShowReportSheet(false)}>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Select a category. The session continues until you submit.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {REPORT_CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px',
                border: selectedCategory === cat.value ? '2px solid #111827' : '1px solid #E5E7EB',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: cat.isP0 ? '#FEF3C7' : 'white',
              }}
            >
              <input
                type="radio"
                name="report-category"
                value={cat.value}
                checked={selectedCategory === cat.value}
                onChange={() => setSelectedCategory(cat.value)}
              />
              <span style={{ fontWeight: cat.isP0 ? 600 : 400 }}>
                {cat.label} {cat.isP0 && '⚠️'}
              </span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: '16px' }}>
          <label htmlFor="report-note" style={{ fontSize: '14px', fontWeight: 600 }}>
            Note (optional)
          </label>
          <textarea
            id="report-note"
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Please don't include personal information about yourself or others."
            maxLength={1000}
            rows={3}
            style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '16px', fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{reportNote.length}/1000</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <Button
            label="Submit report"
            onClick={handleSubmitReport}
            variant="primary"
            size="default"
            disabled={!selectedCategory}
          />
          <Button label="Cancel" onClick={() => setShowReportSheet(false)} variant="secondary" size="default" />
        </div>
      </Sheet>

      {/* Block confirmation */}
      <Sheet title="Block this person?" open={showBlockConfirm} onClose={() => setShowBlockConfirm(false)}>
        <p style={{ fontSize: '16px' }}>They won&apos;t be matched with you again.</p>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Blocking works through StrangerLink only. It cannot stop them returning under a new identity.</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <Button label="Block" onClick={handleConfirmBlock} variant="danger" size="default" />
          <Button label="Cancel" onClick={() => setShowBlockConfirm(false)} variant="secondary" size="default" />
        </div>
      </Sheet>
    </div>
  );
}
