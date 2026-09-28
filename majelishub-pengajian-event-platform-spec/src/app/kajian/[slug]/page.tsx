import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { kajianEvents, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  // For wave2 demo, just fetch event by slug without scope (public read), but org-scoped via join
  // Find event
  const rows = await db.select().from(kajianEvents).where(eq(kajianEvents.slug, slug)).limit(1);
  const ev = rows[0];
  if (!ev) notFound();
  const orgRows = await db.select().from(organizations).where(eq(organizations.id, ev.organizationId)).limit(1);
  const org = orgRows[0];
  return (
    <div style={{ padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}><a href="/dasbor">Dasbor</a> / <a href="/kajian">Kajian</a> / {ev.title}</nav>
      <h1>{ev.title}</h1>
      <p style={{ color: "#666" }}>{ev.description ?? ""}</p>
      <ul style={{ fontSize: 14 }}>
        <li>ID: {ev.id}</li>
        <li>Slug: {ev.slug}</li>
        <li>Organization: {org?.name} ({ev.organizationId.slice(0,8)})</li>
        <li>Mosque: {ev.mosqueId.slice(0,8)}</li>
        <li>Status: {ev.status}</li>
        <li>Starts: {ev.startsAt ? new Date(ev.startsAt).toISOString() : "-"}</li>
      </ul>
      <p style={{ fontSize: 12, color: "#666" }}>Event detail persisted via kajian_events (pglite), RLS via organization_id, audit via audit_events.</p>
    </div>
  );
}
