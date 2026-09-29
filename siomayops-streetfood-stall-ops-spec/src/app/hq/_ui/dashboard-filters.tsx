"use client";

/**
 * Server-backed dashboard filters.
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`. Both controls are URL state
 * (`/hq?date=YYYY-MM-DD&outlet=<id>`), so the selection is refresh-safe, shareable and
 * browser-back friendly, and every change re-renders the Server Component — the query itself is
 * executed by the authenticated server boundary, never in the browser (HQ-DASHBOARD.md §3.4).
 *
 * While a transition is in flight the controls report `aria-busy` and dim the results region, so a
 * slow server render is visible instead of looking like a lost click.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DashboardOutlet } from "@/features/hq/dashboard-read-model";

export interface DashboardFiltersProps {
  readonly businessDay: string;
  readonly selectedOutletId: string | null;
  readonly outlets: readonly DashboardOutlet[];
}

function href(businessDay: string, outletId: string | null): string {
  const params = new URLSearchParams();
  params.set("date", businessDay);
  if (outletId) params.set("outlet", outletId);
  return `/hq?${params.toString()}`;
}

export function DashboardFilters({ businessDay, selectedOutletId, outlets }: DashboardFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (nextDay: string, nextOutletId: string | null) => {
    startTransition(() => {
      router.push(href(nextDay, nextOutletId));
    });
  };

  return (
    <div
      aria-busy={isPending}
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end",
        padding: 16,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
        Tanggal operasional
        <input
          type="date"
          value={businessDay}
          onChange={(event) => {
            const value = event.target.value;
            if (value) navigate(value, selectedOutletId);
          }}
          style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
        Outlet
        <select
          value={selectedOutletId ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            navigate(businessDay, value === "ALL" ? null : value);
          }}
          style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff", minWidth: 200 }}
        >
          <option value="ALL">Semua Outlet</option>
          {outlets.map((outlet) => (
            <option key={outlet.outletId} value={outlet.outletId}>
              {outlet.code}
              {outlet.operatorName ? ` — ${outlet.operatorName}` : ""}
            </option>
          ))}
        </select>
      </label>

      {isPending ? (
        <span style={{ fontSize: 12, color: "#6b7280" }}>Memuat data operasional…</span>
      ) : (
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          Filter diterapkan di server dan tercermin pada URL.
        </span>
      )}
    </div>
  );
}
