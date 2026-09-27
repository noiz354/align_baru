/**
 * Start page — age gate, safety notice, mode selection.
 *
 * Requirements:
 * - FR-ENTRY-001 … FR-ENTRY-010
 * - T-SESSION-002, T-MATCH-031
 * - DESIGN.md §4, §5, §6
 */

'use client';

import React, { useState } from 'react';
import { Checkbox } from '../../shared/ui/Checkbox';
import { Button } from '../../shared/ui/Button';
import { SAFETY_NOTICE_STATEMENTS } from '../../features/safety/age-gate';

const INTEREST_VOCABULARY = ['music', 'gaming', 'movies', 'sports', 'tech', 'art', 'travel', 'food', 'books', 'language'];

export default function StartPage(): React.JSX.Element {
  const [attestedAge, setAttestedAge] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const [acknowledgedEphemerality, setAcknowledgedEphemerality] = useState(false);
  const [acknowledgedExitRights, setAcknowledgedExitRights] = useState(false);
  const [acknowledgedIpExposure, setAcknowledgedIpExposure] = useState(false);
  const [mode, setMode] = useState<'TEXT' | 'TEXT_AUDIO' | 'TEXT_VIDEO'>('TEXT');
  const [interests, setInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>('');

  const canContinue = attestedAge && acknowledgedRisks && acknowledgedEphemerality && acknowledgedExitRights && (mode === 'TEXT' || acknowledgedIpExposure);

  const toggleInterest = (interest: string) => {
    setInterests(prev => {
      if (prev.includes(interest)) return prev.filter(i => i !== interest);
      if (prev.length >= 5) return prev;
      return [...prev, interest];
    });
  };

  const handleContinue = () => {
    if (!canContinue) return;
    try {
      const consent = {
        consentVersion: 1,
        ageAttested: attestedAge,
        acknowledgedEphemerality,
        acknowledgedStrangerRisk: acknowledgedRisks,
        acknowledgedExitRights,
        acknowledgedIpExposure: mode === 'TEXT' ? true : acknowledgedIpExposure,
        attestedAt: new Date().toISOString(),
      };
      sessionStorage.setItem('strangerlink_consent', JSON.stringify(consent));
      sessionStorage.setItem('strangerlink_mode', mode);
      sessionStorage.setItem('strangerlink_interests', JSON.stringify(interests));
      if (language) sessionStorage.setItem('strangerlink_language', language);
    } catch {
      // Storage unavailable — degrade to in-memory (EC-23)
    }
    window.location.href = '/queue';
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Before you start</h1>

      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #F59E0B' }}>
        <p style={{ fontWeight: 700, margin: '0 0 8px 0' }}>This service is for adults 18 and over.</p>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
          Conversations are with random strangers, content is not screened in real time, and you may encounter offensive material.
        </p>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Age gate</h2>
        <Checkbox
          label="I am 18 or older."
          checked={attestedAge}
          onChange={setAttestedAge}
          id="age-checkbox"
        />
        <Checkbox
          label="I understand that conversations are with random strangers and are not screened in real time. I can leave or report at any time."
          checked={acknowledgedRisks}
          onChange={setAcknowledgedRisks}
          id="risks-checkbox"
          describedBy="risks-description"
        />
        <p id="risks-description" style={{ fontSize: '12px', color: '#6B7280', marginLeft: '32px' }}>
          This is self-attestation, not identity verification. We do not claim to verify age (NFR-SAFE-003).
        </p>
        <Checkbox
          label="I understand that conversations are not recorded or stored."
          checked={acknowledgedEphemerality}
          onChange={setAcknowledgedEphemerality}
          id="ephemerality-checkbox"
        />
        <Checkbox
          label="I understand that I can leave at any time and report or block the other person at any time."
          checked={acknowledgedExitRights}
          onChange={setAcknowledgedExitRights}
          id="exit-rights-checkbox"
        />
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Safety notice</h2>
        <div style={{ maxHeight: '200px', overflow: 'auto', padding: '16px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#F9FAFB' }}>
          {SAFETY_NOTICE_STATEMENTS.map((statement, idx) => (
            <p key={idx} style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.5' }}>
              {idx + 1}. {statement}
            </p>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
          Scroll to read all safety information. This notice cannot be permanently dismissed on first visit.
        </p>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Chat mode</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {[
            { value: 'TEXT', label: 'Text', desc: 'Type only. Nothing is recorded.' },
            { value: 'TEXT_AUDIO', label: 'Text + Audio', desc: 'Add your microphone. You can mute anytime.' },
            { value: 'TEXT_VIDEO', label: 'Text + Audio + Video', desc: 'Add your camera. You can turn it off anytime.' },
          ].map((m) => (
            <label key={m.value} style={{ display: 'flex', gap: '12px', padding: '16px', border: mode === m.value ? '2px solid #111827' : '1px solid #E5E7EB', borderRadius: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value as any)}
                style={{ marginTop: '4px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '14px', color: '#6B7280' }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>Your camera and microphone are off until you choose to turn them on.</p>

        {mode !== 'TEXT' && (
          <div style={{ marginTop: '16px' }}>
            <Checkbox
              label="I understand that during an audio or video call, the other person may be able to determine my approximate location from my internet connection. If that matters to me, I will use text chat."
              checked={acknowledgedIpExposure}
              onChange={setAcknowledgedIpExposure}
              id="ip-exposure-checkbox"
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Interests (optional)</h2>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>We&apos;ll try to match your interests — never guaranteed.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {INTEREST_VOCABULARY.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              aria-pressed={interests.includes(interest)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: interests.includes(interest) ? '2px solid #111827' : '1px solid #D1D5DB',
                backgroundColor: interests.includes(interest) ? '#111827' : 'white',
                color: interests.includes(interest) ? 'white' : '#111827',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <label htmlFor="language-select" style={{ fontSize: '14px', fontWeight: 600 }}>Language (optional)</label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{ display: 'block', marginTop: '8px', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '100%', fontSize: '16px' }}
        >
          <option value="">Any language</option>
          <option value="en">English</option>
          <option value="id">Indonesian</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>
      </div>

      <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
        <Button label="Continue" onClick={handleContinue} variant="primary" size="critical" disabled={!canContinue} />
        <Button label="Why do we ask?" onClick={() => (window.location.href = '/safety')} variant="ghost" size="default" />
      </div>
    </div>
  );
}
