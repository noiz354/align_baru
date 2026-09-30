"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, ReactNode, WheelEvent as RWheelEvent } from "react";
import type { OpsMapEvent, OpsMapEventKind, OpsMapStall, StallMarkerState, WeatherZone } from "@/features/hq/ops-map";
import { Icon, type IconName } from "@/shared/ui/hq-shell/Icon";
import { AREAS, GRID_ZONES, PLACES, STATIONS, WAYS, type LL } from "../_map/basemap-data";
import { generateBlocks } from "../_map/procedural";
import { fmtRelative, fmtRupiah, fmtTime } from "../_map/format";
import { makeScreen, metresPerPixel, project, unproject, type LatLng, type Pt, type ViewState } from "../_map/projection";
import styles from "../ops-map.module.css";

export const STATE_COLOR: Record<StallMarkerState, string> = {
  normal: "#059669",
  attention: "#f59e0b",
  incident: "#dc2626",
  offline: "#9ca3af",
};

export const STATE_LABEL: Record<StallMarkerState, string> = {
  normal: "Normal",
  attention: "Perlu perhatian",
  incident: "Insiden",
  offline: "Offline / posisi lama",
};

export const EVENT_STYLE: Record<OpsMapEventKind, { icon: IconName; color: string; label: string }> = {
  TRAFFIC_SAMPLE: { icon: "camera", color: "#475569", label: "Sampling keramaian" },
  WET_AREA: { icon: "droplet", color: "#0284c7", label: "Area basah" },
  SECURITY_INCIDENT: { icon: "shield", color: "#dc2626", label: "Insiden keamanan" },
  RELOCATION: { icon: "route", color: "#7c3aed", label: "Relokasi sementara" },
  OPERATOR_UPDATE: { icon: "navigation", color: "#0f766e", label: "Update operator" },
};

/** Basemap is pre-projected once at this zoom; other zooms are a group transform. */
const Z0 = 13;
const ORIGIN_LL: LatLng = { lat: -6.24, lng: 106.85 };
const MIN_ZOOM = 11.8;
const MAX_ZOOM = 16.5;
const CLUSTER_PX = 34;

export const DEFAULT_VISIBLE_CENTER: LatLng = { lat: -6.2385, lng: 106.829 };
export const DEFAULT_ZOOM = 13.05;

interface Size {
  readonly w: number;
  readonly h: number;
}

function toLocal(p: LL): Pt {
  const o = project(ORIGIN_LL, Z0);
  const w = project({ lat: p[0], lng: p[1] }, Z0);
  return { x: w.x - o.x, y: w.y - o.y };
}

function pathD(pts: readonly LL[], close = false): string {
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const p = toLocal(pts[i]!);
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return close ? `${d}Z` : d;
}

function screenPathD(pts: readonly LL[], toScreen: (p: LatLng) => Pt): string {
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const s = toScreen({ lat: pts[i]![0], lng: pts[i]![1] });
    d += `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
  }
  return d;
}

const WAY_STYLE: Record<string, { casing?: string; casingW?: number; fill: string; w: number; dash?: string }> = {
  river: { fill: "#c5d8e4", w: 5 },
  canal: { fill: "#c5d8e4", w: 3 },
  local: { fill: "#ffffff", w: 1.5 },
  secondary: { casing: "#d6d9d2", casingW: 4.5, fill: "#ffffff", w: 3 },
  arterial: { casing: "#cdd1c9", casingW: 7, fill: "#ffffff", w: 5 },
  toll: { casing: "#dcc283", casingW: 7.5, fill: "#f6dfa4", w: 5 },
  rail: { casing: "#8d95a1", casingW: 2.4, fill: "#ffffff", w: 1.4, dash: "7 7" },
  mrt: { fill: "#a5adba", w: 1.6, dash: "2 4" },
};

const AREA_FILL: Record<string, string> = {
  park: "#d8e7d2",
  cemetery: "#dfe6d8",
  water: "#c5d8e4",
  campus: "#e7e3d6",
  commercial: "#ebe6dc",
};

export interface OpsMapProps {
  readonly stalls: readonly OpsMapStall[];
  readonly events: readonly OpsMapEvent[];
  readonly weatherZones: readonly WeatherZone[];
  readonly asOf: string;
  readonly selectedId: string | null;
  readonly onSelect: (stallId: string | null) => void;
  /** Width of the right-side drawer covering the map (0 when closed). */
  readonly insetRight: number;
  /** Height of overlays pinned to the top / bottom edge (source strip, activity panel). */
  readonly insetTop?: number;
  readonly insetBottom?: number;
  /** Stall ids currently matching the filters; null = show all. */
  readonly visibleIds: ReadonlySet<string> | null;
  readonly overlay?: ReactNode;
}

export function OpsMap({ stalls, events, weatherZones, asOf, selectedId, onSelect, insetRight, insetTop = 0, insetBottom = 0, visibleIds, overlay }: OpsMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<ViewState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<{ start: Pt; centerPx: Pt; zoom: number } | null>(null);

  // Measure host.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The geographic "visible centre" sits in the middle of the area not covered by
  // the drawer / pinned overlays, so the default view keeps every stall in sight.
  const initialView = useCallback((): ViewState => {
    const c = project(DEFAULT_VISIBLE_CENTER, DEFAULT_ZOOM);
    return { center: unproject({ x: c.x + insetRight / 2, y: c.y + (insetBottom - insetTop) / 2 }, DEFAULT_ZOOM), zoom: DEFAULT_ZOOM };
  }, [insetRight, insetTop, insetBottom]);

  useEffect(() => {
    if (size.w > 0 && size.h > 0 && !view) setView(initialView());
  }, [size, view, initialView]);

  // ---------- Pre-projected basemap (once) ----------
  const base = useMemo(() => {
    const blocks = GRID_ZONES.map((z) => generateBlocks(z).map((poly) => pathD(poly, true)).join(""));
    const areas = AREAS.map((a) => ({ cls: a.cls, d: pathD(a.pts, true) }));
    const ways = WAYS.map((w) => ({ cls: w.cls, d: pathD(w.pts) }));
    return { blocks, areas, ways };
  }, []);

  const ready = view && size.w > 0 && size.h > 0;
  const { toScreen, fromScreen } = useMemo(
    () => (ready ? makeScreen(view, size.w, size.h) : { toScreen: () => ({ x: 0, y: 0 }), fromScreen: () => DEFAULT_VISIBLE_CENTER }),
    [ready, view, size],
  );

  // Group transform for the pre-projected layer.
  const groupTransform = useMemo(() => {
    if (!ready) return "";
    const k = Math.pow(2, view.zoom - Z0);
    const o = project(ORIGIN_LL, Z0);
    const c = project(view.center, Z0);
    const tx = size.w / 2 - (c.x - o.x) * k;
    const ty = size.h / 2 - (c.y - o.y) * k;
    return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(5)})`;
  }, [ready, view, size]);

  // ---------- Interaction ----------
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!view || e.button !== 0) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { start: { x: e.clientX, y: e.clientY }, centerPx: project(view.center, view.zoom), zoom: view.zoom };
    setDragging(true);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.start.x;
    const dy = e.clientY - d.start.y;
    setView({ center: unproject({ x: d.centerPx.x - dx, y: d.centerPx.y - dy }, d.zoom), zoom: d.zoom });
  };
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const moved = Math.hypot(e.clientX - dragRef.current.start.x, e.clientY - dragRef.current.start.y);
      dragRef.current = null;
      setDragging(false);
      if (moved < 4) onSelect(null); // plain click on the map clears the selection
    }
  };

  const zoomAt = useCallback(
    (nextZoom: number, anchor: Pt) => {
      if (!view) return;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const geo = fromScreen(anchor);
      const p = project(geo, z);
      const center = unproject({ x: p.x - (anchor.x - size.w / 2), y: p.y - (anchor.y - size.h / 2) }, z);
      setView({ center, zoom: z });
    },
    [view, fromScreen, size],
  );

  const onWheel = (e: RWheelEvent<HTMLDivElement>) => {
    if (!view) return;
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(view.zoom - e.deltaY * 0.0018, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const visibleCenterPx: Pt = { x: (size.w - insetRight) / 2, y: size.h / 2 };
  const zoomStep = (delta: number) => view && zoomAt(view.zoom + delta, visibleCenterPx);
  const resetView = () => setView(initialView());

  // ---------- Derived screen-space features ----------
  const shownStalls = useMemo(
    () => stalls.filter((s) => !visibleIds || visibleIds.has(s.stallId)),
    [stalls, visibleIds],
  );

  const placed = useMemo(
    () => (ready ? shownStalls.map((s) => ({ s, p: toScreen(s.position) })) : []),
    [ready, shownStalls, toScreen],
  );

  const { singles, clusters } = useMemo(() => {
    const used = new Set<number>();
    const singles: { s: OpsMapStall; p: Pt }[] = [];
    const clusters: { members: { s: OpsMapStall; p: Pt }[]; p: Pt }[] = [];
    for (let i = 0; i < placed.length; i++) {
      if (used.has(i)) continue;
      const a = placed[i]!;
      used.add(i);
      if (a.s.stallId === selectedId) {
        singles.push(a);
        continue;
      }
      const group = [a];
      for (let j = i + 1; j < placed.length; j++) {
        if (used.has(j)) continue;
        const b = placed[j]!;
        if (b.s.stallId === selectedId) continue;
        if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < CLUSTER_PX) {
          group.push(b);
          used.add(j);
        }
      }
      if (group.length > 1) {
        const cx = group.reduce((acc, g) => acc + g.p.x, 0) / group.length;
        const cy = group.reduce((acc, g) => acc + g.p.y, 0) / group.length;
        clusters.push({ members: group, p: { x: cx, y: cy } });
      } else {
        singles.push(a);
      }
    }
    return { singles, clusters };
  }, [placed, selectedId]);

  const selected = placed.find((x) => x.s.stallId === selectedId) ?? null;
  const hovered = placed.find((x) => x.s.stallId === hoverId) ?? null;
  const mpp = view ? metresPerPixel(view.center.lat, view.zoom) : 1;

  // Scale bar: nice round metres that fit ~90px.
  const scale = useMemo(() => {
    const target = 90 * mpp;
    const steps = [100, 200, 250, 500, 1000, 2000, 5000];
    const m = steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]!);
    return { m, px: m / mpp };
  }, [mpp]);

  // Road label paths (screen space) — reversed when the path runs right-to-left so text stays upright.
  const labelPaths = useMemo(() => {
    if (!ready) return [];
    return WAYS.filter((w) => w.label && w.name).map((w, i) => {
      const first = toScreen({ lat: w.pts[0]![0], lng: w.pts[0]![1] });
      const last = toScreen({ lat: w.pts[w.pts.length - 1]![0], lng: w.pts[w.pts.length - 1]![1] });
      const pts = last.x < first.x ? [...w.pts].reverse() : w.pts;
      return { id: `rl-${i}`, d: screenPathD(pts, toScreen), name: w.name!, cls: w.cls, offset: w.labelOffset ?? 30 };
    });
  }, [ready, toScreen]);

  const rightEdge = size.w - insetRight;

  return (
    <div
      ref={hostRef}
      className={dragging ? styles.mapBodyDragging : styles.mapBody}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      role="application"
      aria-label="Peta operasional outlet"
    >
      {ready ? (
        <>
          <svg className={styles.svg} width={size.w} height={size.h} aria-hidden>
            <defs>
              <radialGradient id="ops-drizzle">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.16" />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
              {labelPaths.map((lp) => (
                <path key={lp.id} id={lp.id} d={lp.d} fill="none" />
              ))}
            </defs>

            {/* ---- Pre-projected basemap ---- */}
            <g transform={groupTransform}>
              {base.blocks.map((d, i) => (
                <path key={`blk-${i}`} d={d} fill={i % 2 ? "#e7e9e3" : "#e9ebe5"} stroke="none" />
              ))}
              {base.areas.map((a, i) => (
                <path key={`ar-${i}`} d={a.d} fill={AREA_FILL[a.cls] ?? "#e5e7eb"} stroke="none" />
              ))}
              {(["river", "canal"] as const).map((cls) =>
                base.ways.filter((w) => w.cls === cls).map((w, i) => (
                  <path key={`${cls}-${i}`} d={w.d} fill="none" stroke={WAY_STYLE[cls]!.fill} strokeWidth={WAY_STYLE[cls]!.w} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )),
              )}
              {(["secondary", "arterial", "toll"] as const).map((cls) =>
                base.ways.filter((w) => w.cls === cls).map((w, i) => (
                  <path key={`${cls}-c-${i}`} d={w.d} fill="none" stroke={WAY_STYLE[cls]!.casing} strokeWidth={WAY_STYLE[cls]!.casingW} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )),
              )}
              {(["secondary", "arterial", "toll"] as const).map((cls) =>
                base.ways.filter((w) => w.cls === cls).map((w, i) => (
                  <path key={`${cls}-f-${i}`} d={w.d} fill="none" stroke={WAY_STYLE[cls]!.fill} strokeWidth={WAY_STYLE[cls]!.w} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )),
              )}
              {base.ways.filter((w) => w.cls === "mrt").map((w, i) => (
                <path key={`mrt-${i}`} d={w.d} fill="none" stroke={WAY_STYLE.mrt!.fill} strokeWidth={WAY_STYLE.mrt!.w} strokeDasharray={WAY_STYLE.mrt!.dash} vectorEffect="non-scaling-stroke" />
              ))}
              {base.ways.filter((w) => w.cls === "rail").map((w, i) => (
                <g key={`rail-${i}`}>
                  <path d={w.d} fill="none" stroke={WAY_STYLE.rail!.casing} strokeWidth={WAY_STYLE.rail!.casingW} vectorEffect="non-scaling-stroke" />
                  <path d={w.d} fill="none" stroke={WAY_STYLE.rail!.fill} strokeWidth={WAY_STYLE.rail!.w} strokeDasharray={WAY_STYLE.rail!.dash} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>

            {/* ---- Weather zones (operator-reported) ---- */}
            {weatherZones.map((z) => {
              const c = toScreen(z);
              const r = z.radiusM / mpp;
              return (
                <g key={z.zoneId}>
                  <circle cx={c.x} cy={c.y} r={r} fill="url(#ops-drizzle)" />
                  <circle cx={c.x} cy={c.y} r={r * 0.94} fill="none" stroke="#60a5fa" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="5 5" />
                </g>
              );
            })}

            {/* ---- Screen-space labels ---- */}
            {labelPaths.map((lp) => (
              <text key={lp.id} className={lp.cls === "toll" ? styles.tollLabel : lp.cls === "river" || lp.cls === "canal" ? styles.waterLabel : styles.roadLabel} dy={lp.cls === "river" || lp.cls === "canal" ? -4 : 3}>
                <textPath href={`#${lp.id}`} startOffset={`${lp.offset}%`}>{lp.name}</textPath>
              </text>
            ))}
            {STATIONS.map((st) => {
              const p = toScreen(st);
              return (
                <g key={st.name}>
                  <circle cx={p.x} cy={p.y} r={3.4} fill="#ffffff" stroke="#6b7280" strokeWidth={1.6} />
                  <text x={p.x + 6} y={p.y + 3} className={styles.stationLabel}>St. {st.name}</text>
                </g>
              );
            })}
            {PLACES.map((pl) => {
              const p = toScreen(pl);
              const cls = pl.rank === 1 ? styles.placeLabel1 : pl.rank === 2 ? styles.placeLabel2 : styles.placeLabel3;
              return (
                <text key={pl.name} x={p.x} y={p.y} className={cls}>{pl.name}</text>
              );
            })}

            {/* ---- Relocation traces ---- */}
            {events.filter((e) => e.kind === "RELOCATION" && e.from).map((e) => {
              const a = toScreen(e.from!);
              const b = toScreen(e);
              return (
                <g key={`${e.eventId}-trace`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7c3aed" strokeWidth={1.6} strokeDasharray="4 3" strokeOpacity={0.8} />
                  <circle cx={a.x} cy={a.y} r={4.5} fill="#ffffff" stroke="#7c3aed" strokeWidth={1.6} strokeOpacity={0.9} />
                </g>
              );
            })}

            {/* ---- Selection connector to the drawer ---- */}
            {selected && insetRight > 0 && selected.p.x < rightEdge - 24 ? (
              <g>
                <line x1={selected.p.x + 16} y1={selected.p.y} x2={rightEdge} y2={selected.p.y} stroke="#0f766e" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.9} />
                <circle cx={rightEdge} cy={selected.p.y} r={4} fill="#0f766e" stroke="#ffffff" strokeWidth={1.5} />
              </g>
            ) : null}
          </svg>

          {/* ---- HTML marker layer ---- */}
          <div className={styles.layer}>
            {weatherZones.map((z) => {
              const c = toScreen(z);
              const r = z.radiusM / mpp;
              return (
                <div key={`${z.zoneId}-pill`} className={styles.weatherPill} style={{ left: c.x, top: c.y - r * 0.94 - 6 }}>
                  <Icon name="drizzle" size={12} />
                  {z.label} · {fmtTime(z.at)}
                </div>
              );
            })}

            {events.map((e) => {
              const st = EVENT_STYLE[e.kind];
              let p = toScreen(e);
              if (e.kind === "RELOCATION" && e.from) {
                const a = toScreen(e.from);
                p = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
              }
              return (
                <div
                  key={e.eventId}
                  className={styles.eventMarker}
                  style={{ left: p.x, top: p.y, color: st.color }}
                  title={`${fmtTime(e.at)} · ${st.label} · ${e.label}`}
                  onPointerDown={(ev) => ev.stopPropagation()}
                >
                  <Icon name={st.icon} size={12} strokeWidth={2} />
                </div>
              );
            })}

            {clusters.map((c, i) => {
              const n = c.members.length;
              const r = 15.5;
              const C = 2 * Math.PI * r;
              const seg = C / n;
              return (
                <div
                  key={`cl-${i}`}
                  className={styles.cluster}
                  style={{ left: c.p.x, top: c.p.y }}
                  title={c.members.map((m) => m.s.code).join(" · ")}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={() => zoomAt((view?.zoom ?? DEFAULT_ZOOM) + 1.2, c.p)}
                >
                  <svg className={styles.clusterRing} viewBox="0 0 36 36" aria-hidden>
                    {c.members.map((m, j) => (
                      <circle
                        key={m.s.stallId}
                        cx="18"
                        cy="18"
                        r={r}
                        fill="none"
                        stroke={STATE_COLOR[m.s.state]}
                        strokeWidth="3.5"
                        strokeDasharray={`${seg - 1.5} ${C - seg + 1.5}`}
                        strokeDashoffset={-(j * seg)}
                        transform="rotate(-90 18 18)"
                      />
                    ))}
                  </svg>
                  <span>{n}</span>
                  <span className={styles.markerLabel} style={{ left: "calc(100% + 7px)" }}>{c.members[0]!.s.areaName} · {n} outlet</span>
                </div>
              );
            })}

            {singles.map(({ s, p }) => {
              const isSel = s.stallId === selectedId;
              const color = STATE_COLOR[s.state];
              return (
                <button
                  type="button"
                  key={s.stallId}
                  className={isSel ? styles.markerSelected : styles.marker}
                  style={{ left: p.x, top: p.y, background: color, color }}
                  aria-label={`${s.code} — ${s.statusLabel}`}
                  aria-pressed={isSel}
                  data-stall={s.code}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={() => onSelect(s.stallId)}
                  onPointerEnter={() => setHoverId(s.stallId)}
                  onPointerLeave={() => setHoverId((h) => (h === s.stallId ? null : h))}
                >
                  {isSel ? <span className={styles.markerRingOuter} /> : null}
                  {isSel ? <span className={styles.markerRing} /> : null}
                  <Icon name="store" size={isSel ? 15 : 13} strokeWidth={2.1} style={{ color: "#ffffff" }} />
                  <span className={isSel ? styles.markerLabelSelected : s.state === "offline" ? styles.markerLabelMuted : styles.markerLabel}>{s.code}</span>
                </button>
              );
            })}

            {hovered && hovered.s.stallId !== selectedId ? <HoverCard stall={hovered.s} p={hovered.p} asOf={asOf} size={size} rightEdge={rightEdge} avoid={selected?.p ?? null} /> : null}
          </div>

          {/* ---- Controls ---- */}
          <div className={styles.mapControls} style={{ right: insetRight + 12 }}>
            <div className={styles.ctrlGroup}>
              <button type="button" className={styles.ctrlBtn} aria-label="Perbesar" onClick={() => zoomStep(0.6)} onPointerDown={(e) => e.stopPropagation()}><Icon name="plus" size={16} /></button>
              <button type="button" className={styles.ctrlBtn} aria-label="Perkecil" onClick={() => zoomStep(-0.6)} onPointerDown={(e) => e.stopPropagation()}><Icon name="minus" size={16} /></button>
            </div>
            <div className={styles.ctrlGroup}>
              <button type="button" className={styles.ctrlBtn} aria-label="Tampilkan semua outlet" onClick={resetView} onPointerDown={(e) => e.stopPropagation()}><Icon name="locate" size={16} /></button>
              <button type="button" className={styles.ctrlBtn} aria-label="Lapisan peta" onPointerDown={(e) => e.stopPropagation()}><Icon name="layers" size={16} /></button>
            </div>
          </div>

          <div className={styles.scale} style={{ right: insetRight + 12, bottom: insetBottom > 0 ? insetBottom - 6 : 12 }}>
            <span>{scale.m >= 1000 ? `${scale.m / 1000} km` : `${scale.m} m`}</span>
            <div className={styles.scaleBar} style={{ width: scale.px }} />
          </div>

          {overlay}
        </>
      ) : null}
    </div>
  );
}

function HoverCard({ stall, p, asOf, size, rightEdge, avoid }: { stall: OpsMapStall; p: Pt; asOf: string; size: Size; rightEdge: number; avoid: Pt | null }) {
  const W = 232;
  const rows = 2 + (stall.attentionLabel ? 1 : 0) + (stall.sales ? 1 : 0) + (stall.traffic ? 1 : 0) + (stall.site ? 1 : 0) + (stall.security && stall.security.openCount > 0 ? 1 : 0);
  const H = 46 + rows * 19;
  const clampX = (x: number) => Math.min(Math.max(8, x), rightEdge - W - 8);
  const clampY = (y: number) => Math.min(Math.max(8, y), size.h - H - 8);
  // Candidate placements, in order of preference; the first one that neither leaves the
  // visible map nor covers the currently selected marker wins.
  const candidates: { left: number; top: number }[] = [
    { left: clampX(p.x - 12), top: p.y - 20 - H },
    { left: clampX(p.x - 12), top: p.y + 20 },
    { left: p.x + 22, top: clampY(p.y - H / 2) },
    { left: p.x - 22 - W, top: clampY(p.y - H / 2) },
  ];
  const fits = (c: { left: number; top: number }) => c.left >= 8 && c.left + W <= rightEdge - 8 && c.top >= 8 && c.top + H <= size.h - 8;
  // Selected marker + its label chip (extends ~110 px to the right) must stay visible.
  const coversSelected = (c: { left: number; top: number }) =>
    !!avoid && avoid.x + 110 > c.left - 4 && avoid.x - 22 < c.left + W + 4 && avoid.y + 22 > c.top - 4 && avoid.y - 22 < c.top + H + 4;
  const pick = candidates.find((c) => fits(c) && !coversSelected(c)) ?? candidates.find(fits) ?? { left: clampX(p.x - W / 2), top: clampY(p.y + 22) };
  const style = { left: pick.left, top: pick.top };
  return (
    <div className={styles.hoverCard} style={style} role="tooltip">
      <div className={styles.hoverHead}>
        <span className={styles.hoverTitle}>
          <span className={styles.stateDot} style={{ background: STATE_COLOR[stall.state] }} />
          {stall.code}
        </span>
        <Badge tone={stall.statusTone}>{stall.statusLabel}</Badge>
      </div>
      <div className={styles.hoverRow}><span>Operator</span><strong>{stall.operator.shortName}</strong></div>
      {stall.attentionLabel ? <div className={styles.hoverRow}><span>Status</span><strong>{stall.attentionLabel}</strong></div> : null}
      {stall.sales ? <div className={styles.hoverRow}><span>Penjualan</span><strong className={styles.mono}>{fmtRupiah(stall.sales.grossMinor)}</strong></div> : null}
      <div className={styles.hoverRow}><span>Posisi terakhir</span><strong>{fmtRelative(stall.position.reportedAt, asOf)}</strong></div>
      {stall.traffic ? <div className={styles.hoverRow}><span>Keramaian</span><strong>{stall.traffic.label}</strong></div> : null}
      {stall.site ? <div className={styles.hoverRow}><span>Cuaca</span><strong>{stall.site.weatherLabel}</strong></div> : null}
      {stall.security && stall.security.openCount > 0 ? <div className={styles.hoverRow}><span>Keamanan</span><strong>{stall.security.openCount} laporan aktif</strong></div> : null}
    </div>
  );
}

const TONE_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "#f3f4f6", fg: "#374151", border: "#e5e7eb" },
  ok: { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
  waiting: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
  attention: { bg: "#ffedd5", fg: "#9a3412", border: "#fed7aa" },
  blocked: { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
};

/** Compact status badge — same tones/geometry as FreshnessBadge & StatusBadge (radius 4, 11px/600). */
export function Badge({ tone, children, icon }: { tone: string; children: ReactNode; icon?: IconName }) {
  const t = TONE_STYLE[tone] ?? TONE_STYLE.neutral!;
  return (
    <span className={styles.badge} style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}` }}>
      {icon ? <Icon name={icon} size={11} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}
