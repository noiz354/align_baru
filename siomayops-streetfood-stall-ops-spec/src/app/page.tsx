import { authorize, createAuthPort, type SessionContext } from "@/server/auth/port";
import { getDefaultDashboardDay, getHqDashboard, HqDashboardNotFoundError } from "@/features/hq/dashboard";
import DashboardClient from "./_dashboard/DashboardClient";
import DashboardState from "./_dashboard/States";

// Operational data must never be prerendered or shared between users.
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function isRealDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", HQ_OPS: "HQ Operasional", HQ_FINANCE: "HQ Keuangan", AREA_SUPERVISOR: "Supervisor Area", ANALYST: "Analis", AUDITOR: "Auditor", MENU_PRICING_ADMIN: "Admin Harga", OPERATOR: "Operator" };

function can(session: SessionContext, action: "hq:view" | "hq:export"): boolean {
  try { authorize(session, action, { kind: "org", organizationId: session.organizationId }); return true; } catch { return false; }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const session = await createAuthPort().resolveSession();
  if (!session) return <DashboardState kind="unauthenticated"/>;
  if (!can(session, "hq:view")) return <DashboardState kind="forbidden"/>;

  const date = first(params.date) ?? getDefaultDashboardDay();
  if (!isRealDay(date)) return <DashboardState kind="invalid"/>;
  const outletId = first(params.outletId) || undefined;

  try {
    // The whole authorized outlet list is requested so search/status filtering can stay in the browser
    // without a refetch; scope is applied on the server before anything is returned.
    const model = getHqDashboard({ scope: session.scope, businessDay: date, outletId, limit: 100 });
    const role = session.roles[0] ?? "OPERATOR";
    const label = ROLE_LABEL[role] ?? role;
    return <DashboardClient model={model} viewer={{ roleLabel: label, initials: label.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase(), canExport: can(session, "hq:export") }}/>;
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return <DashboardState kind="not-found"/>;
    console.error("dashboard.load_failed", error instanceof Error ? error.message : "unknown");
    return <DashboardState kind="error"/>;
  }
}
