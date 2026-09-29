/**
 * Outlet table, hook-free parts: the pure filter, the row and the status chip.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. Kept free of hooks so the
 * table can be rendered by a Server Component test (`renderToStaticMarkup`) as well as by the
 * interactive client wrapper in `outlet-table.tsx`.
 *
 * The filter below is presentational only: it narrows a list that the server already scoped to
 * the viewer. Client-side filtering is never an authorization decision (HQ-DASHBOARD.md §3.4).
 */

import type { DashboardOutlet, OutletStatus } from "@/features/hq/dashboard-read-model";
import { MoneyText } from "@/shared/ui/MoneyText";
import { NO_VALUE, outletStatusLabel } from "../_lib/copy";
import { formatJakartaTime } from "../_lib/format";

export interface OutletFilterState {
  readonly query: string;
  readonly status: OutletStatus | "ALL";
}

export function filterOutlets(
  outlets: readonly DashboardOutlet[],
  filter: OutletFilterState,
): readonly DashboardOutlet[] {
  const query = filter.query.trim().toLowerCase();
  return outlets.filter((outlet) => {
    if (filter.status !== "ALL" && outlet.status !== filter.status) return false;
    if (query.length === 0) return true;
    return (
      outlet.code.toLowerCase().includes(query) ||
      (outlet.operatorName ?? "").toLowerCase().includes(query) ||
      outletStatusLabel(outlet.status).toLowerCase().includes(query)
    );
  });
}

const STATUS_STYLES: Record<OutletStatus, { background: string; color: string }> = {
  NOT_STARTED: { background: "#f3f4f6", color: "#6b7280" },
  OPEN: { background: "#d1fae5", color: "#065f46" },
  SUSPENDED: { background: "#fef3c7", color: "#92400e" },
  CLOSING_SUBMITTED: { background: "#dbeafe", color: "#1e40af" },
  CLOSED: { background: "#e5e7eb", color: "#374151" },
  VOID: { background: "#fee2e2", color: "#991b1b" },
  INACTIVE: { background: "#f3f4f6", color: "#9ca3af" },
};

export function OutletStatusChip({ status }: { readonly status: OutletStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {outletStatusLabel(status)}
    </span>
  );
}

const CELL: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

export function OutletRow({ outlet }: { readonly outlet: DashboardOutlet }) {
  return (
    <tr>
      <td style={{ ...CELL, fontWeight: 600 }}>{outlet.code}</td>
      <td style={CELL}>{outlet.operatorName ?? NO_VALUE}</td>
      <td style={{ ...CELL, fontVariantNumeric: "tabular-nums" }}>{formatJakartaTime(outlet.shiftStartedAt)}</td>
      <td style={{ ...CELL, textAlign: "right" }}>
        <MoneyText value={outlet.sales} density="hq" />
      </td>
      <td style={{ ...CELL, textAlign: "right" }}>
        <MoneyText value={outlet.expenses} density="hq" />
      </td>
      <td style={{ ...CELL, textAlign: "right" }}>
        <OutletStatusChip status={outlet.status} />
      </td>
    </tr>
  );
}

export function OutletTableHeader() {
  return (
    <thead>
      <tr style={{ textAlign: "left" }}>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151" }}>Outlet</th>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151" }}>Operator</th>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151" }}>Mulai</th>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151", textAlign: "right" }}>Penjualan</th>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151", textAlign: "right" }}>Pengeluaran</th>
        <th style={{ ...CELL, borderBottom: "1px solid #e5e7eb", color: "#374151", textAlign: "right" }}>Status</th>
      </tr>
    </thead>
  );
}
