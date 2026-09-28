import { getDb } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { listMosques } from "@/server/db/repositories/mosques";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ orgId: string }> }): Promise<Response> {
  const { orgId } = await ctx.params;
  const scope = organizationScope(orgId);
  const db = getDb();
  try {
    const mosques = await listMosques(db, scope);
    return Response.json({ mosques });
  } catch (e: any) {
    // Handle NOT_FOUND (AppError) as 404
    const status = e?.code === "NOT_FOUND" || e?.status === 404 ? 404 : 500;
    return Response.json({ error: String(e?.message ?? e), code: e?.code ?? "UNKNOWN" }, { status });
  }
}
