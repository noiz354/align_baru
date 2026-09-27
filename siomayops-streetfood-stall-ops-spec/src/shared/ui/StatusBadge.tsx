"use client";

export type StatusTone = "neutral" | "ok" | "waiting" | "attention" | "blocked";

export interface StatusBadgeProps {
  readonly tone: StatusTone;
  readonly messageId: string;
  readonly helpMessageId?: string;
}

const toneStyles: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "#f3f4f6", fg: "#374151", border: "#e5e7eb" },
  ok: { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
  waiting: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
  attention: { bg: "#ffedd5", fg: "#9a3412", border: "#fed7aa" },
  blocked: { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
};

export function StatusBadge({ tone, messageId, helpMessageId }: StatusBadgeProps) {
  const style = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
      role="status"
      aria-label={messageId}
    >
      <span>{messageId}</span>
      {helpMessageId && (
        <span style={{ fontWeight: 400, opacity: 0.8 }} title={helpMessageId}>
          ?
        </span>
      )}
    </span>
  );
}
