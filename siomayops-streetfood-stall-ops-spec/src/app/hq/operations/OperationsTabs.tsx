"use client";

import styles from "./map/ops-map.module.css";

export type OperationsTab = "map" | "stalls" | "activity" | "incidents";

const TABS: readonly { key: OperationsTab; label: string; href: string; live?: boolean; count?: number }[] = [
  { key: "map", label: "Peta Live", href: "/hq/operations/map", live: true },
  { key: "stalls", label: "Outlet", href: "/hq/operations/stalls" },
  { key: "activity", label: "Aktivitas Lapangan", href: "/hq/operations/activity" },
  { key: "incidents", label: "Insiden", href: "/hq/incidents", count: 2 },
];

export function OperationsTabs({ active }: { active: OperationsTab }) {
  return (
    <nav className={styles.tabs} aria-label="Bagian Operasional">
      {TABS.map((t) => (
        <a key={t.key} href={t.href} className={t.key === active ? styles.tabActive : styles.tab} aria-current={t.key === active ? "page" : undefined}>
          {t.live ? <span className={styles.liveDot} /> : null}
          {t.label}
          {t.count ? <span className={styles.tabCount}>{t.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}
