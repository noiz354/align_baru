"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Marker = {
  id: string; name: string; areaId: string; coordinates: { latitude: number; longitude: number } | null;
  coordinateStatus: "AVAILABLE" | "MISSING"; locationStatus: string;
  operationalStatus: "OPERATING" | "ATTENTION" | "REVIEW" | "NOT_STARTED" | "CLOSED";
  hasActiveShift: boolean; positionSource: "LOCATION_REPORT" | "SHIFT_START" | "CONFIGURED_SITE";
  positionAt: string | null; freshnessBand: "current" | "recent" | "stale" | "unknown";
  salesMinor: number; transactionCount: number; openIncidentCount: number;
};
type MapData = {
  generatedAt: string; sourceWatermark: string | null; businessDay: string;
  filters: { areaId: string | null };
  summary: { visibleSellingPoints: number; activeSellingPoints: number; locationsWithCoordinates: number; activePointsWithoutCoordinates: number; staleLocationCount: number; openIncidentsOnActiveShifts: number };
  freshness: { currentWithinMinutes: number; recentWithinMinutes: number };
  areas: Array<{ id: string; label: string }>;
  markers: Marker[];
  pagination: { limit: number; total: number; nextCursor: string | null };
};

type GeoPoint = { latitude: number; longitude: number };
type MapTile = { key: string; url: string; left: number; top: number };
const TILE_SIZE = 256;
const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const shortTime = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "Belum ada laporan shift";
const statusName: Record<Marker["operationalStatus"], string> = { OPERATING: "Beroperasi", ATTENTION: "Perlu perhatian", REVIEW: "Perlu ditinjau", NOT_STARTED: "Belum mulai", CLOSED: "Tutup" };
const freshnessName: Record<Marker["freshnessBand"], string> = { current: "Baru dilaporkan", recent: "Laporan terbaru", stale: "Laporan lama", unknown: "Tidak diketahui" };
const sourceName: Record<Marker["positionSource"], string> = { LOCATION_REPORT: "Laporan lokasi eksplisit", SHIFT_START: "Lokasi awal shift", CONFIGURED_SITE: "Titik jual tersimpan" };

function worldPoint(point: GeoPoint, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function fitViewport(points: GeoPoint[], width: number, height: number, preferredZoom: number | null) {
  if (!points.length) return null;
  const center = {
    latitude: (Math.min(...points.map((point) => point.latitude)) + Math.max(...points.map((point) => point.latitude))) / 2,
    longitude: (Math.min(...points.map((point) => point.longitude)) + Math.max(...points.map((point) => point.longitude))) / 2,
  };
  let zoom = preferredZoom ?? 15;
  if (preferredZoom === null && points.length === 1) zoom = 14;
  else if (preferredZoom === null) {
    for (zoom = 18; zoom >= 3; zoom--) {
      const projected = points.map((point) => worldPoint(point, zoom));
      const spanX = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x));
      const spanY = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y));
      if (spanX <= width - 72 && spanY <= height - 72) break;
    }
    zoom = Math.max(3, zoom);
  }
  return { center, zoom };
}

function makeTiles(center: GeoPoint, zoom: number, width: number, height: number): MapTile[] {
  const centerWorld = worldPoint(center, zoom);
  const left = centerWorld.x - width / 2;
  const top = centerWorld.y - height / 2;
  const minX = Math.floor(left / TILE_SIZE);
  const maxX = Math.floor((left + width) / TILE_SIZE);
  const minY = Math.max(0, Math.floor(top / TILE_SIZE));
  const maxY = Math.min(2 ** zoom - 1, Math.floor((top + height) / TILE_SIZE));
  const tiles: MapTile[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const wrappedX = ((x % (2 ** zoom)) + 2 ** zoom) % 2 ** zoom;
      tiles.push({ key: `${zoom}/${x}/${y}`, url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`, left: x * TILE_SIZE - left, top: y * TILE_SIZE - top });
    }
  }
  return tiles;
}

function MapCanvas({ markers, selectedId, onSelect }: { markers: Marker[]; selectedId: string; onSelect: (marker: Marker) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 430 });
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: Math.max(300, Math.round(entry.contentRect.width)), height: 430 });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const points = useMemo(() => markers.flatMap((marker) => marker.coordinates ? [{ marker, point: marker.coordinates }] : []), [markers]);
  const viewport = useMemo(() => fitViewport(points.map(({ point }) => point), size.width, size.height, zoomOverride), [points, size.height, size.width, zoomOverride]);
  const tiles = useMemo(() => viewport ? makeTiles(viewport.center, viewport.zoom, size.width, size.height) : [], [size.height, size.width, viewport]);
  const centerWorld = viewport ? worldPoint(viewport.center, viewport.zoom) : null;
  const mapLeft = centerWorld ? centerWorld.x - size.width / 2 : 0;
  const mapTop = centerWorld ? centerWorld.y - size.height / 2 : 0;
  const tileCount = 2 ** (viewport?.zoom ?? 0);
  const markerPosition = (point: GeoPoint) => {
    if (!viewport) return { left: 0, top: 0 };
    const projected = worldPoint(point, viewport.zoom);
    let x = projected.x;
    // Place points across the antimeridian on the nearest wrapped world copy.
    while (x - (mapLeft + size.width / 2) > TILE_SIZE * tileCount / 2) x -= TILE_SIZE * tileCount;
    while ((mapLeft + size.width / 2) - x > TILE_SIZE * tileCount / 2) x += TILE_SIZE * tileCount;
    return { left: x - mapLeft, top: projected.y - mapTop };
  };
  const centerUrl = viewport ? `https://www.openstreetmap.org/?mlat=${viewport.center.latitude}&mlon=${viewport.center.longitude}#map=${viewport.zoom}/${viewport.center.latitude}/${viewport.center.longitude}` : "https://www.openstreetmap.org/";
  return <div ref={containerRef} role="region" aria-label="Peta titik penjualan" style={{ height: 430, position: "relative", overflow: "hidden", borderRadius: 12, background: "#e8eee9", isolation: "isolate" }}>
    {tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" aria-hidden="true" draggable={false} referrerPolicy="strict-origin-when-cross-origin" onError={() => setTileError(true)} style={{ position: "absolute", width: TILE_SIZE, height: TILE_SIZE, left: tile.left, top: tile.top, maxWidth: "none", userSelect: "none" }}/>) }
    {points.map(({ marker, point }) => {
      const position = markerPosition(point);
      if (position.left < -30 || position.left > size.width + 30 || position.top < -50 || position.top > size.height + 10) return null;
      const selected = marker.id === selectedId;
      return <button key={marker.id} type="button" aria-label={`${marker.name}, ${statusName[marker.operationalStatus]}`} aria-pressed={selected} onClick={() => onSelect(marker)} style={{ position: "absolute", zIndex: selected ? 4 : 3, left: position.left, top: position.top, transform: "translate(-50%, -100%)", border: 0, background: "transparent", padding: 0, cursor: "pointer", display: "grid", justifyItems: "center", gap: 3 }}>
        <span style={{ padding: "4px 7px", borderRadius: 7, background: selected ? "#143d32" : marker.hasActiveShift ? (marker.freshnessBand === "stale" ? "#a64a3e" : "#087960") : "#425b50", color: "white", fontSize: 11, fontWeight: 700, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", boxShadow: "0 2px 6px #17362740" }}>{marker.name}</span>
        <span aria-hidden="true" style={{ width: 15, height: 15, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: selected ? "#143d32" : marker.hasActiveShift ? (marker.freshnessBand === "stale" ? "#b65043" : "#119174") : "#63786d", border: "2px solid white", boxShadow: "0 1px 5px #17362745" }}/>
      </button>;
    })}
    {tileError && <div role="status" style={{ position: "absolute", zIndex: 5, left: 12, right: 70, top: 12, background: "#fff8e8", border: "1px solid #ead8aa", color: "#72571f", borderRadius: 8, padding: 9, fontSize: 12 }}>Peta dasar tidak dapat dimuat. Daftar titik dan status tetap tersedia.</div>}
    <div style={{ position: "absolute", zIndex: 6, right: 12, top: 12, display: "grid", overflow: "hidden", border: "1px solid #d8e1dc", borderRadius: 8, background: "white", boxShadow: "0 2px 8px #203c3318" }}><button type="button" aria-label="Perbesar peta" onClick={() => { setTileError(false); setZoomOverride(Math.min(19, (viewport?.zoom ?? 12) + 1)); }} style={zoomButton}>＋</button><button type="button" aria-label="Perkecil peta" onClick={() => { setTileError(false); setZoomOverride(Math.max(3, (viewport?.zoom ?? 12) - 1)); }} style={{ ...zoomButton, borderTop: "1px solid #e7ece9" }}>−</button></div>
    <a href={centerUrl} target="_blank" rel="noreferrer" style={{ position: "absolute", zIndex: 6, right: 6, bottom: 4, background: "#ffffffdc", padding: "2px 5px", borderRadius: 3, color: "#31534a", fontSize: 10 }}>© OpenStreetMap contributors</a>
    {!points.length && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64756d", padding: 20, textAlign: "center" }}>Belum ada koordinat titik yang dapat ditampilkan pada peta.</div>}
  </div>;
}

export default function OperationsMapPage() {
  const [map, setMap] = useState<MapData | null>(null);
  const [businessDay, setBusinessDay] = useState("");
  const [areaId, setAreaId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void loadMap(); }, []);

  async function loadMap(filters?: { businessDay?: string; areaId?: string; cursor?: string }) {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ limit: "50" });
    if (filters?.businessDay) query.set("businessDay", filters.businessDay);
    if (filters?.areaId) query.set("areaId", filters.areaId);
    if (filters?.cursor) query.set("cursor", filters.cursor);
    try {
      const response = await fetch(`/api/v1/operations/map?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Peta operasional tidak dapat dimuat.");
      const data = payload.data as MapData;
      setMap(data);
      setBusinessDay(data.businessDay);
      setAreaId(data.filters.areaId ?? "");
      setSelectedId((previous) => data.markers.some((marker) => marker.id === previous) ? previous : "");
    } catch (cause) {
      setMap(null);
      setError(cause instanceof Error ? cause.message : "Terjadi gangguan saat memuat peta.");
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessDay) return setError("Pilih tanggal bisnis untuk memuat status dan penjualan.");
    await loadMap({ businessDay, areaId });
  }

  async function selectMarker(marker: Marker) {
    setSelectedId(marker.id);
    // Analytics is intentionally ID-free; if this log endpoint is unavailable, map interaction still succeeds.
    void fetch("/api/v1/operations/map/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "map_marker_opened", markerType: marker.hasActiveShift ? "active_shift" : "configured_site" }),
    }).catch(() => undefined);
  }

  function refreshMap() {
    if (businessDay) void loadMap({ businessDay, areaId });
    else void loadMap();
  }

  const selectedMarker = map?.markers.find((marker) => marker.id === selectedId) ?? null;
  const activeReportAge = selectedMarker?.positionAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(selectedMarker.positionAt)) : null;

  return <main style={{ minHeight: "100vh", background: "#f5f8f6", color: "#203c33", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/" style={{ color: "inherit" }}>Beranda</a><span aria-hidden="true"> / </span><a href="/hq" style={{ color: "inherit" }}>Operasional</a><span aria-hidden="true"> / </span><strong style={{ color: "#173c34" }}>Peta operasi</strong></nav>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, margin: "0 0 6px" }}>LAPORAN TITIK JUAL · BUKAN PELACAKAN GPS</p><h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: 0, color: "#173c34" }}>Peta operasi</h1><p style={{ color: "#687a74", margin: "8px 0 0", maxWidth: 760 }}>Marker menunjukkan titik jual tersimpan dan laporan lokasi eksplisit per shift. Tidak ada posisi perangkat, nama operator, atau jejak pergerakan.</p></div>
        <button type="button" onClick={refreshMap} disabled={loading} style={secondaryButton}>{loading ? "Memuat…" : "Muat ulang"}</button>
      </header>

      <form onSubmit={(event) => void applyFilters(event)} aria-label="Filter peta operasi" style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 14 }}>
        <label style={labelStyle}>Tanggal bisnis<input type="date" value={businessDay} onChange={(event) => setBusinessDay(event.target.value)} required style={inputStyle}/></label>
        <label style={labelStyle}>Area<select value={areaId} onChange={(event) => setAreaId(event.target.value)} style={inputStyle}><option value="">Semua area yang dapat diakses</option>{map?.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>
        <button type="submit" disabled={loading} style={primaryButton}>Terapkan filter</button>
      </form>

      {error && <div role="alert" style={noticeStyle("error")}>{error}<button type="button" onClick={refreshMap} style={{ ...secondaryButton, marginLeft: 12 }}>Coba lagi</button></div>}
      {loading && <section style={panel} aria-live="polite"><div style={emptyStyle}>Memuat titik dan laporan lokasi yang dapat diakses…</div></section>}
      {!loading && map && <>
        <section aria-label="Ringkasan peta operasi" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12, marginBottom: 14 }}>
          <Metric label="Titik jual terlihat" value={String(map.summary.visibleSellingPoints)} note={`${map.summary.activeSellingPoints} dengan shift aktif di halaman ini`}/>
          <Metric label="Koordinat tersimpan" value={String(map.summary.locationsWithCoordinates)} note={`Pada halaman ini · ${map.summary.activePointsWithoutCoordinates} titik aktif tanpa koordinat`}/>
          <Metric label="Laporan lokasi lama" value={String(map.summary.staleLocationCount)} note="Lebih dari 60 menit di halaman ini; bukan posisi terkini"/>
          <Metric label="Insiden tertaut shift aktif" value={String(map.summary.openIncidentsOnActiveShifts)} note="Di halaman ini; tanpa deskripsi atau tingkat keparahan"/>
        </section>
        <section style={{ ...panel, marginBottom: 14 }} aria-labelledby="map-heading">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14, flexWrap: "wrap", marginBottom: 14 }}><div><h2 id="map-heading" style={{ margin: 0, fontSize: 18 }}>Titik jual yang dapat diakses</h2><p style={{ color: "#72817c", margin: "5px 0 0", fontSize: 13 }}>Hari bisnis {map.businessDay} · {map.pagination.total} titik dalam cakupan filter</p></div><span style={{ color: "#72817c", fontSize: 12 }}>Dihitung {shortTime(map.generatedAt)} · sumber {map.sourceWatermark ? shortTime(map.sourceWatermark) : "belum ada"}</span></div>
          {map.markers.length === 0 ? <div style={emptyStyle}>Belum ada titik jual pada area dan cakupan ini.</div> : <>
            <MapCanvas markers={map.markers} selectedId={selectedId} onSelect={(marker) => void selectMarker(marker)}/>
            <p style={{ color: "#778781", fontSize: 12, lineHeight: 1.5, margin: "10px 0 0" }}>Peta dasar dari OpenStreetMap. Lokasi hanya diperbarui melalui laporan operator yang eksplisit; “baru/lama” mengukur umur laporan, bukan akurasi GPS.</p>
          </>}
        </section>

        {selectedMarker && <section aria-label="Detail titik terpilih" style={{ ...panel, marginBottom: 14, borderLeft: "4px solid #13836c" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14, flexWrap: "wrap" }}><div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 11, letterSpacing: 1, margin: "0 0 5px" }}>TITIK TERPILIH</p><h2 style={{ margin: 0, fontSize: 19 }}>{selectedMarker.name}</h2><p style={{ color: "#72817c", fontSize: 13, margin: "5px 0 0" }}>Area {selectedMarker.areaId} · {selectedMarker.locationStatus} · {statusName[selectedMarker.operationalStatus]}</p></div><button type="button" onClick={() => setSelectedId("")} aria-label="Tutup detail titik" style={secondaryButton}>Tutup</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}><Detail label="Status posisi" value={selectedMarker.hasActiveShift ? freshnessName[selectedMarker.freshnessBand] : "Tidak ada shift aktif"}/><Detail label="Sumber posisi" value={sourceName[selectedMarker.positionSource]}/><Detail label="Waktu laporan" value={activeReportAge ?? "Tidak ada laporan shift aktif"}/><Detail label="Koordinat titik jual" value={selectedMarker.coordinates ? `${selectedMarker.coordinates.latitude.toFixed(5)}, ${selectedMarker.coordinates.longitude.toFixed(5)}` : "Belum tersimpan"}/><Detail label="Penjualan selesai" value={money(selectedMarker.salesMinor)}/><Detail label="Transaksi selesai" value={String(selectedMarker.transactionCount)}/><Detail label="Insiden terbuka tertaut" value={String(selectedMarker.openIncidentCount)}/></div><p style={{ color: "#72817c", fontSize: 12, margin: "12px 0 0" }}>Koordinat adalah milik titik jual yang tersimpan. Insiden dihitung hanya bila tertaut pada shift aktif ini; sumber tidak menyimpan lokasi tepat saat insiden.</p></section>}

        <section style={panel} aria-labelledby="point-list-title"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}><div><h2 id="point-list-title" style={{ margin: 0, fontSize: 18 }}>Daftar titik dan status</h2><p style={{ color: "#72817c", fontSize: 13, margin: "5px 0 0" }}>Tabel tersedia sebagai alternatif aksesibel untuk marker peta.</p></div><span style={{ color: "#72817c", fontSize: 12 }}>Peta hanya-baca · tidak membuat laporan</span></div>
          {map.markers.length === 0 ? <div style={emptyStyle}>Tidak ada baris untuk ditampilkan.</div> : <div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr>{["TITIK JUAL", "SHIFT", "STATUS OPERASI", "UMUR LAPORAN", "PENJUALAN", "INSIDEN", "KOORDINAT"].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr></thead><tbody>{map.markers.map((marker) => <tr key={marker.id}><td style={tdStyle}><button type="button" onClick={() => void selectMarker(marker)} style={linkButton}>{marker.name}</button><small style={{ display: "block", color: "#819089", marginTop: 4 }}>Area {marker.areaId}</small></td><td style={tdStyle}>{marker.hasActiveShift ? "Aktif" : "Tidak aktif"}</td><td style={tdStyle}><span style={badgeStyle(marker.operationalStatus)}>{statusName[marker.operationalStatus]}</span></td><td style={tdStyle}>{freshnessName[marker.freshnessBand]}</td><td style={tdStyle}>{money(marker.salesMinor)} · {marker.transactionCount} trx</td><td style={tdStyle}>{marker.openIncidentCount}</td><td style={tdStyle}>{marker.coordinates ? `${marker.coordinates.latitude.toFixed(4)}, ${marker.coordinates.longitude.toFixed(4)}` : "Belum tersedia"}</td></tr>)}</tbody></table></div>}
          {map.pagination.nextCursor && <button type="button" onClick={() => void loadMap({ businessDay, areaId, cursor: map.pagination.nextCursor ?? undefined })} disabled={loading} style={{ ...secondaryButton, marginTop: 14 }}>Muat titik berikutnya</button>}
        </section>
        <section aria-label="Sinyal lain" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}><UnavailableSignal title="Ringkasan lalu lintas" reason="Belum ada sampel lalu lintas tersimpan."/><UnavailableSignal title="Cuaca dan kondisi lokasi" reason="Belum ada pengamatan cuaca/site yang didukung."/></section>
      </>}
    </div>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article style={{ ...panel, minWidth: 0 }}><span style={{ color: "#718078", fontSize: 12, fontWeight: 700 }}>{label}</span><strong style={{ display: "block", fontSize: 24, color: "#173c34", margin: "8px 0 5px" }}>{value}</strong><small style={{ color: "#819089" }}>{note}</small></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div style={{ background: "#f7faf8", border: "1px solid #e9efec", borderRadius: 10, padding: 12 }}><span style={{ color: "#72817c", fontSize: 11 }}>{label}</span><strong style={{ display: "block", marginTop: 6, fontSize: 13, overflowWrap: "anywhere" }}>{value}</strong></div>; }
function UnavailableSignal({ title, reason }: { title: string; reason: string }) { return <article style={panel}><h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{title}</h3><p style={{ color: "#778781", fontSize: 13, margin: 0 }}>{reason}</p><span style={{ display: "inline-block", color: "#75837d", background: "#f0f4f1", borderRadius: 6, padding: "5px 8px", fontSize: 11, marginTop: 10 }}>Belum tersedia</span></article>; }

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1e9e5", borderRadius: 16, padding: "18px 20px", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const primaryButton: React.CSSProperties = { border: 0, background: "#087960", color: "white", fontWeight: 700, borderRadius: 10, padding: "11px 16px", minHeight: 44, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid #dbe5e0", background: "#fff", color: "#31534a", fontWeight: 600, borderRadius: 9, padding: "10px 13px", minHeight: 42, cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#4f655d", fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { minHeight: 42, minWidth: 160, border: "1px solid #dbe5e0", borderRadius: 9, padding: "8px 10px", color: "#203c33", background: "white", font: "inherit" };
const emptyStyle: React.CSSProperties = { padding: "30px 16px", textAlign: "center", color: "#778781", background: "#fafcfb", borderRadius: 12 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 880 };
const thStyle: React.CSSProperties = { textAlign: "left", fontSize: 10, letterSpacing: ".07em", color: "#819089", padding: "11px 9px", borderBottom: "1px solid #e9efec", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 9px", borderBottom: "1px solid #edf1ef", fontSize: 13, verticalAlign: "middle", whiteSpace: "nowrap" };
const zoomButton: React.CSSProperties = { width: 38, height: 38, border: 0, background: "white", color: "#31534a", fontSize: 20, cursor: "pointer" };
const linkButton: React.CSSProperties = { border: 0, background: "none", color: "#087960", padding: 0, font: "inherit", fontWeight: 700, cursor: "pointer", textAlign: "left" };
function badgeStyle(status: Marker["operationalStatus"]): React.CSSProperties { const active = status === "OPERATING"; return { display: "inline-block", borderRadius: 999, padding: "5px 9px", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: active ? "#087960" : status === "ATTENTION" ? "#946513" : "#5c6b65", background: active ? "#e2f5ee" : status === "ATTENTION" ? "#fff4da" : "#eef2f0" }; }
function noticeStyle(tone: "success" | "error"): React.CSSProperties { return { background: tone === "success" ? "#e8f7ef" : "#fff0ef", color: tone === "success" ? "#176b4f" : "#9f352b", border: `1px solid ${tone === "success" ? "#bfe6d1" : "#f0c8c4"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }; }
