'use client';

import React from 'react';
import { Button } from '../../shared/ui/Button';

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Privacy</h1>

      <section style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>What we collect</h2>
        <ul style={{ lineHeight: '1.6' }}>
          <li>Participant identity: server-generated uuidv7, browser session only</li>
          <li>Session metadata: id, participants, mode, timestamps, end reason — 30 days</li>
          <li>Reports: session id, reporter/peer identities, category, timestamp, optional note — 12 months</li>
          <li>Blocks, bans, moderation actions, audit — 24 months</li>
          <li>IP-derived risk signal: one-way hash, coarse, 7 days rolling, rate-limit/cooldown only</li>
          <li>Telemetry: aggregate counts, rates, durations — 13 months</li>
        </ul>
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>What we never collect or store</h2>
        <ul style={{ lineHeight: '1.6' }}>
          <li>Chat message content — never stored (Tier 0)</li>
          <li>Media (audio/video) — never recorded, never stored</li>
          <li>SDP bodies, ICE candidates — ephemeral only</li>
          <li>TURN credentials — computed on demand, minutes lifetime, never stored/logged</li>
          <li>Name, email, phone, avatar, location — no accounts</li>
          <li>Device fingerprint — deliberately excluded (ABUSE_PREVENTION.md)</li>
        </ul>
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>IP handling</h2>
        <p>Raw IP is transient for connection security. Only a coarse one-way hash is retained for 7 days for rate limiting. Never exposed to peers. Never used for standalone ban (ADR-012 MR-2).</p>
        <p style={{ marginTop: '12px', padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '8px' }}>
          During an audio or video call, the other person may be able to determine your approximate location from your internet connection. If that matters to you, use text chat.
        </p>
      </section>

      <div style={{ marginTop: '32px' }}>
        <Button label="Back to home" onClick={() => (window.location.href = '/')} variant="primary" size="default" />
      </div>
    </div>
  );
}
