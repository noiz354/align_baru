"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpsMapReadModel } from "@/features/hq/ops-map";
import { Icon } from "@/shared/ui/hq-shell/Icon";
import { OperationsTabs } from "../OperationsTabs";
import { FilterBar } from "./_components/FilterBar";
import { ActivityPanel, MapLegend, SourceStrip } from "./_components/MapOverlays";
import { OpsMap } from "./_components/OpsMap";
import { StallDrawer } from "./_components/StallDrawer";
import { fmtBusinessDay, fmtRelative } from "./_map/format";
import styles from "./ops-map.module.css";

const DRAWER_WIDTH = 420;
/** Heights of the overlays pinned to the map edges (source strip / activity panel), incl. margins. */
const INSET_TOP = 42;
const INSET_BOTTOM = 160;
const DEFAULT_SELECTED_CODE = "Kuningan 02";

interface ApiEnvelope {
  readonly data: OpsMapReadModel;
  readonly meta: { readonly computedAt: string; readonly freshnessBand: "current" | "recent" | "stale"; readonly source: string };
}

/**
 * HQ › Operasional › Peta Live — where each mobile stall currently is and whether
 * its location is operationally healthy. Positions are operator-reported per shift
 * (ADR-0007); traffic sampling is anonymous counting only (PRIVACY.md).
 */
export default function OperationsMapPage() {
  const [model, setModel] = useState<ApiEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/hq/ops-map", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Gagal memuat peta (${r.status})`);
        return (await r.json()) as ApiEnvelope;
      })
      .then((env) => {
        if (cancelled) return;
        setModel(env);
        const preset = env.data.stalls.find((s) => s.code === DEFAULT_SELECTED_CODE);
        setSelectedId((cur) => cur ?? preset?.stallId ?? null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Gagal memuat peta"));
    return () => {
      cancelled = true;
    };
  }, []);

  const data = model?.data ?? null;
  const stalls = useMemo(() => data?.stalls ?? [], [data]);

  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(stalls.filter((s) => `${s.code} ${s.areaName} ${s.operator.fullName}`.toLowerCase().includes(q)).map((s) => s.stallId));
  }, [stalls, query]);

  const selected = stalls.find((s) => s.stallId === selectedId) ?? null;
  const insetRight = selected ? DRAWER_WIDTH : 0;

  const pickByCode = (code: string) => {
    const s = stalls.find((x) => x.code === code);
    if (s) setSelectedId(s.stallId);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Peta Operasional</h1>
          <p className={styles.subtitle}>Pantau posisi dan kondisi outlet bergerak secara real-time</p>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.btn}>
            <Icon name="calendar" size={15} style={{ color: "#6b7280" }} />
            {data ? fmtBusinessDay(data.businessDay) : "—"}
            <Icon name="chevron-down" size={14} style={{ color: "#9ca3af" }} />
          </button>
          <div className={styles.refresh} aria-live="polite">
            <span className={styles.refreshDot} />
            <span>{data && model ? `Diperbarui ${fmtRelative(model.meta.computedAt, data.asOf)}` : "Memuat…"}</span>
            <button type="button" className={styles.refreshBtn} aria-label="Muat ulang"><Icon name="refresh" size={15} /></button>
          </div>
          <button type="button" className={styles.btnPrimary}>
            <Icon name="plus" size={15} strokeWidth={2.2} />
            Update Posisi
          </button>
        </div>
      </div>

      <OperationsTabs active="map" />

      <div className={styles.mapCard}>
        <FilterBar stalls={stalls} query={query} onQuery={setQuery} />

        {error ? (
          <div className={styles.mapNotice} role="alert">{error}</div>
        ) : data ? (
          <OpsMap
            stalls={stalls}
            events={data.events}
            weatherZones={data.weatherZones}
            asOf={data.asOf}
            selectedId={selectedId}
            onSelect={setSelectedId}
            insetRight={insetRight}
            insetTop={INSET_TOP}
            insetBottom={INSET_BOTTOM}
            visibleIds={visibleIds}
            overlay={
              <>
                <SourceStrip />
                <MapLegend insetRight={insetRight} stalls={stalls} />
                <ActivityPanel items={data.activity} onPick={pickByCode} />
              </>
            }
          />
        ) : (
          <div className={styles.mapNotice} aria-busy="true">Memuat posisi outlet…</div>
        )}

        {selected && data ? <StallDrawer stall={selected} asOf={data.asOf} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </div>
  );
}
