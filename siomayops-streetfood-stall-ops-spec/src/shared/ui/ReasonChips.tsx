"use client";

export interface ReasonChip {
  readonly code: string;
  readonly labelMessageId: string;
  readonly requiresNote?: boolean;
}

export interface ReasonChipsProps {
  readonly chips: readonly ReasonChip[];
  readonly selectedCode?: string;
  readonly onSelect?: (code: string) => void;
}

export function ReasonChips({ chips, selectedCode, onSelect }: ReasonChipsProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {chips.map(chip => {
        const selected = chip.code === selectedCode;
        return (
          <button
            key={chip.code}
            onClick={() => onSelect?.(chip.code)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: selected ? "2px solid #0f766e" : "1px solid #e5e7eb",
              background: selected ? "#ccfbf1" : "#ffffff",
              color: selected ? "#0f766e" : "#374151",
              fontSize: 14,
              fontWeight: selected ? 600 : 400,
              cursor: "pointer",
              minHeight: 44,
            }}
            aria-pressed={selected}
          >
            {chip.labelMessageId}
            {chip.requiresNote && <span style={{ marginLeft: 4 }}>*</span>}
          </button>
        );
      })}
    </div>
  );
}
