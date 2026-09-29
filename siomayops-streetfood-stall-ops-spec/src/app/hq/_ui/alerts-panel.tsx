/**
 * Alerts panel — bound to `readModel.alerts`.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. The read model supplies a
 * structured `type` + `severity` + `context`; the Indonesian wording comes from
 * `_lib/copy.ts`, so no presentation string travels back into the read model.
 */

import type { AlertSeverity, DashboardAlert } from "@/features/hq/dashboard-read-model";
import { alertDetail, alertTitle, EMPTY_ALERTS_MESSAGE, severityLabel } from "../_lib/copy";

export interface AlertsPanelProps {
  readonly alerts: readonly DashboardAlert[];
  /** Visible threshold; the panel states how many were withheld. */
  readonly limit?: number;
}

const SEVERITY_STYLES: Record<AlertSeverity, { background: string; color: string }> = {
  INFO: { background: "#dbeafe", color: "#1e40af" },
  ATTENTION: { background: "#fef3c7", color: "#92400e" },
  BLOCKING: { background: "#fee2e2", color: "#991b1b" },
  SECURITY: { background: "#ede9fe", color: "#5b21b6" },
};

export function AlertsPanel({ alerts, limit = 8 }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{EMPTY_ALERTS_MESSAGE}</p>;
  }

  const visible = alerts.slice(0, limit);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {visible.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        const detail = alertDetail(alert);
        return (
          <div
            key={alert.id}
            style={{ border: "1px solid #e5e7eb", borderLeft: `3px solid ${style.color}`, borderRadius: 8, padding: 10 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <strong style={{ fontSize: 13, fontWeight: 600 }}>{alertTitle(alert.type)}</strong>
              <span style={{ ...style, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                {severityLabel(alert.severity)}
              </span>
            </div>
            {detail ? <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{detail}</p> : null}
          </div>
        );
      })}
      {alerts.length > visible.length ? (
        <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
          Menampilkan {visible.length} dari {alerts.length} peringatan pada hari operasional ini.
        </p>
      ) : null}
      <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
        Daftar ini hanya menampilkan peringatan; tindak lanjut (drill-down) belum tersedia.
      </p>
    </div>
  );
}
