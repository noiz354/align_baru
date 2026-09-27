"use client";

import type { Money } from "../money";
import { formatMoneyForOperator } from "../money/money";

export interface MoneyTextProps {
  readonly value: Money;
  readonly density?: "operator" | "hq";
  readonly emphasis?: "none" | "verified" | "waiting";
}

export function MoneyText({ value, density = "operator", emphasis = "none" }: MoneyTextProps) {
  const formatted = (() => {
    try {
      return formatMoneyForOperator(value);
    } catch {
      return `Rp ${value.amountMinor.toLocaleString("id-ID")}`;
    }
  })();

  const size = density === "operator" ? "20px" : "14px";
  const weight = density === "operator" ? 700 : 500;
  const color =
    emphasis === "waiting" ? "#d97706" : emphasis === "verified" ? "#059669" : "#111827";

  return (
    <span
      style={{
        fontSize: size,
        fontWeight: weight,
        fontVariantNumeric: "tabular-nums",
        color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
      aria-label={formatted}
    >
      {formatted}
      {emphasis !== "none" && (
        <span style={{ marginLeft: 6, fontSize: "12px", fontWeight: 400 }}>
          {emphasis === "waiting" ? "Menunggu verifikasi" : emphasis === "verified" ? "Terverifikasi" : ""}
        </span>
      )}
    </span>
  );
}
