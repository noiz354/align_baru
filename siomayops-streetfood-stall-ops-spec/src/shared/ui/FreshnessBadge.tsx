"use client";

export interface FreshnessBadgeProps {
  readonly computedAt: Date;
  readonly band: "current" | "recent" | "stale";
}

export function FreshnessBadge({ computedAt, band }: FreshnessBadgeProps) {
  const ageMin = Math.floor((Date.now() - computedAt.getTime()) / 60000);
  const label = band === "current" ? "Baru" : band === "recent" ? `${ageMin} menit lalu` : `Stale ${ageMin}m`;

  const colors = {
    current: { bg: "#d1fae5", fg: "#065f46" },
    recent: { bg: "#fef3c7", fg: "#92400e" },
    stale: { bg: "#fee2e2", fg: "#991b1b" },
  }[band];

  return (
    <span
      style={{
        background: colors.bg,
        color: colors.fg,
        fontSize: 11,
        padding: "2px 6px",
        borderRadius: 4,
        fontWeight: 600,
      }}
      title={computedAt.toISOString()}
    >
      {label}
    </span>
  );
}
