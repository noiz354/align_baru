"use client";

import type { OpsMapStall } from "@/features/hq/ops-map";
import { Icon } from "@/shared/ui/hq-shell/Icon";
import styles from "../ops-map.module.css";

export interface FilterBarProps {
  readonly stalls: readonly OpsMapStall[];
  readonly query: string;
  readonly onQuery: (q: string) => void;
}

const FILTERS = ["Status", "Keramaian", "Cuaca", "Insiden", "Update Terakhir"] as const;

export function FilterBar({ stalls, query, onQuery }: FilterBarProps) {
  const total = stalls.length;
  return (
    <div className={styles.filterBar} role="toolbar" aria-label="Filter peta">
      <label className={styles.search}>
        <Icon name="search" size={15} />
        <input
          type="search"
          placeholder="Cari outlet atau area"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Cari outlet atau area"
        />
      </label>
      <button type="button" className={styles.chipActive} aria-pressed="true" title={`${total} outlet`}>
        Semua Outlet
      </button>
      {FILTERS.map((f) => (
        <button key={f} type="button" className={styles.chip} aria-haspopup="listbox">
          {f}<Icon name="chevron-down" size={12} style={{ color: "#9ca3af" }} />
        </button>
      ))}
    </div>
  );
}
