/**
 * Design tokens (Implementation: T-FOUND-002)
 * Full table in docs/design/DESIGN-SYSTEM.md.
 */

export const tokens = {
  tap: { min: 44, pos: 72 },
  type: { body: 16, secondary: 14, moneyLarge: 28, moneyMedium: 20 },
  motionMs: { fast: 120, base: 150 },
  contrast: { text: 4.5, large: 3 },
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    primary: "#0f766e",
    primaryForeground: "#ffffff",
    secondary: "#f3f4f6",
    muted: "#6b7280",
    border: "#e5e7eb",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    waiting: "#f59e0b",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
} as const;

export type Tokens = typeof tokens;
