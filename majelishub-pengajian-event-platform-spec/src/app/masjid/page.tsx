import { getDb } from "@/server/db/client";
import { mosques } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();
  let rows: any[] = [];
  try { rows = await db.select().from(mosques).limit(20); } catch { rows = []; }
  return (
    <div style={{ padding: 16 }}>
      <h1>Masjid — Directory</h1>
      <p style={{ color: "#666" }}>{rows.length} mosque(s)</p>
      <ul>{rows.map((m: any) => <li key={m.id}><a href={`/masjid/${m.slug}`}>{m.name}</a> — {m.slug} — {m.id.slice(0,8)} • org {m.organizationId.slice(0,8)}</li>)}</ul>
      <p><a href="/dasbor">Dasbor</a></p>
    </div>
  );
}
