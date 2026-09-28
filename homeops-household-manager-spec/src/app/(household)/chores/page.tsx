'use client';
import { useEffect, useState } from 'react';

const HOUSEHOLD_ID = '594f4d49-3333-3333-3333-333333333333';

type Chore = { id: string; titleSnapshot: string; dueOn: string; status: string };

export default function ChoresPage() {
  const [chores, setChores] = useState<Chore[] | null>(null);
  useEffect(() => {
    fetch(`/api/homeops/chores?householdId=${HOUSEHOLD_ID}`, { headers: { 'x-homeops-household': HOUSEHOLD_ID } })
      .then((r) => r.json())
      .then((j) => setChores(j.chores ?? []));
  }, []);
  if (!chores) return <div style={{ padding: 24 }}>Loading chores…</div>;
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontWeight: 800, fontSize: 20 }}>Chores — Rumah Demo</h1>
      <p style={{ color: '#64748b' }}>{chores.length} chores (overdue/today/tomorrow/later)</p>
      {chores.map((c) => (
        <div key={c.id} style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{c.titleSnapshot}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>due {c.dueOn} • {c.status} • {c.id.slice(0, 8)}…</div>
        </div>
      ))}
    </div>
  );
}
