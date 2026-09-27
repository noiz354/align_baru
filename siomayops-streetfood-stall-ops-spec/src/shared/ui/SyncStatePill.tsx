"use client";

export type SyncState = "LOCAL_ONLY" | "PENDING" | "SYNCING" | "SYNCED" | "REJECTED" | "DEFERRED";

export interface SyncStatePillProps {
  readonly state: SyncState;
  readonly reasonMessageId?: string;
  readonly retryAfterSeconds?: number;
}

const stateMap: Record<SyncState, { label: string; color: string; bg: string }> = {
  LOCAL_ONLY: { label: "Lokal", color: "#374151", bg: "#f3f4f6" },
  PENDING: { label: "Antri", color: "#92400e", bg: "#fef3c7" },
  SYNCING: { label: "Sinkron...", color: "#1e40af", bg: "#dbeafe" },
  SYNCED: { label: "Tersinkron", color: "#065f46", bg: "#d1fae5" },
  REJECTED: { label: "Ditolak", color: "#991b1b", bg: "#fee2e2" },
  DEFERRED: { label: "Ditunda", color: "#9a3412", bg: "#ffedd5" },
};

export function SyncStatePill({ state, reasonMessageId, retryAfterSeconds }: SyncStatePillProps) {
  const cfg = stateMap[state];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
      title={reasonMessageId}
    >
      {cfg.label}
      {reasonMessageId && <span style={{ fontWeight: 400 }}>• {reasonMessageId}</span>}
      {retryAfterSeconds && <span>({retryAfterSeconds}s)</span>}
    </span>
  );
}
