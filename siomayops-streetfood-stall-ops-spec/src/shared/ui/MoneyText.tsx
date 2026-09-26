/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

import type { Money } from "../money";

export interface MoneyTextProps {
  readonly value: Money;
  /** "operator" hides decimals and uses large tabular numerals; "hq" is table-density. */
  readonly density?: "operator" | "hq";
  /** never colour-only: status text accompanies any emphasis */
  readonly emphasis?: "none" | "verified" | "waiting";
}

export function MoneyText(_props: MoneyTextProps): never {
  throw new Error("Not implemented: T-FOUND-002");
}
