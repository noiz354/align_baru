import { getDb } from "@/server/db/client";
import { kajianEvents } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();
  let events: any[] = [];
  try { events = await db.select().from(kajianEvents).limit(20); } catch { events = []; }
  return (
    <div style={{ padding: 16 }}>
      <h1>Kajian — Event List</h1>
      <p style={{ color: "#666" }}>{events.length} event(s) (public list, not ordered by popularity per ADR-0014)</p>
      <ul>{events.map((e: any) => <li key={e.id}><a href={`/kajian/${e.slug}`}>{e.title}</a> — {e.slug} — {e.id.slice(0,8)} • org {e.organizationId.slice(0,8)}</li>)}</ul>
      <p><a href="/dasbor">Kembali ke dasbor</a></p>
    </div>
  );
}
