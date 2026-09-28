'use client';
import { useEffect, useState } from 'react';

const HOUSEHOLD_ID = '594f4d49-3333-3333-3333-333333333333';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<unknown[] | null>(null);
  useEffect(() => {
    fetch(`/api/homeops/rooms?householdId=${HOUSEHOLD_ID}`, { headers: { 'x-homeops-household': HOUSEHOLD_ID } })
      .then((r) => r.json())
      .then((j) => setRooms(j.rooms ?? []));
  }, []);
  if (!rooms) return <div style={{ padding: 24 }}>Loading rooms…</div>;
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontWeight: 800, fontSize: 20 }}>Rooms — Rumah Demo</h1>
      <p style={{ color: '#64748b' }}>Household {HOUSEHOLD_ID} • {(rooms as unknown[]).length} rooms</p>
      {(rooms as { id: string; name: string; sortOrder: number }[]).map((r) => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.id}</div>
        </div>
      ))}
    </div>
  );
}
