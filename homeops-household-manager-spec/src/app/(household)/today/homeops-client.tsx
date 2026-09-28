'use client';
import { useEffect, useState } from 'react';

const HOUSEHOLD_ID = '594f4d49-3333-3333-3333-333333333333';
const MEMBER_ID_BUDI = '594f4d49-3333-3333-3333-333333333334';

type Chore = {
  id: string;
  titleSnapshot: string;
  dueOn: string;
  status: string;
  roomIdSnapshot: string | null;
  assigneeMemberId: string | null;
};

export default function HomeOpsClient() {
  const [chores, setChores] = useState<Chore[] | null>(null);
  const [allChores, setAllChores] = useState<Chore[] | null>(null);
  const [today] = useState('2026-09-28');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r1 = await fetch(`/api/homeops/today?householdId=${HOUSEHOLD_ID}&today=${today}`, {
      headers: { 'x-homeops-household': HOUSEHOLD_ID },
    });
    const j1 = await r1.json();
    setChores(j1.chores ?? []);
    const r2 = await fetch(`/api/homeops/chores?householdId=${HOUSEHOLD_ID}`, {
      headers: { 'x-homeops-household': HOUSEHOLD_ID },
    });
    const j2 = await r2.json();
    setAllChores(j2.chores ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function complete(id: string) {
    setMsg(null);
    const r = await fetch(`/api/homeops/chores/${id}/complete?householdId=${HOUSEHOLD_ID}&memberId=${MEMBER_ID_BUDI}`, {
      method: 'POST',
      headers: { 'x-homeops-household': HOUSEHOLD_ID, 'x-homeops-member': MEMBER_ID_BUDI },
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg(`Failed: ${j.error ?? r.status}`);
      return;
    }
    setMsg(`Completed ${id}`);
    await load();
  }

  if (!chores || !allChores) return <div style={{ padding: 24 }}>Loading Rumah Demo…</div>;

  const overdue = chores.filter((c) => c.dueOn < today);
  const todayOnly = chores.filter((c) => c.dueOn === today);
  const later = allChores.filter((c) => c.dueOn > today && c.status === 'OPEN');

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f766e' }}>HomeOps — Rumah Demo</h1>
      <p style={{ color: '#64748b', margin: '8px 0 16px' }}>
        Household {HOUSEHOLD_ID} • Members Budi ({MEMBER_ID_BUDI}) + Sari • 3 rooms • Today {today} •{' '}
        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>pglite:///tmp/homeops-pglite</code>
      </p>
      {msg && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 8, borderRadius: 8, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Overdue ({overdue.length})</h2>
          {overdue.length === 0 ? (
            <p style={{ color: '#999' }}>—</p>
          ) : (
            overdue.map((c) => (
              <div key={c.id} style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{c.titleSnapshot}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>due {c.dueOn} • {c.id.slice(0, 8)}…</div>
                <button onClick={() => complete(c.id)} style={{ marginTop: 6, background: '#0f766e', color: 'white', border: 0, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
                  Complete
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Today ({todayOnly.length})</h2>
          {todayOnly.map((c) => (
            <div key={c.id} style={{ border: '1px solid #e2e8f0', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{c.titleSnapshot}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>due {c.dueOn} • {c.status}</div>
              <button onClick={() => complete(c.id)} style={{ marginTop: 6, background: '#0f766e', color: 'white', border: 0, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
                Complete
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Later & Tomorrow ({later.length})</h2>
        {later.map((c) => (
          <div key={c.id} style={{ fontSize: 14, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
            {c.titleSnapshot} — due {c.dueOn} • {c.id.slice(0, 8)}…
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
        API: GET /api/homeops/today?householdId=&today= + POST /api/homeops/chores/:id/complete • DB: chore_occurrence 5 rows (overdue/today×2/tomorrow/later) • Persistence: pglite file survives reload+restart
      </div>
    </div>
  );
}
