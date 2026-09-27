"use client";

import type { ReactNode } from "react";

export interface TapTargetProps {
  readonly minSize: 44 | 72;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
}

export function TapTarget({ minSize, label, disabled, onClick, children }: TapTargetProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        minWidth: minSize,
        minHeight: minSize,
        padding: minSize === 72 ? "16px 20px" : "10px 16px",
        fontSize: minSize === 72 ? 18 : 14,
        fontWeight: 600,
        background: disabled ? "#e5e7eb" : "#0f766e",
        color: disabled ? "#9ca3af" : "#ffffff",
        border: "none",
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {children || label}
    </button>
  );
}
