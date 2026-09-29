/**
 * `/hq` — HQ dashboard (Server Component).
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`.
 *
 * Flow implemented here:
 *
 *   browser → this page → authenticated server boundary → dashboard read model → persistence
 *
 * The page is a Server Component on purpose: the operational data is read and scoped on the
 * server, so no raw persistence and no KPI arithmetic reaches the browser. Interactivity lives in
 * two client components only — the URL-state filters and the outlet table's local search.
 *
 * Filters are URL state (`/hq?date=YYYY-MM-DD&outlet=<id>`), which keeps the view refresh-safe,
 * shareable and browser-back friendly.
 */

import type { Metadata } from "next";
import { loadHqDashboard } from "@/server/dashboard/boundary";
import { DashboardView } from "./_ui/dashboard-view";
import { DashboardProblem } from "./_ui/problem-state";

export const metadata: Metadata = {
  title: "HQ Dashboard — SiomayOps",
  description: "Dashboard HQ: penjualan, pengeluaran, outlet, peringatan, dan aktivitas harian.",
};

/** Read models must never be served from a build-time cache. */
export const dynamic = "force-dynamic";

export interface HqPageProps {
  readonly searchParams: Promise<{ readonly date?: string; readonly outlet?: string }>;
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

export default async function HqPage({ searchParams }: HqPageProps) {
  const params = await searchParams;
  const date = firstValue(params.date);
  const outlet = firstValue(params.outlet);

  const result = await loadHqDashboard({ date, outletId: outlet });

  if (!result.ok) {
    const retryHref = date ? `/hq?date=${encodeURIComponent(date)}` : "/hq";
    return <DashboardProblem kind={result.kind} retryHref={retryHref} requestId={result.requestId} />;
  }

  return <DashboardView model={result.model} />;
}
