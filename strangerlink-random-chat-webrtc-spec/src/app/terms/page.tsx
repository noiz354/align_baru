'use client';

import React from 'react';
import { Button } from '../../shared/ui/Button';

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Terms</h1>
      <p style={{ marginTop: '16px', lineHeight: '1.6' }}>
        StrangerLink is 18+ only. By using the service you affirm you are 18 or older. Conversations are with random strangers and are not screened in real time. You may encounter offensive content. You can leave at any time and report or block at any time. No recording, no attachments, no public profiles. Session metadata retained 30 days, reports 12 months, bans and audit 24 months. See Safety and Privacy for limitations we will not hide.
      </p>
      <div style={{ marginTop: '32px' }}>
        <Button label="Back to home" onClick={() => (window.location.href = '/')} variant="primary" size="default" />
      </div>
    </div>
  );
}
