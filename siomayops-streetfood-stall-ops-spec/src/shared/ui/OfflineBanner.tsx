"use client";

export interface OfflineBannerProps {
  readonly isOffline: boolean;
  readonly pendingRecordCount: number;
  readonly oldestPendingAgeSeconds?: number;
}

export function OfflineBanner({ isOffline, pendingRecordCount, oldestPendingAgeSeconds }: OfflineBannerProps) {
  if (!isOffline && pendingRecordCount === 0) return null;

  const message = isOffline
    ? `Tanpa sinyal — penjualan tetap tercatat${pendingRecordCount > 0 ? ` (${pendingRecordCount} antri)` : ""}`
    : `${pendingRecordCount} catatan menunggu sinkronisasi`;

  return (
    <div
      style={{
        background: isOffline ? "#fef3c7" : "#dbeafe",
        color: isOffline ? "#92400e" : "#1e40af",
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 500,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #e5e7eb",
      }}
      role="status"
      aria-live="polite"
    >
      <span>{message}</span>
      {oldestPendingAgeSeconds && oldestPendingAgeSeconds > 300 && (
        <span style={{ fontSize: 12 }}>Tertua: {Math.floor(oldestPendingAgeSeconds / 60)} menit</span>
      )}
    </div>
  );
}
