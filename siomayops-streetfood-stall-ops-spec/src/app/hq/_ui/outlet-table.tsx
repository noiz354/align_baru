"use client";

/**
 * Outlet table with client-side search and status filter.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. The outlet rows arrive from the
 * server already scoped to the viewer; search and status narrowing are presentational only and are
 * never used as an authorization boundary (HQ-DASHBOARD.md §3.4). The date/outlet selectors that
 * *do* change the server query live in `dashboard-filters.tsx`.
 */

import { useState } from "react";
import type { DashboardOutlet, OutletStatus } from "@/features/hq/dashboard-read-model";
import { EMPTY_OUTLETS_MESSAGE, NO_VALUE, outletStatusLabel } from "../_lib/copy";
import { filterOutlets, OutletRow, OutletTableHeader } from "./outlet-table-parts";

export interface OutletTableProps {
  readonly outlets: readonly DashboardOutlet[];
}

export function OutletTable({ outlets }: OutletTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OutletStatus | "ALL">("ALL");

  const statuses = Array.from(new Set(outlets.map((outlet) => outlet.status)));
  const visible = filterOutlets(outlets, { query, status });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280", flex: "1 1 200px" }}>
          Cari outlet / operator
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kode atau nama operator"
            style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280", flex: "0 1 180px" }}>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OutletStatus | "ALL")}
            style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff" }}
          >
            <option value="ALL">Semua status</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {outletStatusLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <OutletTableHeader />
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  {outlets.length === 0 ? EMPTY_OUTLETS_MESSAGE : "Tidak ada outlet yang cocok dengan filter ini."}
                </td>
              </tr>
            ) : (
              visible.map((outlet) => <OutletRow key={outlet.outletId} outlet={outlet} />)
            )}
          </tbody>
        </table>
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
        Menampilkan {visible.length} dari {outlets.length} outlet dalam scope Anda. Operator {NO_VALUE} berarti
        belum ada shift pada tanggal ini.
      </p>
    </div>
  );
}
