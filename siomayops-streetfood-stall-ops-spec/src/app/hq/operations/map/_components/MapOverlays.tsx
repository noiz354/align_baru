"use client";

import { useState } from "react";
import type { OpsMapActivity, OpsMapStall, StallMarkerState } from "@/features/hq/ops-map";
import { Icon, type IconName } from "@/shared/ui/hq-shell/Icon";
import { fmtTime } from "../_map/format";
import { EVENT_STYLE, STATE_COLOR } from "./OpsMap";
import styles from "../ops-map.module.css";

/** Makes the field origin of the data explicit: everything here is sent from the operator app. */
export function SourceStrip() {
  return (
    <div className={styles.sourceStrip} onPointerDown={(e) => e.stopPropagation()}>
      <Icon name="smartphone" size={15} style={{ color: "#0f766e" }} />
      <span><strong>Sumber: aplikasi operator</strong> <em>· GPS · kamera · video · laporan cuaca · sampling · bukti insiden</em></span>
    </div>
  );
}

const LEGEND_STATES: readonly { state: StallMarkerState; label: string }[] = [
  { state: "normal", label: "Normal" },
  { state: "attention", label: "Attention" },
  { state: "incident", label: "Incident" },
  { state: "offline", label: "Offline" },
];

export function MapLegend({ insetRight, stalls }: { insetRight: number; stalls: readonly OpsMapStall[] }) {
  const count = (state: StallMarkerState) => stalls.filter((s) => s.state === state).length;
  return (
    <div className={styles.legend} style={{ right: insetRight + 12 }} aria-label="Legenda" onPointerDown={(e) => e.stopPropagation()}>
      {LEGEND_STATES.map((l) => (
        <span key={l.state} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: STATE_COLOR[l.state] }} />
          {l.label}
          <strong>{count(l.state)}</strong>
        </span>
      ))}
      <span className={styles.legendDivider} />
      {(Object.keys(EVENT_STYLE) as (keyof typeof EVENT_STYLE)[]).map((k) => (
        <span key={k} className={styles.legendItem}>
          <span className={styles.legendGlyph} style={{ color: EVENT_STYLE[k].color }}><Icon name={EVENT_STYLE[k].icon} size={9} strokeWidth={2.2} /></span>
          {EVENT_STYLE[k].label}
        </span>
      ))}
      <span className={styles.attribution}>Peta dasar skematik · posisi dilaporkan operator</span>
    </div>
  );
}

const ACTIVITY_GLYPH: Record<OpsMapActivity["kind"], { icon: IconName; color: string; bg: string }> = {
  POSITION: { icon: "navigation", color: "#0f766e", bg: "#e6f4f1" },
  SALE: { icon: "receipt", color: "#065f46", bg: "#d1fae5" },
  SAMPLE: { icon: "camera", color: "#475569", bg: "#f1f5f9" },
  INCIDENT: { icon: "shield", color: "#991b1b", bg: "#fee2e2" },
  MOVE: { icon: "route", color: "#6d28d9", bg: "#ede9fe" },
};

export function ActivityPanel({ items, onPick }: { items: readonly OpsMapActivity[]; onPick: (stallCode: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={styles.activity} aria-label="Aktivitas lapangan" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <button type="button" className={styles.activityHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="activity" size={14} style={{ color: "#0f766e" }} />
        <strong>Aktivitas Lapangan</strong>
        <span className={styles.activityCount}>{items.length} terbaru</span>
        <span className={styles.activityMore}>
          <a href="/hq/operations/activity" className={styles.link} onClick={(e) => e.stopPropagation()}>Lihat semua</a>
          <Icon name={open ? "chevron-down" : "chevron-up"} size={15} style={{ color: "#6b7280" }} />
        </span>
      </button>
      {open ? (
        <div className={styles.activityList}>
          {items.map((a) => {
            const g = ACTIVITY_GLYPH[a.kind];
            return (
              <div key={a.activityId} className={styles.activityRow} role="button" tabIndex={0} onClick={() => onPick(a.stallCode)} onKeyDown={(e) => e.key === "Enter" && onPick(a.stallCode)}>
                <span className={styles.activityTime}>{fmtTime(a.at)}</span>
                <span className={styles.activityGlyph} style={{ background: g.bg, color: g.color }}><Icon name={g.icon} size={11} strokeWidth={2.2} /></span>
                <span>{a.text}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
