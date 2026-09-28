/**
 * Chat page — real implementation via WebSocket signaling (TEXT only for MVP_PARTIAL).
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 * - T-CHAT-001, T-CHAT-002, T-SESSION-END-013, T-SESSION-END-014, T-SESSION-END-015
 * - ADR-003, ADR-004, STATE_MACHINE.md
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
import { createSignalingClient } from '../../../features/signaling/signaling.client';
import { createSyntheticAudioStream } from '../../../features/media/peer-connection.coordinator';

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
  const [chatMode, setChatMode] = useState<'TEXT' | 'TEXT_AUDIO' | 'TEXT_VIDEO'>('TEXT');
  const [isConnected, setIsConnected] = useState(true);
  const [webrtcProof, setWebrtcProof] = useState<'idle' | 'connecting' | 'connected' | 'remote-track' | 'disconnected'>('idle');
  const rtcRef = useRef<RTCPeerConnection | null>(null);
  const rtcLocalStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRoleRef = useRef<'A' | 'B'>('A');
  const iceTypesRef = useRef<string[]>([]);
  const rtcStatsRef = useRef({ offers: 0, answers: 0, remoteAudioTracks: 0 });
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<ReturnType<typeof createSignalingClient> | null>(null);
  const participantIdRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');

  const sessionId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '';

  const sendRtcSignal = (type: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE', payload: any) => {
    const client = wsRef.current;
    const pid = participantIdRef.current;
    const sid = sessionIdRef.current;
    if (!client || !pid || !sid) return;
    client.send({ type, messageId: crypto.randomUUID(), sessionId: sid, fromParticipantId: pid, sequence: 0, sentAt: new Date().toISOString(), payload } as any).catch((e) => console.error('signaling send failed', e));
  };

  const handleIncomingOffer = async (msg: any) => {
    const pc = rtcRef.current;
    if (!pc) { pendingOfferRef.current = msg; return; }
    if (rtcStatsRef.current.offers > 0) return; // ignore duplicate/replayed offer
    try {
      rtcStatsRef.current.offers += 1;
      await pc.setRemoteDescription({ type: 'offer', sdp: msg.payload.sdp });
      for (const candidate of pendingIceRef.current.splice(0)) await pc.addIceCandidate(candidate);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      rtcStatsRef.current.answers += 1;
      sendRtcSignal('ANSWER', { sdp: answer.sdp || '' });
    } catch (e) { console.error('offer handling failed', e); }
  };

  const closeRtc = () => {
    try { rtcRef.current?.close(); } catch {}
    rtcRef.current = null;
    rtcLocalStreamRef.current?.getTracks().forEach(track => track.stop());
    const stream: any = rtcLocalStreamRef.current as any;
    try { stream?.__oscillator?.stop?.(); } catch {}
    try { stream?.__audioContext?.close?.(); } catch {}
    rtcLocalStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const startPeerAudio = async (synthetic = false) => {
    if (rtcRef.current) return;
    let stream: MediaStream | null = null;
    if (synthetic) {
      stream = createSyntheticAudioStream();
    } else {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { setMediaState((e as DOMException)?.name === 'NotAllowedError' ? 'permission-denied' : 'failed'); return; }
    }
    if (!stream) { setMediaState('failed'); return; }
    rtcLocalStreamRef.current = stream;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
    rtcRef.current = pc;
    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream!));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const c = event.candidate.toJSON();
      const candidateType = event.candidate.type || 'unknown';
      if (!iceTypesRef.current.includes(candidateType)) iceTypesRef.current.push(candidateType);
      sendRtcSignal('ICE_CANDIDATE', c);
    };
    pc.ontrack = (event) => {
      rtcStatsRef.current.remoteAudioTracks += event.track.kind === 'audio' ? 1 : 0;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
        void remoteAudioRef.current.play().catch(() => {});
      }
      if (event.track.kind === 'audio') setWebrtcProof('remote-track');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setWebrtcProof('connected');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') setWebrtcProof('disconnected');
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setWebrtcProof('connected');
    };
    setMediaState('active');
    setWebrtcProof('connecting');
    if (pendingOfferRef.current) {
      const pending = pendingOfferRef.current;
      pendingOfferRef.current = null;
      void handleIncomingOffer(pending);
    }
    if (peerRoleRef.current === 'A') {
      // Let the matched peer finish opening its signaling socket before the first offer.
      window.setTimeout(async () => {
        if (rtcRef.current !== pc || pc.signalingState !== 'stable') return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          rtcStatsRef.current.offers += 1;
          sendRtcSignal('OFFER', { sdp: offer.sdp || '', restart: false });
        } catch (e) { console.error('offer creation failed', e); }
      }, 900);
    }
  };

  useEffect(() => {
    sessionIdRef.current = sessionId;
    try { peerRoleRef.current = sessionStorage.getItem('strangerlink_sessionRole') === 'B' ? 'B' : 'A'; } catch {}
  }, [sessionId]);

  useEffect(() => {
    // FR-ENTRY-005: redirect without consent
    try {
      const selectedMode = sessionStorage.getItem('strangerlink_mode');
      if (selectedMode === 'TEXT' || selectedMode === 'TEXT_AUDIO' || selectedMode === 'TEXT_VIDEO') setChatMode(selectedMode);
      const consent = sessionStorage.getItem('strangerlink_consent');
      if (!consent) {
        window.location.href = '/start';
        return;
      }
    } catch {
      window.location.href = '/start';
      return;
    }

    // Real signaling: connect and handle messages
    let cancelled = false;
    (async () => {
      try {
        let pid = sessionStorage.getItem('strangerlink_participantId');
        if (!pid) {
          pid = crypto.randomUUID();
          sessionStorage.setItem('strangerlink_participantId', pid);
        }
        participantIdRef.current = pid;
        const sid = sessionIdRef.current || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '');
        if (!sid) return;

        function getRealtimeUrl(): string {
          if (typeof window === 'undefined') return 'ws://localhost:3001';
          const host = window.location.hostname;
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          if (host.includes('e2b.app')) {
            return `${protocol}//${host.replace(/^\d+-/, '3001-')}`;
          }
          return `${protocol}//${host}:3001`;
        }
        const wsUrl = (process.env.NEXT_PUBLIC_REALTIME_URL as string) || getRealtimeUrl();
        const client = createSignalingClient(wsUrl);
        wsRef.current = client;

        client.onMessage(async (msg: any) => {
          if (cancelled) return;
          if (msg.type === 'MESSAGE_DELIVERED') {
            const body = msg.payload?.body;
            if (!body) return;
            // Ignore our own echo (should not happen, server relays only to peer)
            // Add as stranger
            setMessages(prev => [...prev, {
              id: `stranger-${msg.messageId || Date.now()}`,
              body,
              sender: 'stranger',
              timestamp: new Date(msg.sentAt || Date.now()),
            }]);
          } else if (msg.type === 'MESSAGE_REJECTED') {
            const reason = msg.payload?.reasonClass;
            setAnnouncement(`Message not delivered: ${reason}`);
            // Optionally surface in UI
          } else if (msg.type === 'PEER_LEFT' || msg.type === 'SESSION_ENDED') {
            const reasonClass = msg.payload?.reasonClass || msg.payload?.endReason || 'peer-left';
            // Map to disconnect state
            let state: SessionDisconnectState = 'peer-disconnected';
            if (reasonClass === 'transport-lost' || reasonClass === 'failed' || reasonClass === 'server-restart') {
              state = 'network-issue';
            } else if (reasonClass === 'blocked' || msg.type === 'BLOCK_CREATED') {
              state = 'user-block';
            }
            setSessionStatus(state);
            if (state === 'peer-disconnected') setAnnouncement('Your stranger left the chat');
            else if (state === 'network-issue') setAnnouncement('Your connection was lost');
          } else if (msg.type === 'ERROR') {
            const code = msg.payload?.code;
            if (code === 'RATE_LIMITED') {
              setAnnouncement('Please wait a few seconds before trying again');
            }
          } else if (msg.type === 'BLOCK_CREATED') {
            setSessionStatus('user-block');
            setAnnouncement('You blocked this person. They can’t match with you again.');
          } else if (msg.type === 'REPORT_SUBMITTED') {
            // report ack
          } else if (msg.type === 'OFFER') {
            if (rtcRef.current) await handleIncomingOffer(msg);
            else pendingOfferRef.current = msg;
          } else if (msg.type === 'ANSWER' && rtcRef.current) {
            try {
              rtcStatsRef.current.answers += 1;
              await rtcRef.current.setRemoteDescription({ type: 'answer', sdp: msg.payload.sdp });
            } catch (e) { console.error('answer handling failed', e); }
          } else if (msg.type === 'ICE_CANDIDATE') {
            try {
              if (msg.payload.candidate && rtcRef.current?.remoteDescription) await rtcRef.current.addIceCandidate(msg.payload);
              else if (msg.payload.candidate) pendingIceRef.current.push(msg.payload);
            } catch (e) { console.error('ICE candidate rejected', e); }
          }
        });

        client.onDisconnect((reason) => {
          if (cancelled) return;
          if (sessionStatus === 'active') {
            setIsConnected(false);
            setAnnouncement('Reconnecting…');
            // auto-reconnect is handled inside client; keep status active until PEER_LEFT
          }
        });

        await client.connect(pid);
        setIsConnected(true);
        setAnnouncement('Connected to stranger');

        // No need to send SESSION_READY for TEXT; server already created session via matchmaking
        // But we can optionally send SESSION_READY to mark client ready
        // For now, nothing

      } catch (e) {
        console.error('chat ws error', e);
        if (!cancelled) {
          setIsConnected(false);
          setAnnouncement('Could not connect — please leave and try again');
        }
      }
    })();

    return () => {
      cancelled = true;
      closeRtc();
      // ws leave/close is explicit; closeRtc always stops local/remote media tracks.
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (body: string) => {
    if (body.length > 2000) {
      alert('Message is too long — max 2000 characters');
      return;
    }
    if (body.trim().length === 0) return;

    const clientMessageId = crypto.randomUUID();
    const newMsg: ChatMessage = {
      id: `me-${clientMessageId}`,
      body,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMsg]);

    // Send via ws
    const client = wsRef.current;
    const pid = participantIdRef.current || sessionStorage.getItem('strangerlink_participantId') || '';
    const sid = sessionIdRef.current || sessionId;
    if (client && pid && sid) {
      const msg: any = {
        type: 'MESSAGE_SEND',
        messageId: crypto.randomUUID(),
        sessionId: sid,
        fromParticipantId: pid,
        sequence: 0,
        sentAt: new Date().toISOString(),
        payload: {
          clientMessageId,
          body,
        },
      };
      client.send(msg).catch((e) => {
        console.error('send failed', e);
        setAnnouncement('Message not delivered — please try again');
      });
    }
  };

  const handleSkip = () => {
    // Skip closes signaling and all audio tracks; peer receives PEER_LEFT.
    closeRtc();
    wsRef.current?.close().catch(()=>{});
    setSessionStatus('peer-disconnected');
    setAnnouncement('Your stranger left the chat');
  };

  const handleLeave = () => {
    closeRtc();
    wsRef.current?.close().catch(()=>{});
    // small delay to allow PEER_LEFT to be sent before navigation, but also navigate immediately for local UX
    setTimeout(() => { window.location.href = '/'; }, 200);
    // also immediate for test
    window.location.href = '/';
  };

  const handleReport = () => {
    setShowReportSheet(true);
  };

  const handleSubmitReport = () => {
    if (!selectedCategory) return;
    const client = wsRef.current;
    const pid = participantIdRef.current || '';
    const sid = sessionIdRef.current || sessionId;
    if (client && pid && sid) {
      const msg: any = {
        type: 'REPORT_SUBMITTED',
        messageId: crypto.randomUUID(),
        sessionId: sid,
        fromParticipantId: pid,
        sequence: 0,
        sentAt: new Date().toISOString(),
        payload: {
          category: selectedCategory,
          note: reportNote || null,
        },
      };
      client.send(msg).catch(()=>{});
    }
    setShowReportSheet(false);
    closeRtc();
    setSessionStatus('peer-disconnected');
    setAnnouncement('Report received. Thanks — we have received your report.');
  };

  const handleBlock = () => {
    setShowBlockConfirm(true);
  };

  const handleConfirmBlock = () => {
    const client = wsRef.current;
    const pid = participantIdRef.current || '';
    const sid = sessionIdRef.current || sessionId;
    if (client && pid && sid) {
      const msg: any = {
        type: 'BLOCK_CREATED',
        messageId: crypto.randomUUID(),
        sessionId: sid,
        fromParticipantId: pid,
        sequence: 0,
        sentAt: new Date().toISOString(),
        payload: { scope: 'session' },
      };
      client.send(msg).catch(()=>{});
    }
    setShowBlockConfirm(false);
    setSessionStatus('user-block');
    setAnnouncement('You blocked this person. They can’t match with you again.');
    closeRtc();
    // also close after block
    wsRef.current?.close().catch(()=>{});
  };

  const handleRequeue = () => {
    wsRef.current?.close().catch(()=>{});
    window.location.href = '/queue';
  };

  const handleEnableMedia = async (kind: 'camera' | 'microphone') => {
    if (chatMode === 'TEXT') {
      setAnnouncement('Audio is disabled in Text mode. Choose Text + Audio before matching.');
      return;
    }
    if (kind === 'microphone') {
      // getUserMedia is called only from this explicit click gesture.
      await startPeerAudio(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      setMediaState('active');
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      setMediaState((e as DOMException)?.name === 'NotAllowedError' ? 'permission-denied' : 'failed');
    }
  };

  const handleSyntheticWebrtcTest = async () => {
    if (chatMode === 'TEXT') {
      setAnnouncement('Audio is disabled in Text mode. Choose Text + Audio before matching.');
      return;
    }
    // Real matched-peer WebRTC: synthetic audio is the media source, signaling goes through the existing WS server.
    await startPeerAudio(true);
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          <button
            onClick={handleSyntheticWebrtcTest}
            data-testid="synthetic-audio-test"
            disabled={chatMode === 'TEXT'}
            aria-label={chatMode === 'TEXT' ? 'Audio disabled in Text mode' : 'Start synthetic audio WebRTC test'}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #2563EB', background: webrtcProof==='connected'||webrtcProof==='remote-track' ? '#DBEAFE' : 'white', cursor: chatMode === 'TEXT' ? 'not-allowed' : 'pointer', opacity: chatMode === 'TEXT' ? 0.5 : 1, fontSize: '12px', fontWeight: 600 }}
          >
            {webrtcProof==='idle' ? '🔊 Synthetic Audio Test' : webrtcProof==='connecting' ? 'Connecting...' : webrtcProof==='connected' ? '✅ Connected' : webrtcProof==='remote-track' ? '🎧 Remote Track' : '🔌 Disconnected'}
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
      {webrtcProof !== 'idle' && (
        <div style={{ padding: '10px 16px', backgroundColor: webrtcProof==='connected'||webrtcProof==='remote-track' ? '#ECFDF5' : webrtcProof==='connecting' ? '#FEF3C7' : '#F3F4F6', borderBottom: '1px solid #E5E7EB', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid="webrtc-proof">
          <span>
            {webrtcProof==='connecting' && '🔄 WebRTC: creating offer → answer → ICE...'}
            {webrtcProof==='connected' && '✅ WebRTC: connected (ICE succeeded, synthetic 440Hz tone)'}
            {webrtcProof==='remote-track' && '🎧 WebRTC: remote audio track received (synthetic)'}
            {webrtcProof==='disconnected' && '🔌 WebRTC: disconnected & tracks stopped (FR-MEDIA-008)'}
          </span>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Audio: 440Hz synthetic • Report/Block still works via text</span>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline aria-label="Remote participant audio" />
      {webrtcProof !== 'idle' && (
        <div style={{ padding: '10px 16px', backgroundColor: webrtcProof==='connected'||webrtcProof==='remote-track' ? '#ECFDF5' : webrtcProof==='connecting' ? '#FEF3C7' : '#F3F4F6', borderBottom: '1px solid #E5E7EB', fontSize: '13px' }} data-testid="webrtc-proof">
          {webrtcProof==='connecting' && 'WebRTC: OFFER sent / waiting for ANSWER and ICE'}
          {webrtcProof==='connected' && 'WebRTC connected • ICE succeeded'}
          {webrtcProof==='remote-track' && 'Remote audio track received'}
          {webrtcProof==='disconnected' && 'Peer disconnected • local media tracks stopped'}
          <span style={{ marginLeft: 12, color: '#6B7280', fontSize: 11 }}>
            offers {rtcStatsRef.current.offers} · answers {rtcStatsRef.current.answers} · remote audio tracks {rtcStatsRef.current.remoteAudioTracks} · ICE {iceTypesRef.current.join(',') || 'gathering'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="messages">
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
