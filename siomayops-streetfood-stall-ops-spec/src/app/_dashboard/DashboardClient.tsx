"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HqDashboardReadModel, OutletStatus } from "@/features/hq/dashboard";
import { Icon } from "./Icon";
import {
  ACTIVITY_ICON, ACTIVITY_TONE, STATUS_PRESENTATION, alertHref, buildQuery, chartGeometry, compactRupiah,
  formatBps, formatClock, formatDayMonth, formatLongDay, formatShortDay, presentAlert, rupiah,
} from "./format";

export interface DashboardViewer { readonly roleLabel: string; readonly initials: string; readonly canExport: boolean }

function SalesChart({ trend, totalMinor }: { trend: HqDashboardReadModel["salesTrend"]; totalMinor: number }) {
  const geometry = chartGeometry(trend);
  const line = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  const last = geometry.points[geometry.points.length - 1];
  return <div className="chart-wrap" aria-label="Grafik penjualan kumulatif per jam">
    <div className="chart-y-labels">{geometry.yLabels.map((label, index) => <span key={index}>{label}</span>)}</div>
    <div className="chart-plot">
      <svg className="sales-svg" viewBox="0 0 700 165" preserveAspectRatio="none" role="img" aria-label={`Penjualan kumulatif ${rupiah(totalMinor)}`}>
        <defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#15815d" stopOpacity=".14"/><stop offset="100%" stopColor="#15815d" stopOpacity="0"/></linearGradient></defs>
        {[5, 40, 75, 110, 145].map((y) => <line key={y} x1="0" y1={y} x2="700" y2={y} className="chart-grid"/>)}
        {geometry.points.length > 1 && <>
          <polygon points={`0,165 ${line} 700,165`} fill="url(#sales-fill)"/>
          <polyline points={line} fill="none" stroke="#16815c" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </>}
        {geometry.points.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r={point === last ? 4 : 2.5} fill={point === last ? "#fff" : "#16815c"} stroke="#16815c" strokeWidth={point === last ? 2.5 : 0} vectorEffect="non-scaling-stroke"/>)}
      </svg>
      <div className="chart-x-labels">{geometry.points.map((point) => <span key={point.label}>{point.label}</span>)}</div>
    </div>
  </div>;
}

export default function DashboardClient({ model, viewer }: { model: HqDashboardReadModel; viewer: DashboardViewer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OutletStatus>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [modal, setModal] = useState<"transaction" | "expense" | null>(null);
  const [toast, setToast] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);

  const day = model.scope.businessDay;
  const outletId = model.scope.outletId;
  const { kpis } = model;
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const navigate = (next: { date?: string; outletId?: string | null }) => {
    const query = buildQuery({ date: next.date ?? day, outletId: next.outletId === undefined ? outletId : next.outletId });
    startTransition(() => router.push(`/${query}`));
  };

  // Client filtering only narrows rows the server has already scoped; it is display, not authorization.
  const visibleOutlets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return model.outlets.filter((outlet) => {
      if (statusFilter !== "ALL" && outlet.status !== statusFilter) return false;
      if (!needle) return true;
      return `${outlet.name} ${outlet.operatorName ?? ""} ${STATUS_PRESENTATION[outlet.status].label}`.toLowerCase().includes(needle);
    });
  }, [model.outlets, search, statusFilter]);

  const hasAnyActivity = kpis.transactionCount > 0 || kpis.expensesMinor > 0 || kpis.activeOutlets > 0 || model.activity.length > 0;
  const changeBps = kpis.salesChangeBps;
  const scopeLabel = outletId ? (model.outletOptions.find((option) => option.id === outletId)?.name ?? "Outlet") : "Semua Outlet";
  const scopeNoun = outletId ? scopeLabel : "seluruh outlet";
  const exportHref = `/api/v1/hq/dashboard/export${buildQuery({ date: day, outletId })}`;
  const sparkMax = Math.max(1, ...model.salesTrend.map((point) => point.cumulativeMinor));
  const spark = model.salesTrend.map((point, index) => `${index === 0 ? "M" : "L"}${Math.round((index / Math.max(1, model.salesTrend.length - 1)) * 88) + 1} ${Math.round(22 - (point.cumulativeMinor / sparkMax) * 20)}`).join(" ");

  return <div className="app-shell" aria-busy={pending}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="SiomayOps Dashboard">
        <span className="brand-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 4.7c-1.6 0-2.9 1.3-2.9 2.9 0 1 .5 1.8 1.2 2.3v3.3c-5.4.9-9.4 5.5-9.4 11.1v3.2c0 1.7 1.4 3.1 3.1 3.1h16c1.7 0 3.1-1.4 3.1-3.1v-3.2c0-5.6-4-10.2-9.4-11.1V9.9c.7-.5 1.2-1.3 1.2-2.3 0-1.6-1.3-2.9-2.9-2.9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 22h.1m5.9-2v.1m6 4.9h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M11 30v2m14-2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
        <span className="brand-name">siomay<span>ops</span><small>OPERATIONS</small></span>
      </a>
      <div className="nav-caption">MENU UTAMA</div>
      <nav className="primary-nav" aria-label="Navigasi utama">
        <a className="nav-link active" href="/" aria-current="page"><Icon name="grid"/><span>Dashboard</span></a>
        <a className="nav-link" href="/hq"><Icon name="activity"/><span>Operasional</span>{model.alerts.length > 0 && <span className="nav-count">{model.alerts.length}</span>}</a>
        <a className="nav-link" href="/sell"><Icon name="receipt"/><span>Transaksi</span></a>
        <a className="nav-link" href="/expenses"><Icon name="wallet"/><span>Pengeluaran</span></a>
        <a className="nav-link" href="/stock"><Icon name="box"/><span>Produk &amp; Harga</span></a>
        <a className="nav-link" href="/hq"><Icon name="chart"/><span>Laporan</span></a>
      </nav>
      <div className="sidebar-bottom">
        <span className="nav-link" aria-disabled="true" title="Belum tersedia"><Icon name="settings"/><span>Pengaturan</span></span>
        <span className="nav-link" aria-disabled="true" title="Belum tersedia"><Icon name="help"/><span>Bantuan</span></span>
        <div className="profile-card"><div className="avatar avatar-profile">{viewer.initials}</div><div className="profile-info"><strong>{viewer.roleLabel}</strong><span>Sesi pengembangan</span></div></div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <label className="outlet-select" aria-label="Pilih cakupan outlet">
          <span className="outlet-icon"><Icon name="store" size={16}/></span>
          <select value={outletId ?? ""} onChange={(event) => navigate({ outletId: event.target.value || null })} aria-label="Outlet">
            <option value="">Semua Outlet</option>
            {model.outletOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <div className="topbar-right">
          <label className="top-date"><Icon name="calendar" size={16}/><input type="date" value={day} onChange={(event) => event.target.value && navigate({ date: event.target.value })} aria-label="Tanggal bisnis"/></label>
          <div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifikasi" aria-expanded={notificationOpen} onClick={() => setNotificationOpen(!notificationOpen)}><Icon name="bell" size={19}/>{model.alerts.length > 0 && <i/>}</button>{notificationOpen && <div className="notification-popover"><strong>Notifikasi</strong>{model.alerts.length === 0 ? <span className="notification-item"><b>Tidak ada perhatian khusus</b></span> : model.alerts.slice(0, 3).map((alert) => <span className="notification-item" key={`${alert.kind}-${alert.id}`}><b>{alert.outletName ?? alert.title}</b><small>{alert.description}</small></span>)}</div>}</div>
          <span className="avatar avatar-top" aria-label={viewer.roleLabel}>{viewer.initials}</span>
        </div>
      </header>

      <main className="page-content" id="dashboard">
        <div className="page-heading">
          <div><div className="eyebrow"><span className="live-dot"/>OPERASIONAL <span className="eyebrow-divider">/</span> DASHBOARD</div><h1>Operasional Hari Ini</h1><p>Ringkasan aktivitas {scopeNoun} — {formatLongDay(day)}</p></div>
          <div className="heading-actions">
            {viewer.canExport && <a className="button button-secondary" href={exportHref} download>Ekspor CSV</a>}
            <button className="button button-secondary" onClick={() => setModal("expense")}><Icon name="plus" size={17}/>Catat Pengeluaran</button>
            <button className="button button-primary" onClick={() => setModal("transaction")}><Icon name="plus" size={17}/>Catat Transaksi</button>
          </div>
        </div>

        {!hasAnyActivity && <div className="empty-state" role="status">Belum ada aktivitas operasional pada {formatShortDay(day)}.</div>}

        <section className="kpi-grid" aria-label="Ringkasan hari ini">
          <article className="kpi-card sales-kpi"><div className="kpi-top"><span className="kpi-label">Penjualan Hari Ini</span><span className="kpi-icon green-icon"><Icon name="chart" size={17}/></span></div><div className="kpi-main"><strong>{rupiah(kpis.salesMinor)}</strong>{changeBps !== null && <span className={changeBps >= 0 ? "trend-up" : "trend-down"}>{changeBps >= 0 ? "↑" : "↓"} {formatBps(Math.abs(changeBps))}</span>}</div><div className="kpi-foot">{changeBps === null ? "Belum ada pembanding hari sebelumnya" : "dibanding hari sebelumnya"}<span className="comparison-period"> · {rupiah(kpis.previousDaySalesMinor)}</span></div><div className="mini-spark" aria-hidden="true"><svg viewBox="0 0 90 24"><path d={spark} fill="none" stroke="#35a47a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div></article>
          <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Transaksi</span><span className="kpi-icon blue-icon"><Icon name="receipt" size={17}/></span></div><div className="kpi-main"><strong>{kpis.transactionCount.toLocaleString("id-ID")}</strong></div><div className="kpi-foot">Rata-rata <b>{rupiah(kpis.averageTransactionMinor)}</b> / transaksi</div></article>
          <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Pengeluaran</span><span className="kpi-icon amber-icon"><Icon name="wallet" size={17}/></span></div><div className="kpi-main"><strong>{rupiah(kpis.expensesMinor)}</strong></div><div className="kpi-foot">{kpis.salesMinor > 0 ? <><span className="expense-meter"><i style={{ width: `${Math.min(100, kpis.expenseRatioBps / 100)}%` }}/></span><b>{formatBps(kpis.expenseRatioBps)}</b> dari penjualan</> : "Rasio belum dapat dihitung tanpa penjualan"}</div></article>
          <article className="kpi-card outlet-kpi"><div className="kpi-top"><span className="kpi-label">Outlet Aktif</span><span className="kpi-icon teal-icon"><Icon name="store" size={17}/></span></div><div className="kpi-main"><strong>{kpis.activeOutlets} <span className="kpi-total">/ {kpis.totalOutlets}</span></strong>{kpis.activeOutlets > 0 && <span className="status-mini"><i/> {kpis.activeOutlets} beroperasi</span>}</div><div className="kpi-foot">{kpis.notStartedOutlets > 0 ? <><span className="subtle-alert-dot"/>{kpis.notStartedOutlets} belum mulai operasi</> : "Semua outlet sudah beroperasi"}</div></article>
        </section>

        <section className="overview-grid">
          <article className="panel chart-card">
            <div className="panel-heading chart-heading"><div><div className="panel-title-row"><h2>Penjualan Hari Ini</h2></div><div className="chart-total">{compactRupiah(kpis.salesMinor)}</div></div><span className="period-select" aria-label="Periode grafik">{formatDayMonth(day)}</span></div>
            <SalesChart trend={model.salesTrend} totalMinor={kpis.salesMinor}/>
            <div className="chart-foot"><span><i className="legend-dot"/>Penjualan terkumpul</span><span>Dihitung {formatClock(model.generatedAt)} WIB</span></div>
          </article>

          <article className="panel attention-card">
            <div className="panel-heading attention-heading"><div><h2>Perlu Perhatian</h2><p>{model.alerts.length === 0 ? "Tidak ada tindak lanjut" : `${model.alerts.length} hal membutuhkan tindak lanjut`}</p></div></div>
            <div className="alert-list">
              {model.alerts.length === 0 && <div className="empty-state">Tidak ada perhatian khusus saat ini.</div>}
              {model.alerts.slice(0, 4).map((alert) => {
                const view = presentAlert(alert);
                const href = alertHref(alert, day);
                return <div className="alert-row" key={`${alert.kind}-${alert.id}`}><span className={`alert-icon alert-${view.tone}`}><Icon name={view.icon} size={17}/></span><div className="alert-copy"><div className="alert-title">{alert.outletName ?? alert.title} <span className={`alert-tag tag-${view.tone}`}>{view.tag}</span></div><p>{alert.description}</p>{href && <a className="text-action" href={href}>{view.action} <Icon name="arrow" size={13}/></a>}</div><span className="alert-time">{formatClock(alert.createdAt)}</span></div>;
              })}
            </div>
            <a className="all-alerts" href="/alerts">Lihat semua peringatan <Icon name="arrow" size={14}/></a>
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel outlet-table-card">
            <div className="table-heading"><div><div className="table-title-line"><h2>Status Outlet</h2><span className="outlet-count">{model.pagination.total} outlet terdaftar</span></div><p>Pantau performa dan status operasional outlet</p></div><div className="table-tools"><label className="table-search"><Icon name="search" size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari outlet" aria-label="Cari outlet pada tabel"/></label><button className="filter-button" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}><Icon name="filter" size={16}/><span>{statusFilter === "ALL" ? "Filter" : STATUS_PRESENTATION[statusFilter].label}</span></button>{filterOpen && <select aria-label="Filter status outlet" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | OutletStatus)}><option value="ALL">Semua status</option>{(Object.keys(STATUS_PRESENTATION) as OutletStatus[]).map((status) => <option key={status} value={status}>{STATUS_PRESENTATION[status].label}</option>)}</select>}</div></div>
            <div className="table-scroll"><table><thead><tr><th>OUTLET</th><th>OPERATOR</th><th>MULAI</th><th>PENJUALAN</th><th>PENGELUARAN</th><th>STATUS</th><th aria-label="Aksi"/></tr></thead><tbody>{visibleOutlets.map((outlet) => {
              const status = STATUS_PRESENTATION[outlet.status];
              return <tr key={outlet.id}><td><div className="outlet-name-cell"><span className={`store-avatar store-${outlet.status === "NOT_STARTED" || outlet.status === "CLOSED" ? "muted" : "green"}`}><Icon name="store" size={15}/></span><a href={`/hq/outlets/${encodeURIComponent(outlet.id)}?date=${day}`}><strong>{outlet.name}</strong></a></div></td><td><span className="operator-name">{outlet.operatorName ?? "—"}</span></td><td className={outlet.startedAt ? "time-cell" : "muted-cell"}>{formatClock(outlet.startedAt)}</td><td className="money-cell">{rupiah(outlet.salesMinor)}</td><td className="money-cell expense-cell">{rupiah(outlet.expensesMinor)}</td><td><span className={`status-badge ${status.className}`} title={outlet.statusReason ?? undefined}><i/>{status.label}</span></td><td><a className="row-menu" aria-label={`Detail ${outlet.name}`} href={`/hq/outlets/${encodeURIComponent(outlet.id)}?date=${day}`}><Icon name="arrow" size={16}/></a></td></tr>;
            })}</tbody></table>{model.pagination.total === 0 && <div className="empty-state">Belum ada outlet terdaftar dalam cakupan Anda.</div>}{model.pagination.total > 0 && visibleOutlets.length === 0 && <div className="empty-state">Tidak ada outlet yang cocok dengan pencarian atau filter.</div>}</div>
            <div className="table-footer"><span>Menampilkan <b>{visibleOutlets.length}</b> dari <b>{model.pagination.total}</b> outlet{model.pagination.nextCursor ? " (daftar dipotong oleh batas server)" : ""}</span></div>
          </article>
          <article className="panel activity-card"><div className="activity-heading"><div><h2>Aktivitas Terbaru</h2><p>Aktivitas {scopeNoun} pada {formatShortDay(day)}</p></div></div><div className="activity-list">
            {model.activity.length === 0 && <div className="empty-state">Belum ada aktivitas operasional hari ini.</div>}
            {model.activity.map((item, index) => <div className="activity-entry" key={item.id}><span className="activity-timeline"><i className={ACTIVITY_TONE[item.kind]}><Icon name={ACTIVITY_ICON[item.kind]} size={14}/></i></span><div><p>{item.outletName && <><b>{item.outletName}</b> </>}{item.description}{item.amountMinor !== null && <> <strong>{rupiah(item.amountMinor)}</strong></>}{item.secondary && <small>{item.secondary}</small>}</p><time dateTime={item.occurredAt}>{formatClock(item.occurredAt)} WIB</time></div></div>)}
          </div></article>
        </section>
        <footer className="page-footer"><span>SiomayOps <i>•</i> Dihitung {formatClock(model.generatedAt)} WIB</span><span>{model.sourceWatermark ? `Data sumber terbaru ${formatClock(model.sourceWatermark)} WIB` : "Belum ada data sumber pada hari ini"}</span></footer>
      </main>
    </div>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><div className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="modal-head"><div><span className="modal-icon"><Icon name={modal === "transaction" ? "receipt" : "wallet"} size={19}/></span><div><h2 id="entry-title">{modal === "transaction" ? "Catat Transaksi" : "Catat Pengeluaran"}</h2><p>Simulasi formulir — data belum dikirim ke server</p></div></div><button className="icon-button" aria-label="Tutup" onClick={() => setModal(null)}><Icon name="close"/></button></div><form onSubmit={(event) => { event.preventDefault(); setModal(null); showToast(modal === "transaction" ? "Demo: transaksi belum disimpan ke server" : "Demo: pengeluaran belum disimpan ke server"); }}><label>Outlet<select required defaultValue=""><option value="" disabled>Pilih outlet</option>{model.outletOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{modal === "transaction" ? <><label>Total transaksi<div className="currency-input"><span>Rp</span><input required type="number" min="1" placeholder="0"/></div></label><label>Metode pembayaran<select defaultValue="Tunai"><option>Tunai</option><option>QRIS</option></select></label></> : <><label>Kategori<select defaultValue=""><option value="" disabled>Pilih kategori</option><option>Bahan baku</option><option>Transportasi</option><option>Parkir &amp; keamanan</option><option>Lainnya</option></select></label><label>Jumlah<div className="currency-input"><span>Rp</span><input required type="number" min="1" placeholder="0"/></div></label></>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary">Simpan catatan</button></div></form></div></div>}
    {toast && <div className="toast"><span><Icon name="check" size={15}/></span>{toast}</div>}
  </div>;
}
