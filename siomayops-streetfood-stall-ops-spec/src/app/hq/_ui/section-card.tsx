/**
 * Dashboard section shell — the card look carried over from the previous HQ page
 * (white surface, 1px `#e5e7eb` border, 12px radius, 16px padding, 14px/700 title).
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`.
 */

import type { ReactNode } from "react";
import { FreshnessBadge } from "@/shared/ui/FreshnessBadge";
import type { DashboardSection } from "@/features/hq/dashboard-read-model";

export interface SectionCardProps {
  readonly title: string;
  readonly children: ReactNode;
  /** When provided, renders the freshness badge for that section (FR-HQ-008). */
  readonly section?: DashboardSection<unknown>;
  readonly note?: ReactNode;
  /** Grid column span for the responsive card grid. */
  readonly wide?: boolean;
}

export function SectionCard({ title, children, section, note, wide = false }: SectionCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
        {section ? <FreshnessBadge computedAt={new Date(section.computedAt)} band={section.freshnessBand} /> : null}
      </div>
      {children}
      {note ? <p style={{ margin: "10px 0 0", fontSize: 11, color: "#6b7280" }}>{note}</p> : null}
    </div>
  );
}

export function CardRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Established empty-state convention for a card body. */
export function CardEmpty({ children }: { readonly children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{children}</p>;
}
