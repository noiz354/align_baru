import { getDb } from "@/server/db/client";
import { organizations, organizationMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Demo: list orgs for user via x-majelishub-user header (or query ?userId=)
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin";
  const db = getDb();
  // For PGlite dev, just query memberships → orgs
  try {
    const memberships = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
    const orgIds = memberships.map(m => m.organizationId);
    if (orgIds.length === 0) return Response.json({ organizations: [] });
    // Simple: fetch all orgs and filter
    const allOrgs = await db.select().from(organizations);
    const filtered = allOrgs.filter(o => orgIds.includes(o.id));
    return Response.json({ organizations: filtered });
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
