/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Design tokens (Phase 0 data only — no styling implementation). Full table in
 * docs/design/DESIGN-SYSTEM.md. Numbers here are commitments, not suggestions:
 *  - minimum tap target 44 px (72 px for POS tiles)
 *  - body text 16 px, monetary figures 20–28 px with tabular numerals
 *  - contrast >= 4.5:1 for text, >= 3:1 for large text/UI boundaries
 *  - amber = waiting (includes "menunggu verifikasi"); red is reserved for blocking errors and
 *    safety — never for an operator's honest variance report
 */
export const tokens = {
  tap: { min: 44, pos: 72 },
  type: { body: 16, secondary: 14, moneyLarge: 28, moneyMedium: 20 },
  motionMs: { fast: 120, base: 150 },
  contrast: { text: 4.5, large: 3 }
} as const;
