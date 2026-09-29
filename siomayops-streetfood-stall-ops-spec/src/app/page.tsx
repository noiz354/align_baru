"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  dashboardResponseSchema,
  type DashboardActivity,
  type DashboardAlert,
  type DashboardReadModel,
  type DashboardStatus,
} from "@/shared/contracts/dashboard";
import { trackDashboardEvent } from "@/shared/analytics/dashboard";
import { DEFAULT_BUSINESS_DAY_CONFIG, toBusinessDay } from "@/shared/time/business-day";

type IconName =
  | "grid" | "activity" | "receipt" | "wallet" | "box" | "chart" | "settings" | "help"
  | "chevron" | "search" | "bell" | "plus" | "calendar" | "arrow" | "warning" | "clock"
  | "dots" | "filter" | "store" | "close" | "check" | "refresh";

type DashboardLoadError = {
  readonly status: number;
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL" | "NETWORK" | "CONTRACT";
  readonly message: string;
};

const STATUS_LABELS: Record<DashboardStatus, string> = {
  ALL: "Semua status",
  OPERATING: "Beroperasi",
  ATTENTION: "Perlu perhatian",
  REVIEW: "Perlu ditinjau",
  NOT_STARTED: "Belum mulai",
  CLOSED: "Tutup",
};

const STATUS_CLASSES: Record<Exclude<DashboardStatus, "ALL">, string> = {
  OPERATING: "status-operating",
  ATTENTION: "status-attention",
  REVIEW: "status-review",
  NOT_STARTED: "status-notstarted",
  CLOSED: "status-closed",
};

function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    activity: <><path d="M3 12h4l2.5-7 5 14 2.5-7h4"/><path d="M3 4.5v15" opacity="0"/></>,
    receipt: <><path d="M6 3.5h12a1 1 0 0 1 1 1v16l-3-1.8-4 1.8-4-1.8-3 1.8v-16a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 8h18M16 14h2M6 5V4a1 1 0 0 1 1-1h11"/></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9M8 5.2l8 4.5"/></>,
    chart: <><path d="M4 19.5V4.5M4 19.5h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M17 6h3v3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.8 1.8 0 0 0-.9-3H3.5a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.8c-1.1 1.1-1.9 1.4-1.9 3M12 17.5v.1"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    search: <><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    warning: <><path d="M10.3 4.6 2.7 18a1.5 1.5 0 0 0 1.3 2.2h16a1.5 1.5 0 0 0 1.3-2.2L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 16.5h.01"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    dots: <><circle cx="5" cy="12" r=".7" fill="currentColor"/><circle cx="12" cy="12" r=".7" fill="currentColor"/><circle cx="19" cy="12" r=".7" fill="currentColor"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    store: <><path d="M4 10v10h16V10M3 10l2-6h14l2 6a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-3 0 2.5 2.5 0 0 1-3 0 2.5 2.5 0 0 1-4 0Z"/><path d="M9 20v-5h6v5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.8 4L21 14M21 19v-5h-5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function getInitialBusinessDay(): string {
  return toBusinessDay(new Date(), DEFAULT_BUSINESS_DAY_CONFIG);
}

function formatRupiah(amountMinor: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(amountMinor)}`;
}

function formatCompactRupiah(amountMinor: number): string {
  const absolute = Math.abs(amountMinor);
  if (absolute >= 1_000_000) return `Rp ${(amountMinor / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (absolute >= 1_000) return `Rp ${(amountMinor / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return formatRupiah(amountMinor);
}

function formatPercentBps(bps: number): string {
  return `${(bps / 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatBusinessDay(day: string): string {
  const date = new Date(`${day}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
}

function formatTime(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(date);
}

function formatRelativeTime(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "waktu tidak tersedia";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function getErrorMessage(error: DashboardLoadError): string {
  if (error.code === "UNAUTHENTICATED") return "Sesi masuk diperlukan untuk membuka dashboard operasional.";
  if (error.code === "FORBIDDEN") return "Akun ini tidak memiliki akses ke dashboard HQ.";
  if (error.code === "NETWORK") return "Dashboard tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  if (error.code === "CONTRACT") return "Server mengirim data yang tidak sesuai kontrak dashboard.";
  return error.message;
}

function statusLabel(status: Exclude<DashboardStatus, "ALL">): string {
  return STATUS_LABELS[status];
}

function alertTone(alert: DashboardAlert): string {
  if (alert.severity === "CRITICAL") return "alert-red";
  if (alert.kind === "SHIFT_LOCATION_MISSING") return "alert-amber";
  if (alert.kind === "INCIDENT") return "alert-red";
  return "alert-yellow";
}

function alertIcon(alert: DashboardAlert): IconName {
  if (alert.kind === "SHIFT_LOCATION_MISSING") return "clock";
  if (alert.kind === "INCIDENT") return "warning";
  return "box";
}

function activityIcon(activity: DashboardActivity): IconName {
  if (activity.kind === "SALE") return "receipt";
  if (activity.kind === "EXPENSE") return "wallet";
  if (activity.kind === "PRODUCT") return "box";
  if (activity.kind === "SHIFT") return "check";
  return "activity";
}

function activityTone(activity: DashboardActivity): string {
  if (activity.kind === "SALE") return "timeline-sale";
  if (activity.kind === "EXPENSE") return "timeline-expense";
  if (activity.kind === "PRODUCT") return "timeline-product";
  return "timeline-start";
}

function SalesChart({ trend, businessDay }: { trend: DashboardReadModel["salesTrend"]; businessDay: string }) {
  const values = trend.map((point) => point.cumulativeMinor);
  const max = Math.max(...values, 0);
  const chartMax = max > 0 ? max : 1;
  const width = 700;
  const height = 145;
  const points = trend.map((point, index) => {
    const x = trend.length <= 1 ? 0 : (index / (trend.length - 1)) * width;
    const y = height - (point.cumulativeMinor / chartMax) * (height - 8);
    return `${x},${y}`;
  }).join(" ");
  const last = trend[trend.length - 1]?.cumulativeMinor ?? 0;
  const yLabels = [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0];

  if (trend.length === 0 || max === 0) {
    return <div className="chart-empty">Belum ada data penjualan untuk tanggal ini.</div>;
  }

  return <div className="chart-wrap" aria-label={`Grafik penjualan ${formatRupiah(last)} pada ${formatBusinessDay(businessDay)}`}>
    <div className="chart-y-labels">{yLabels.map((value, index) => <span key={`${value}-${index}`}>{formatCompactRupiah(Math.round(value))}</span>)}</div>
    <div className="chart-plot">
      <svg className="sales-svg" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="none" role="img" aria-label={`Penjualan terkumpul ${formatRupiah(last)}`}>
        <defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#15815d" stopOpacity=".14"/><stop offset="100%" stopColor="#15815d" stopOpacity="0"/></linearGradient></defs>
        {[5, 40, 75, 110, 145].map((y) => <line key={y} x1="0" y1={y} x2={width} y2={y} className="chart-grid"/>) }
        <polygon points={`0,145 ${points} ${width},145`} fill="url(#sales-fill)"/>
        <polyline points={points} fill="none" stroke="#16815c" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {trend.map((point, index) => {
          const x = trend.length <= 1 ? 0 : (index / (trend.length - 1)) * width;
          const y = height - (point.cumulativeMinor / chartMax) * (height - 8);
          return <circle key={`${point.label}-${index}`} cx={x} cy={y} r={index === trend.length - 1 ? 4 : 2.5} fill={index === trend.length - 1 ? "#fff" : "#16815c"} stroke="#16815c" strokeWidth={index === trend.length - 1 ? 2.5 : 0} vectorEffect="non-scaling-stroke"/>;
        })}
      </svg>
      <div className="chart-x-labels">{trend.map((point) => <span key={point.label}>{point.label}</span>)}</div>
    </div>
  </div>;
}

function LoadingDashboard() {
  return <section className="dashboard-state" aria-live="polite" aria-busy="true">
    <div className="state-spinner"><Icon name="refresh" size={20}/></div>
    <h2>Memuat dashboard operasional</h2>
    <p>Mengambil KPI, status outlet, peringatan, dan aktivitas dari server.</p>
    <div className="loading-grid" aria-hidden="true"><span/><span/><span/><span/></div>
  </section>;
}

function DashboardError({ error, onRetry }: { error: DashboardLoadError; onRetry: () => void }) {
  return <section className="dashboard-state dashboard-error-state" role="alert">
    <div className="state-error-icon"><Icon name={error.code === "FORBIDDEN" ? "close" : "warning"} size={20}/></div>
    <h2>{error.code === "FORBIDDEN" ? "Akses dashboard ditolak" : "Dashboard belum tersedia"}</h2>
    <p>{getErrorMessage(error)}</p>
    <button className="button button-primary" type="button" onClick={onRetry}><Icon name="refresh" size={14}/> Coba lagi</button>
  </section>;
}

function EmptyDashboard({ businessDay }: { businessDay: string }) {
  return <section className="dashboard-state" aria-live="polite">
    <div className="state-empty-icon"><Icon name="chart" size={21}/></div>
    <h2>Belum ada aktivitas</h2>
    <p>Belum ada data operasional tersimpan untuk {formatBusinessDay(businessDay)}.</p>
    <div className="empty-links"><a href="/operator/operation">Mulai operasional</a><a href="/sell">Buka transaksi</a></div>
  </section>;
}

export default function Page() {
  const [businessDay, setBusinessDay] = useState(getInitialBusinessDay);
  const [outletId, setOutletId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DashboardStatus>("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [data, setData] = useState<DashboardReadModel | null>(null);
  const [error, setError] = useState<DashboardLoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const requestNumber = useRef(0);

  const loadDashboard = useCallback(async (signal: AbortSignal) => {
    const currentRequest = ++requestNumber.current;
    setLoading(true);
    const params = new URLSearchParams({ date: businessDay, status, limit: "6" });
    if (outletId) params.set("outletId", outletId);
    if (areaId) params.set("areaId", areaId);
    if (search.trim()) params.set("search", search.trim());
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await fetch(`/api/v1/hq/dashboard?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const responseError = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
        const details = responseError && typeof responseError === "object" && "message" in responseError ? String(responseError.message) : "Server menolak permintaan dashboard.";
        const codeValue = responseError && typeof responseError === "object" && "code" in responseError ? String(responseError.code) : "INTERNAL";
        const allowedCodes: DashboardLoadError["code"][] = ["UNAUTHENTICATED", "FORBIDDEN", "VALIDATION_ERROR", "NOT_FOUND", "INTERNAL"];
        throw { status: response.status, code: allowedCodes.includes(codeValue as DashboardLoadError["code"]) ? codeValue as DashboardLoadError["code"] : "INTERNAL", message: details } satisfies DashboardLoadError;
      }
      const parsed = dashboardResponseSchema.safeParse(payload);
      if (!parsed.success) throw { status: 500, code: "CONTRACT", message: "Respons dashboard tidak lolos validasi kontrak." } satisfies DashboardLoadError;
      if (currentRequest !== requestNumber.current) return;
      setData(parsed.data.data);
      setError(null);
      trackDashboardEvent({ event: "dashboard_viewed", page: "dashboard", businessDay: parsed.data.data.scope.businessDay, status, ...(outletId ? { outletId } : {}), ...(areaId ? { areaId } : {}), hasSearch: Boolean(search.trim()), outcome: "success" });
    } catch (caught) {
      if (signal.aborted || currentRequest !== requestNumber.current) return;
      const loadError: DashboardLoadError = caught && typeof caught === "object" && "code" in caught
        ? caught as DashboardLoadError
        : { status: 0, code: "NETWORK", message: "Network request failed" };
      setError(loadError);
      trackDashboardEvent({ event: "dashboard_error_shown", page: "dashboard", status, ...(areaId ? { areaId } : {}), errorCode: loadError.code === "CONTRACT" ? "INTERNAL" : loadError.code, outcome: "failure" });
    } finally {
      if (!signal.aborted && currentRequest === requestNumber.current) setLoading(false);
    }
  }, [areaId, businessDay, cursor, outletId, search, status]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const updateFilter = useCallback((kind: "date" | "outlet" | "area" | "status" | "search", value: string) => {
    setCursor(null);
    if (kind === "date") setBusinessDay(value);
    if (kind === "outlet") setOutletId(value);
    if (kind === "area") {
      setAreaId(value);
      setOutletId("");
    }
    if (kind === "status") setStatus(value as DashboardStatus);
    if (kind === "search") setSearch(value);
    trackDashboardEvent({
      event: "dashboard_filter_changed",
      page: "dashboard",
      ...(kind === "date" ? { businessDay: value } : { businessDay }),
      ...(kind === "status" ? { status: value as DashboardStatus } : { status }),
      ...(kind === "outlet" && value ? { outletId: value } : kind !== "area" && outletId ? { outletId } : {}),
      ...(kind === "area" && value ? { areaId: value } : areaId ? { areaId } : {}),
      hasSearch: kind === "search" ? Boolean(value.trim()) : Boolean(search.trim()),
    });
  }, [areaId, businessDay, outletId, search, status]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal).finally(() => controller.abort());
  }, [loadDashboard]);

  const hasOperationalData = Boolean(data && (data.kpis.transactionCount > 0 || data.kpis.activeOutlets > 0 || data.outlets.length > 0 || data.alerts.length > 0 || data.activity.length > 0));
  const selectedOutletName = data?.outletOptions.find((outlet) => outlet.id === outletId)?.name;
  const areaOptions = data?.areaOptions ?? [];
  const dateLabel = data?.scope.businessDay ?? businessDay;
  const maxTrend = useMemo(() => Math.max(...(data?.salesTrend.map((point) => point.cumulativeMinor) ?? [0])), [data]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="SiomayOps Dashboard">
        <span className="brand-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 4.7c-1.6 0-2.9 1.3-2.9 2.9 0 1 .5 1.8 1.2 2.3v3.3c-5.4.9-9.4 5.5-9.4 11.1v3.2c0 1.7 1.4 3.1 3.1 3.1h16c1.7 0 3.1-1.4 3.1-3.1v-3.2c0-5.6-4-10.2-9.4-11.1V9.9c.7-.5 1.2-1.3 1.2-2.3 0-1.6-1.3-2.9-2.9-2.9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 22h.1m5.9-2v.1m6 4.9h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M11 30v2m14-2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
        <span className="brand-name">siomay<span>ops</span><small>OPERATIONS</small></span>
      </a>
      <div className="nav-caption">MENU UTAMA</div>
      <nav className="primary-nav" aria-label="Navigasi utama">
        <a className="nav-link active" href="/"><Icon name="grid"/><span>Dashboard</span></a>
        <a className="nav-link" href="/hq"><Icon name="activity"/><span>Operasional</span><span className="nav-count">{data?.alerts.length ?? "—"}</span></a>
        <a className="nav-link" href="/sell"><Icon name="receipt"/><span>Transaksi</span></a>
        <a className="nav-link" href="/expenses"><Icon name="wallet"/><span>Pengeluaran</span></a>
        <a className="nav-link" href="/stock"><Icon name="box"/><span>Produk &amp; Harga</span></a>
        <a className="nav-link" href="/hq"><Icon name="chart"/><span>Laporan</span></a>
      </nav>
      <div className="sidebar-bottom">
        <a className="nav-link" href="/settings"><Icon name="settings"/><span>Pengaturan</span></a>
        <a className="nav-link" href="/help"><Icon name="help"/><span>Bantuan</span></a>
        <div className="profile-card"><div className="avatar avatar-profile">HQ</div><div className="profile-info"><strong>HQ Ops</strong><span>Data dari sesi aktif</span></div></div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <label className="outlet-select" aria-label="Pilih cakupan outlet"><span className="outlet-icon"><Icon name="store" size={16}/></span><select value={outletId} onChange={(event) => updateFilter("outlet", event.target.value)} disabled={!data}><option value="">Semua outlet</option>{data?.outletOptions.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select><Icon name="chevron" size={15}/></label>
        <div className="topbar-right">
          <label className="area-select" aria-label="Pilih area"><Icon name="filter" size={15}/><select value={areaId} onChange={(event) => updateFilter("area", event.target.value)} disabled={!data}><option value="">Semua area</option>{areaOptions.map((area) => <option key={area.id} value={area.id}>{area.id}</option>)}</select><Icon name="chevron" size={14}/></label>
          <label className="top-date" title="Tanggal business day"><Icon name="calendar" size={16}/><input aria-label="Tanggal operasional" type="date" value={businessDay} onChange={(event) => updateFilter("date", event.target.value)}/></label>
          <label className="quick-search"><input aria-label="Cari outlet atau operator" value={search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Cari outlet..."/><span className="icon-button" aria-hidden="true"><Icon name="search"/></span></label>
          <a className="icon-button notification-button" aria-label="Buka notifikasi" href="/alerts"><Icon name="bell" size={19}/>{data && data.alerts.length > 0 && <i/>}</a>
          <div className="avatar avatar-top" aria-label="Sesi HQ Ops">HQ</div>
        </div>
      </header>

      <main className="page-content" aria-busy={loading}>
        <div className="page-heading">
          <div><div className="eyebrow"><span className="live-dot"/>OPERASIONAL <span className="eyebrow-divider">/</span> {formatBusinessDay(dateLabel)}</div><h1>Dashboard Operasional</h1><p>{selectedOutletName ? `Ringkasan ${selectedOutletName}` : "Ringkasan seluruh outlet dalam cakupan sesi ini"}</p></div>
          <div className="heading-actions"><button className="button button-secondary" type="button" onClick={refresh} disabled={loading}><Icon name="refresh" size={14}/> {loading ? "Memuat..." : "Perbarui"}</button><a className="button button-secondary" href="/expenses"><Icon name="wallet" size={14}/> Catat pengeluaran</a><a className="button button-primary" href="/sell"><Icon name="plus" size={14}/> Catat transaksi</a></div>
        </div>

        {error && data && <div className="inline-data-warning" role="status"><Icon name="warning" size={15}/><span>Data terakhir berhasil dimuat. Pembaruan terbaru gagal: {getErrorMessage(error)}</span><button type="button" onClick={refresh}>Coba lagi</button></div>}
        {!data && loading && <LoadingDashboard/>}
        {!data && !loading && error && <DashboardError error={error} onRetry={refresh}/>}        {data && !hasOperationalData && !loading && <EmptyDashboard businessDay={dateLabel}/>}

        {data && (hasOperationalData || loading) && <>
          <section className="kpi-grid" aria-label="KPI operasional">
            <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Penjualan terverifikasi</span><span className="kpi-icon green-icon"><Icon name="chart" size={17}/></span></div><div className="kpi-main"><strong>{formatRupiah(data.kpis.salesMinor)}</strong>{data.kpis.salesChangeBps !== null && <span className={`trend-up ${data.kpis.salesChangeBps < 0 ? "trend-down" : ""}`}>{data.kpis.salesChangeBps >= 0 ? "↑" : "↓"} {formatPercentBps(Math.abs(data.kpis.salesChangeBps))}</span>}</div><div className="kpi-foot">Tunai {formatRupiah(data.kpis.cashSalesMinor)} · Digital terverifikasi {formatRupiah(data.kpis.digitalVerifiedMinor)}</div></article>
            <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Transaksi</span><span className="kpi-icon blue-icon"><Icon name="receipt" size={17}/></span></div><div className="kpi-main"><strong>{new Intl.NumberFormat("id-ID").format(data.kpis.transactionCount)}</strong></div><div className="kpi-foot">Rata-rata {formatRupiah(data.kpis.averageTransactionMinor)} / transaksi</div></article>
            <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Pengeluaran</span><span className="kpi-icon amber-icon"><Icon name="wallet" size={17}/></span></div><div className="kpi-main"><strong>{formatRupiah(data.kpis.expensesMinor)}</strong></div><div className="kpi-foot"><span className="expense-meter"><i style={{ width: `${Math.min(100, Math.max(0, data.kpis.expenseRatioBps / 100))}%` }}/></span><b>{formatPercentBps(data.kpis.expenseRatioBps)}</b> dari penjualan</div></article>
            <article className="kpi-card outlet-kpi"><div className="kpi-top"><span className="kpi-label">Outlet aktif</span><span className="kpi-icon teal-icon"><Icon name="store" size={17}/></span></div><div className="kpi-main"><strong>{data.kpis.activeOutlets} <span className="kpi-total">/ {data.kpis.totalOutlets}</span></strong><span className="status-mini"><i/> beroperasi</span></div><div className="kpi-foot"><span className="subtle-alert-dot"/>{data.kpis.notStartedOutlets} belum mulai operasi</div></article>
          </section>

          <section className="overview-grid">
            <article className="panel chart-card">
              <div className="panel-heading chart-heading"><div><div className="panel-title-row"><h2>Penjualan {selectedOutletName ?? "Hari Ini"}</h2><span className="chart-live"><i/> SERVER</span></div><div className="chart-total">{formatRupiah(data.kpis.salesMinor)} <span className="chart-change">{data.kpis.digitalUnverifiedMinor > 0 ? `· ${formatRupiah(data.kpis.digitalUnverifiedMinor)} belum diverifikasi` : "· seluruh digital terverifikasi"}</span></div></div><span className="data-freshness">{loading ? "Memperbarui..." : "Data saat ini"}</span></div>
              <SalesChart trend={data.salesTrend} businessDay={dateLabel}/>
              <div className="chart-foot"><span><i className="legend-dot"/>Penjualan terverifikasi terkumpul</span><span>{data.sourceWatermark ? `Sumber sampai ${formatTime(data.sourceWatermark)} WIB` : "Belum ada watermark sumber"}</span></div>
            </article>

            <article className="panel attention-card">
              <div className="panel-heading attention-heading"><div><h2>Perlu perhatian</h2><p>{data.alerts.length === 0 ? "Tidak ada peringatan terbuka" : `${data.alerts.length} hal membutuhkan tindak lanjut`}</p></div><a className="icon-button more-button" aria-label="Buka semua peringatan" href="/alerts">···</a></div>
              <div className="alert-list">{data.alerts.length === 0 && <div className="section-empty">Tidak ada alert untuk cakupan dan tanggal ini.</div>}{data.alerts.slice(0, 3).map((alert) => <div className="alert-row" key={`${alert.kind}-${alert.id}`}><span className={`alert-icon ${alertTone(alert)}`}><Icon name={alertIcon(alert)} size={17}/></span><div className="alert-copy"><div className="alert-title">{alert.outletName ?? alert.title} <span className={`alert-tag ${alert.severity === "CRITICAL" ? "tag-red" : "tag-amber"}`}>{alert.title}</span></div><p>{alert.description}</p>{alert.href ? <a className="text-action" href={alert.href} onClick={() => { if (alert.outletId) trackDashboardEvent({ event: "dashboard_outlet_opened", page: "dashboard", businessDay: dateLabel, outletId: alert.outletId }); }}>Buka detail <Icon name="arrow" size={13}/></a> : <span className="unsupported-action">Detail belum tersedia</span>}</div><span className="alert-time">{formatTime(alert.createdAt)}</span></div>)}</div>
              {data.alerts.length > 3 && <a className="all-alerts" href="/alerts">Lihat semua peringatan <Icon name="arrow" size={14}/></a>}
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel outlet-table-card">
              <div className="table-heading"><div><div className="table-title-line"><h2>Status outlet</h2><span className="outlet-count">{data.pagination.total} outlet terdaftar</span></div><p>Pantau performa dan status operasional outlet</p></div><div className="table-tools"><label className="table-search"><Icon name="search" size={15}/><input value={search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Cari outlet" aria-label="Cari outlet pada tabel"/><kbd>⌘ K</kbd></label><label className="filter-button"><Icon name="filter" size={16}/><select aria-label="Filter status outlet" value={status} onChange={(event) => updateFilter("status", event.target.value)}>{(Object.keys(STATUS_LABELS) as DashboardStatus[]).map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label></div></div>
              <div className="table-scroll">{data.outlets.length === 0 ? <div className="empty-state">{search || status !== "ALL" ? "Tidak ada outlet yang cocok dengan filter ini." : "Belum ada outlet dalam cakupan sesi ini."}</div> : <table><thead><tr><th>OUTLET</th><th>OPERATOR</th><th>MULAI</th><th>PENJUALAN</th><th>PENGELUARAN</th><th>STATUS</th><th aria-label="Aksi"/></tr></thead><tbody>{data.outlets.map((outlet) => <tr key={outlet.id}><td><a className="outlet-name-cell outlet-link" href={`/hq/outlets/${encodeURIComponent(outlet.id)}?date=${encodeURIComponent(dateLabel)}`} onClick={() => trackDashboardEvent({ event: "dashboard_outlet_opened", page: "dashboard", businessDay: dateLabel, outletId: outlet.id })}><span className={`store-avatar store-${outlet.status === "NOT_STARTED" || outlet.status === "CLOSED" ? "muted" : "green"}`}><Icon name="store" size={15}/></span><strong>{outlet.name}</strong></a></td><td><span className="operator-name">{outlet.operatorName ?? "Belum ditugaskan"}</span></td><td className={outlet.startedAt ? "time-cell" : "muted-cell"}>{outlet.startedAt ? formatTime(outlet.startedAt) : "—"}</td><td className="money-cell">{formatRupiah(outlet.salesMinor)}</td><td className="money-cell expense-cell">{formatRupiah(outlet.expensesMinor)}</td><td><span className={`status-badge ${STATUS_CLASSES[outlet.status]}`}><i/>{statusLabel(outlet.status)}</span></td><td><a className="row-menu" aria-label={`Buka detail ${outlet.name}`} href={`/hq/outlets/${encodeURIComponent(outlet.id)}?date=${encodeURIComponent(dateLabel)}`}><Icon name="arrow" size={15}/></a></td></tr>)}</tbody></table>}</div>
              <div className="table-footer"><span>Menampilkan <b>{data.outlets.length}</b> dari <b>{data.pagination.total}</b> outlet</span>{data.pagination.nextCursor ? <button type="button" onClick={() => setCursor(data.pagination.nextCursor)} disabled={loading}>Muat outlet berikutnya <Icon name="arrow" size={13}/></button> : <a href="/hq">Buka operasional <Icon name="arrow" size={13}/></a>}</div>
            </article>
            <article className="panel activity-card"><div className="activity-heading"><div><h2>Aktivitas terbaru</h2><p>Aktivitas yang tercatat hari ini</p></div><a className="icon-button more-button" aria-label="Buka audit aktivitas" href="/alerts">···</a></div><div className="activity-list">{data.activity.length === 0 && <div className="section-empty">Belum ada aktivitas tercatat.</div>}{data.activity.map((activity, index) => <div className="activity-entry" key={activity.id}><span className={`activity-timeline ${index === data.activity.length - 1 ? "last" : ""}`}><i className={activityTone(activity)}><Icon name={activityIcon(activity)} size={14}/></i></span><div><p>{activity.outletName && <b>{activity.outletName} </b>}{activity.description}{activity.amountMinor !== null && <> <strong>{formatRupiah(activity.amountMinor)}</strong></>}{activity.secondary && <small>{activity.secondary}</small>}</p><time>{formatTime(activity.occurredAt)} <span>· {formatRelativeTime(activity.occurredAt)}</span></time></div></div>)}</div><a className="activity-all" href="/alerts">Lihat riwayat aktivitas <Icon name="arrow" size={13}/></a></article>
          </section>
          <footer className="page-footer"><span>SiomayOps <i>•</i> Sumber terakhir {formatTime(data.generatedAt)} WIB</span><span><i className="sync-dot"/>{maxTrend > 0 ? "Data tersimpan di server" : "Menunggu aktivitas tersimpan"}</span></footer>
        </>}
      </main>
    </div>
  </div>;
}
