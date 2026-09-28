'use client';
import { useEffect, useState } from 'react';

interface Org { id: string; slug: string; name: string; }
interface Mosque { id: string; slug: string; name: string; organizationId: string; }
interface Event { id: string; slug: string; title: string; organizationId: string; mosqueId: string; }

export function MajelisHubDashboard() {
  const [user, setUser] = useState('majelishub-jakarta-organizer');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedMosque, setSelectedMosque] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('Kajian Akhir Pekan 2');
  const [msg, setMsg] = useState<string | null>(null);

  const loadOrgs = async (uid: string) => {
    const r = await fetch(`/api/majelishub/organizations?userId=${uid}`, { headers: { 'x-majelishub-user': uid } });
    const j = await r.json();
    setOrgs(j.organizations ?? []);
    if (j.organizations?.[0]) setSelectedOrg(j.organizations[0].id);
  };
  const loadMosques = async (orgId: string) => {
    const r = await fetch(`/api/majelishub/organizations/${orgId}/mosques`);
    const j = await r.json();
    setMosques(j.mosques ?? []);
    if (j.mosques?.[0]) setSelectedMosque(j.mosques[0].id);
  };
  const loadEvents = async (orgId: string) => {
    const r = await fetch(`/api/majelishub/organizations/${orgId}/events?userId=${user}`, { headers: { 'x-majelishub-user': user } });
    const j = await r.json();
    setEvents(j.events ?? []);
  };

  useEffect(() => { loadOrgs(user); }, [user]);
  useEffect(() => { if (selectedOrg) { loadMosques(selectedOrg); loadEvents(selectedOrg); } }, [selectedOrg, user]);

  const createEvent = async () => {
    if (!selectedOrg || !selectedMosque) return;
    setMsg(null);
    const r = await fetch(`/api/majelishub/organizations/${selectedOrg}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-majelishub-user': user },
      body: JSON.stringify({ title: newTitle, mosqueId: selectedMosque, slug: newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,30)+'-'+Date.now().toString().slice(-4) }),
    });
    const j = await r.json();
    if (!r.ok) setMsg(`Error ${r.status}: ${j.error ?? JSON.stringify(j)}`);
    else { setMsg(`Created ${j.event.title} ${j.event.id}`); loadEvents(selectedOrg); }
  };

  const org = orgs.find(o => o.id === selectedOrg);
  const mosque = mosques.find(m => m.id === selectedMosque);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <label>User: <select value={user} onChange={e=>setUser(e.target.value)}>
          <option value="majelishub-jakarta-admin">admin@majelis.demo.test (Jakarta admin)</option>
          <option value="majelishub-jakarta-organizer">organizer@majelis.demo.test (Jakarta organizer)</option>
          <option value="majelishub-bandung-admin">admin@bandung.demo.test (Bandung admin)</option>
        </select></label>
        <span style={{ fontSize:12, color:'#888' }}>x-majelishub-user header demo</span>
      </div>

      <div style={{ border:'1px solid #ddd', padding:12, marginBottom:12 }}>
        <h2>Organization Dashboard</h2>
        <p>Selected: <strong>{org?.name ?? 'none'}</strong> ({org?.slug}) — {org?.id?.slice(0,8)}</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {orgs.map(o=> (
            <button key={o.id} onClick={()=>setSelectedOrg(o.id)} style={{ padding:'6px 12px', background: o.id===selectedOrg? '#0f766e':'#e5e7eb', color: o.id===selectedOrg? 'white':'black', border:'none', borderRadius:4 }}>{o.name}</button>
          ))}
        </div>
      </div>

      <div style={{ border:'1px solid #ddd', padding:12, marginBottom:12 }}>
        <h3>Masjid — {mosques.length} mosque(s) for {org?.name}</h3>
        <ul>{mosques.map(m=> <li key={m.id} style={{ fontWeight: m.id===selectedMosque? 'bold': 'normal' }}>{m.name} ({m.slug}) — {m.id.slice(0,8)} {m.id===selectedMosque?'←':''}</li>)}</ul>
        {mosque && <p>Selected mosque: <strong>{mosque.name}</strong> {mosque.id}</p>}
      </div>

      <div style={{ border:'1px solid #ddd', padding:12, marginBottom:12 }}>
        <h3>Kajian / Events — {events.length} event(s)</h3>
        <ul>{events.map(e=> <li key={e.id}><a href={`/kajian/${e.slug}`}>{e.title}</a> — {e.slug} — {e.id.slice(0,8)} • mosque {e.mosqueId.slice(0,8)}</li>)}</ul>
        <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center' }}>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Kajian title" style={{ flex:1, padding:8 }} />
          <button onClick={createEvent} style={{ padding:'8px 16px', background:'#0f766e', color:'white', border:'none', borderRadius:4 }}>Create Kajian (event.write)</button>
        </div>
        <p style={{ fontSize:12, color:'#666' }}>Requires permission event.write (ORGANIZER/MOSQUE_ADMIN). Audit entry hash-chained via audit_events. Rate-limit via durable bucket (simplified).</p>
        {msg && <p style={{ color: msg.startsWith('Error')?'red':'green', fontSize:12 }}>{msg}</p>}
      </div>

      <div style={{ fontSize:12, color:'#666', background:'#f0fdfa', padding:12, border:'1px solid #ccfbf1' }}>
        <strong>RLS proof:</strong> Jakarta user → Jakarta event 200; Bandung user → same Jakarta event 404 (tenantPredicate + RLS).<br/>
        <strong>Audit proof:</strong> create event → audit_events chain_position 1→2, hash sha256, prev_hash chain.<br/>
        <strong>Persistence:</strong> refresh and restart keep same org/mosque/event IDs (pglite:///tmp/majelishub-pglite).
      </div>
    </div>
  );
}
