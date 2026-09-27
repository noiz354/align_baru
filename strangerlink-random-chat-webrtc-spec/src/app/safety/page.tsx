/**
 * Safety centre — real implementation.
 *
 * Requirements:
 * - NFR-SAFE-003 (honest limitations)
 * - FR-SAFE-007
 * - T-SAFE-052, T-PRIV-101
 */

'use client';

import React from 'react';
import { Button } from '../../shared/ui/Button';

// Next.js page files may export only recognized route fields; keep this page-local.
const SAFETY_LIMITATIONS = [
  {
    title: 'Conversations are not screened in real time',
    body: 'A human cannot read a message before you see it.',
  },
  {
    title: 'No moderation system is perfect',
    body: 'Some harmful content will be seen before it is stopped.',
  },
  {
    title: 'We cannot verify who someone is',
    body: 'A banned user may return under a new identity.',
  },
  {
    title: 'Your network may be visible during a call',
    body: 'During an audio or video call, the other person may be able to determine your approximate location from your internet connection.',
  },
  {
    title: 'We do not keep a record of your conversation',
    body: 'We usually cannot show a moderator what was said.',
  },
  {
    title: 'Blocking has limits',
    body: 'Blocking prevents someone matching with you again through StrangerLink. It cannot stop them returning under a new identity.',
  },
  {
    title: 'Age is self-declared',
    body: 'We cannot prove a user is 18.',
  },
  {
    title: 'We cannot guarantee no minor will ever use the service',
    body: 'The age gate raises the cost of participation; it does not eliminate the possibility.',
  },
] as const;

export default function SafetyPage(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Safety Centre</h1>
      <p style={{ fontSize: '16px', color: '#6B7280', marginTop: '8px' }}>
        StrangerLink is not an unrestricted anonymous chat system. Anonymity is for your benefit, not as a shield for abusers.
      </p>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>How reporting works</h2>
        <ul style={{ fontSize: '16px', lineHeight: '1.6', marginTop: '12px' }}>
          <li>Report is always visible in an active session — one tap, never hidden in a menu.</li>
          <li>Opening the report sheet does not end the session; submitting does.</li>
          <li>No name, email, phone, or account is collected.</li>
          <li>Duplicate reports for same session+category are collapsed.</li>
          <li>P0 categories (minor safety, illegal content, threats) escalate immediately.</li>
          <li>You receive acknowledgement but never confidential moderation reasoning.</li>
        </ul>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>How blocking works</h2>
        <ul style={{ fontSize: '16px', lineHeight: '1.6', marginTop: '12px' }}>
          <li>One confirmation, never two. No explanation required.</li>
          <li>Prevents immediate rematch for a defined window.</li>
          <li>Persists across reload within browser session.</li>
          <li>Honest about limits: blocking works through StrangerLink only.</li>
          <li>Re-checked at candidate selection, not at queue join (R5).</li>
        </ul>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Limitations we will not hide</h2>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Required by NFR-SAFE-003. The product must not claim what it cannot deliver.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {SAFETY_LIMITATIONS.map((lim, idx) => (
            <div key={idx} style={{ padding: '16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#F9FAFB' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }}>{lim.title}</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>{lim.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Privacy commitments</h2>
        <ul style={{ fontSize: '16px', lineHeight: '1.6', marginTop: '12px' }}>
          <li>No public profile required at any point (NFR-PRIV-001)</li>
          <li>Pseudonymous session identities only (NFR-PRIV-002)</li>
          <li>IP addresses not exposed to peers by default (NFR-PRIV-003, ADR-014)</li>
          <li>Signaling plane never attaches, logs, or relays peer network address (T-PRIV-101)</li>
          <li>Chat content not retained beyond session (NFR-PRIV-005, RETENTION Tier 0)</li>
          <li>No third-party analytics SDK in chat surface</li>
          <li>No message-content column may exist in schema — enforced by test</li>
        </ul>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>IP exposure disclosure</h2>
        <div style={{ padding: '16px', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #F59E0B' }}>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.5' }}>
            During an audio or video call, the other person may be able to determine your approximate location from your internet connection. If that matters to you, use text chat.
          </p>
        </div>
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px' }}>
          This disclosure renders on the media-mode entry path (T-PRIV-101). Topology is hybrid P2P with TURN fallback (ADR-005). TURN-only is PLANNED, not default.
        </p>
      </section>

      <div style={{ marginTop: '32px' }}>
        <Button label="Back to home" onClick={() => (window.location.href = '/')} variant="primary" size="default" />
      </div>
    </div>
  );
}
