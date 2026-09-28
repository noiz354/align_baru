import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { mosques, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const rows = await db.select().from(mosques).where(eq(mosques.slug, slug)).limit(1);
  const m = rows[0];
  if (!m) notFound();
  const orgRows = await db.select().from(organizations).where(eq(organizations.id, m.organizationId)).limit(1);
  const org = orgRows[0];
  return (
    <div style={{ padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}><a href="/dasbor">Dasbor</a> / Masjid / {m.name}</nav>
      <h1>{m.name}</h1>
      <p style={{ color: "#666" }}>{m.kind} • {m.timezone} • {m.isActive ? "Active" : "Inactive"}</p>
      <ul style={{ fontSize: 14 }}>
        <li>ID: {m.id}</li>
        <li>Slug: {m.slug}</li>
        <li>Organization: {org?.name} ({m.organizationId.slice(0,8)})</li>
      </ul>
      <p><a href={`/kajian`}>Lihat kajian</a></p>
    </div>
  );
}
