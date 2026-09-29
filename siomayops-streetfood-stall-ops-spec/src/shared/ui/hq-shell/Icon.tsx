"use client";

import type { CSSProperties } from "react";

/**
 * SiomayOps HQ icon family — single-weight line icons (24 viewBox, 1.75 stroke,
 * round caps). Inline SVG only: the design system forbids icon fonts and webfonts
 * (docs/design/DESIGN-SYSTEM.md §10).
 */
export type IconName =
  | "dashboard" | "map" | "receipt" | "wallet" | "package" | "banknote" | "alert" | "pin"
  | "users" | "chart" | "settings" | "search" | "refresh" | "calendar" | "chevron-down"
  | "chevron-up" | "chevron-right" | "plus" | "minus" | "play" | "camera" | "video" | "droplet"
  | "drizzle" | "sun" | "cloud" | "footprints" | "navigation" | "shield" | "route" | "smartphone"
  | "eye-off" | "clock" | "x" | "layers" | "locate" | "bell" | "filter" | "arrow-right"
  | "trend-down" | "check" | "external" | "store" | "activity" | "info" | "umbrella" | "gauge"
  | "more" | "help" | "list" | "phone" | "ground";

const PATHS: Record<IconName, string> = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  map: "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20",
  receipt: "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21zM8.5 8h7M8.5 12h7M8.5 16h4",
  wallet: "M3 7.5A2.5 2.5 0 0 1 5.5 5H19v3M3 7.5V17a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5zM16.5 14.5h.01",
  package: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10",
  banknote: "M2.5 6h19v12h-19zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 12h.01M18 12h.01",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  pin: "M12 21s-6-5.3-6-10.5a6 6 0 0 1 12 0C18 15.7 12 21 12 21zM12 8.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  users: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2",
  chart: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.3-4.3",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  calendar: "M3.5 5h17v15.5h-17zM3.5 10h17M8 3v4M16 3v4",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-up": "m6 15 6-6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  play: "M8 5.5v13l10-6.5z",
  camera: "M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 9.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z",
  video: "M3 6.5h13v11H3zM16 10l5-2.5v9L16 14",
  droplet: "M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z",
  drizzle: "M7 15.5A4.5 4.5 0 0 1 7.5 6.6 6 6 0 0 1 19 8.5a3.5 3.5 0 0 1-1 6.9M8 18v2M12 17v3M16 18v2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  cloud: "M7 18.5A4.5 4.5 0 0 1 7.5 9.6 6 6 0 0 1 19 11.5a3.5 3.5 0 0 1-1 7z",
  footprints: "M6 13c-1.5 0-2.5-2-2.5-5S4.5 3 6 3s2.5 2 2.5 5-1 5-2.5 5zM4.8 15h2.4l.4 3.5H4.4zM18 17c-1.5 0-2.5-2-2.5-5s1-5 2.5-5 2.5 2 2.5 5-1 5-2.5 5zM16.8 19h2.4l.4 3h-3.2z",
  navigation: "M21 3 3 10.5l8 2.5 2.5 8z",
  shield: "M12 3 5 6v5.5c0 4.2 3 7.4 7 9.5 4-2.1 7-5.3 7-9.5V6z",
  route: "M6 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM18 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8.5 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5",
  smartphone: "M6.5 2.5h11v19h-11zM11 18h2",
  "eye-off": "M3 3l18 18M10.6 5.2A9.8 9.8 0 0 1 12 5c5 0 8.7 4 10 7-.4 1-1.1 2.1-2 3.1M6.2 6.2C4.1 7.6 2.7 9.8 2 12c1.3 3 5 7 10 7 1.7 0 3.2-.4 4.6-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  clock: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2",
  x: "M6 6l12 12M18 6 6 18",
  layers: "m12 4 9 4.5-9 4.5-9-4.5zM3 13.5l9 4.5 9-4.5",
  locate: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  filter: "M4 5h16l-6.5 7.5V19l-3-1.5v-5z",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "trend-down": "m3 7 6.5 6.5 4-4L21 17M15 17h6v-6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  external: "M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
  store: "M4 10 5.5 4h13L20 10M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20",
  activity: "M3 12h4l3-7 4 14 3-7h4",
  info: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5M12 8h.01",
  umbrella: "M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v6.5a2 2 0 0 0 4 0",
  gauge: "M5 17a8 8 0 1 1 14 0M12 17l3.5-4.5",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  help: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  phone: "M5 4h4l1.5 4.5L8.5 10a10 10 0 0 0 5.5 5.5l1.5-2L20 15v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z",
  ground: "M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0",
};

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly title?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.75, className, style, title }: IconProps) {
  const filled = name === "play";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
