"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./hq-shell.module.css";

/**
 * HQ application shell: brand sidebar + top bar. Wraps HQ console pages
 * (DESIGN.md §10, docs/design/PAGES.md §3). Pure presentation, no data access.
 */
export type HQNavKey =
  | "dashboard" | "operations" | "sales" | "cash" | "stock" | "expenses" | "incidents"
  | "stalls" | "locations" | "operators" | "reports" | "settings";

interface NavItem {
  readonly key: HQNavKey;
  readonly label: string;
  readonly href: string;
  readonly icon: IconName;
  readonly count?: number;
  readonly countTone?: "waiting" | "blocked";
}

const PRIMARY_NAV: readonly NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/hq", icon: "dashboard" },
  { key: "operations", label: "Operasional", href: "/hq/operations/map", icon: "map" },
  { key: "sales", label: "Penjualan", href: "/hq", icon: "receipt" },
  { key: "cash", label: "Kas & Verifikasi", href: "/hq/verification", icon: "wallet" },
  { key: "stock", label: "Stok", href: "/stock", icon: "package" },
  { key: "expenses", label: "Pengeluaran", href: "/hq/expenses", icon: "banknote", count: 3, countTone: "waiting" },
  { key: "incidents", label: "Insiden", href: "/hq/incidents", icon: "alert", count: 2, countTone: "blocked" },
];

const MASTER_NAV: readonly NavItem[] = [
  { key: "stalls", label: "Outlet & Gerobak", href: "/hq/operations/stalls", icon: "store" },
  { key: "locations", label: "Lokasi Jualan", href: "/locations", icon: "pin" },
  { key: "operators", label: "Operator", href: "/operator", icon: "users" },
  { key: "reports", label: "Laporan", href: "/hq", icon: "chart" },
];

export interface HQShellProps {
  readonly active: HQNavKey;
  readonly crumbs: readonly string[];
  readonly children: ReactNode;
}

function BrandMark() {
  // Steaming bamboo steamer — the SiomayOps mark.
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 13h16v4.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M8 13v-1.5a4 4 0 0 1 8 0V13" />
      <path d="M9 5.5c0 1-1 1.2-1 2.2M12.5 4.5c0 1-1 1.2-1 2.2M16 5.5c0 1-1 1.2-1 2.2" />
    </svg>
  );
}

export function HQShell({ active, crumbs, children }: HQShellProps) {
  const renderItem = (item: NavItem) => (
    <a
      key={item.key}
      href={item.href}
      className={item.key === active ? styles.navItemActive : styles.navItem}
      aria-current={item.key === active ? "page" : undefined}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
      {item.count ? (
        <span className={item.countTone === "blocked" ? styles.navCountBlocked : styles.navCount}>{item.count}</span>
      ) : null}
    </a>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Navigasi HQ">
        <div className={styles.brand}>
          <div className={styles.brandMark}><BrandMark /></div>
          <div>
            <div className={styles.brandName}>SiomayOps</div>
            <div className={styles.brandSub}>Konsol HQ · Jakarta</div>
          </div>
        </div>

        <button type="button" className={styles.scope} aria-label="Ganti area">
          <span>
            <strong>Jakarta Selatan</strong>
            <span>Area · 9 wilayah · 16 outlet</span>
          </span>
          <Icon name="chevron-down" size={16} style={{ color: "#6b7280" }} />
        </button>

        <nav className={styles.navGroup} aria-label="Menu utama">
          <div className={styles.navLabel}>Operasi</div>
          {PRIMARY_NAV.map(renderItem)}
        </nav>
        <nav className={styles.navGroup} aria-label="Data master">
          <div className={styles.navLabel}>Master</div>
          {MASTER_NAV.map(renderItem)}
        </nav>

        <div className={styles.sidebarBottom}>
          <a href="/hq" className={active === "settings" ? styles.navItemActive : styles.navItem}>
            <Icon name="settings" size={18} />
            <span>Pengaturan</span>
          </a>
          <div className={styles.user}>
            <div className={styles.avatar}>DL</div>
            <div>
              <div className={styles.userName}>Dewi Lestari</div>
              <div className={styles.userRole}>Supervisor Area · Jaksel</div>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.crumbs}>
            {crumbs.map((c, i) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 ? <Icon name="chevron-right" size={14} style={{ color: "#9ca3af" }} /> : null}
                {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
              </span>
            ))}
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.liveChip}><span className={styles.liveDot} />Terhubung · 16 outlet</span>
            <button type="button" className={styles.iconBtn} aria-label="Bantuan"><Icon name="help" size={18} /></button>
            <button type="button" className={styles.iconBtn} aria-label="Notifikasi, 3 baru">
              <Icon name="bell" size={18} />
              <span className={styles.dot} />
            </button>
            <div className={styles.avatar} style={{ width: 30, height: 30, fontSize: 11 }}>DL</div>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
