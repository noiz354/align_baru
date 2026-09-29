"use client";

import { useMemo, useState } from "react";

type IconName = "grid" | "activity" | "receipt" | "wallet" | "box" | "chart" | "settings" | "help" | "chevron" | "search" | "bell" | "plus" | "calendar" | "arrow" | "warning" | "clock" | "dots" | "filter" | "store" | "close" | "check" | "user";

function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
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
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

const outlets = [
  { name: "Manggarai", operator: "Dimas", start: "07:12", sales: 1420000, expense: 175000, status: "Beroperasi" },
  { name: "Tebet", operator: "Rian", start: "06:54", sales: 1185000, expense: 122000, status: "Beroperasi" },
  { name: "Kuningan", operator: "Bayu", start: "07:05", sales: 1310000, expense: 215000, status: "Perlu Perhatian" },
  { name: "Pasar Minggu", operator: "Yoga", start: "07:33", sales: 895000, expense: 234000, status: "Periksa" },
  { name: "Cikini", operator: "Arif", start: "—", sales: 0, expense: 0, status: "Belum Mulai" },
  { name: "Setiabudi", operator: "Reza", start: "06:48", sales: 1575000, expense: 184000, status: "Beroperasi" },
];

const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

function SalesChart() {
  const points = "0,145 70,137 140,126 210,115 280,102 350,92 420,79 490,68 560,54 630,43 700,27";
  return <div className="chart-wrap" aria-label="Grafik penjualan dari pukul enam hingga delapan belas">
    <div className="chart-y-labels"><span>Rp 10 jt</span><span>Rp 7,5 jt</span><span>Rp 5 jt</span><span>Rp 2,5 jt</span><span>Rp 0</span></div>
    <div className="chart-plot">
      <svg className="sales-svg" viewBox="0 0 700 165" preserveAspectRatio="none" role="img" aria-label="Penjualan meningkat stabil hingga Rp 8,45 juta">
        <defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#15815d" stopOpacity=".14"/><stop offset="100%" stopColor="#15815d" stopOpacity="0"/></linearGradient></defs>
        {[5, 40, 75, 110, 145].map((y) => <line key={y} x1="0" y1={y} x2="700" y2={y} className="chart-grid"/>)}
        <polygon points={`0,165 ${points} 700,165`} fill="url(#sales-fill)"/>
        <polyline points={points} fill="none" stroke="#16815c" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {[0, 70, 140, 210, 280, 350, 420, 490, 560, 630, 700].map((x, i) => {
          const ys = [145,137,126,115,102,92,79,68,54,43,27];
          return <circle key={x} cx={x} cy={ys[i]} r={i === 10 ? 4 : 2.5} fill={i === 10 ? "#fff" : "#16815c"} stroke="#16815c" strokeWidth={i === 10 ? 2.5 : 0} vectorEffect="non-scaling-stroke"/>;
        })}
      </svg>
      <div className="chart-x-labels">{["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((t) => <span key={t}>{t}</span>)}</div>
    </div>
  </div>;
}

export default function Page() {
  const [search, setSearch] = useState("");
  const [outletScope, setOutletScope] = useState("Semua Outlet");
  const [modal, setModal] = useState<"transaction" | "expense" | null>(null);
  const [toast, setToast] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [period, setPeriod] = useState("Hari ini");
  const filteredOutlets = useMemo(() => outlets.filter((outlet) => `${outlet.name} ${outlet.operator} ${outlet.status}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#dashboard" aria-label="SiomayOps Dashboard">
        <span className="brand-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 4.7c-1.6 0-2.9 1.3-2.9 2.9 0 1 .5 1.8 1.2 2.3v3.3c-5.4.9-9.4 5.5-9.4 11.1v3.2c0 1.7 1.4 3.1 3.1 3.1h16c1.7 0 3.1-1.4 3.1-3.1v-3.2c0-5.6-4-10.2-9.4-11.1V9.9c.7-.5 1.2-1.3 1.2-2.3 0-1.6-1.3-2.9-2.9-2.9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 22h.1m5.9-2v.1m6 4.9h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M11 30v2m14-2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
        <span className="brand-name">siomay<span>ops</span><small>OPERATIONS</small></span>
      </a>
      <div className="nav-caption">MENU UTAMA</div>
      <nav className="primary-nav" aria-label="Navigasi utama">
        <a className="nav-link active" href="#dashboard"><Icon name="grid"/><span>Dashboard</span></a>
        <a className="nav-link" href="/hq"><Icon name="activity"/><span>Operasional</span><span className="nav-count">3</span></a>
        <a className="nav-link" href="/sell"><Icon name="receipt"/><span>Transaksi</span></a>
        <a className="nav-link" href="/expenses"><Icon name="wallet"/><span>Pengeluaran</span></a>
        <a className="nav-link" href="/stock"><Icon name="box"/><span>Produk &amp; Harga</span></a>
        <a className="nav-link" href="/hq"><Icon name="chart"/><span>Laporan</span></a>
      </nav>
      <div className="sidebar-bottom">
        <a className="nav-link" href="#pengaturan" onClick={(event) => { event.preventDefault(); showToast("Pengaturan akun siap dibuka"); }}><Icon name="settings"/><span>Pengaturan</span></a>
        <a className="nav-link" href="#bantuan" onClick={(event) => { event.preventDefault(); showToast("Tim bantuan siap membantu"); }}><Icon name="help"/><span>Bantuan</span></a>
        <div className="profile-card"><div className="avatar avatar-profile">RP</div><div className="profile-info"><strong>Rizky Pratama</strong><span>Supervisor Operasional</span></div><button className="icon-button profile-menu" aria-label="Menu profil" onClick={() => showToast("Profil Rizky Pratama")}><Icon name="dots" size={19}/></button></div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <button className="outlet-select" onClick={() => setOutletScope(outletScope === "Semua Outlet" ? "Jakarta Selatan" : "Semua Outlet")} aria-label="Pilih cakupan outlet"><span className="outlet-icon"><Icon name="store" size={16}/></span><span>{outletScope}</span><Icon name="chevron" size={15}/></button>
        <div className="topbar-right">
          <div className="top-date"><Icon name="calendar" size={16}/><span>29 Sep 2026</span></div>
          <div className={`quick-search ${searchOpen ? "search-active" : ""}`}><input aria-label="Cari outlet" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari outlet..."/><button className="icon-button" aria-label="Cari" onClick={() => setSearchOpen(!searchOpen)}><Icon name="search"/></button></div>
          <div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifikasi" onClick={() => setNotificationOpen(!notificationOpen)}><Icon name="bell" size={19}/><i/></button>{notificationOpen && <div className="notification-popover"><strong>Notifikasi</strong><span className="notification-item"><b>3 outlet perlu perhatian</b><small>Pembaruan operasional hari ini</small></span><span className="notification-item"><b>Stok Siomay Komplit menipis</b><small>Kuningan · 09:26</small></span></div>}</div>
          <button className="avatar avatar-top" aria-label="Profil Rizky Pratama" onClick={() => showToast("Halo, Rizky!")}>RP</button>
        </div>
      </header>

      <main className="page-content" id="dashboard">
        <div className="page-heading">
          <div><div className="eyebrow"><span className="live-dot"/>OPERASIONAL <span className="eyebrow-divider">/</span> DASHBOARD</div><h1>Operasional Hari Ini</h1><p>Ringkasan aktivitas seluruh outlet — Selasa, 29 September 2026</p></div>
          <div className="heading-actions"><button className="button button-secondary" onClick={() => setModal("expense")}><Icon name="plus" size={17}/>Catat Pengeluaran</button><button className="button button-primary" onClick={() => setModal("transaction")}><Icon name="plus" size={17}/>Catat Transaksi</button></div>
        </div>

        <section className="kpi-grid" aria-label="Ringkasan hari ini">
          <article className="kpi-card sales-kpi"><div className="kpi-top"><span className="kpi-label">Penjualan Hari Ini</span><span className="kpi-icon green-icon"><Icon name="chart" size={17}/></span></div><div className="kpi-main"><strong>Rp 8.450.000</strong><span className="trend-up">↑ 12,4%</span></div><div className="kpi-foot">dibanding kemarin <span className="comparison-period">· 28 Sep</span></div><div className="mini-spark" aria-hidden="true"><svg viewBox="0 0 90 24"><path d="M1 19 15 15 25 17 37 9 48 12 60 5 72 9 89 2" fill="none" stroke="#35a47a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div></article>
          <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Transaksi</span><span className="kpi-icon blue-icon"><Icon name="receipt" size={17}/></span></div><div className="kpi-main"><strong>187</strong></div><div className="kpi-foot">Rata-rata <b>Rp 45.187</b> / transaksi</div></article>
          <article className="kpi-card"><div className="kpi-top"><span className="kpi-label">Pengeluaran</span><span className="kpi-icon amber-icon"><Icon name="wallet" size={17}/></span></div><div className="kpi-main"><strong>Rp 1.275.000</strong></div><div className="kpi-foot"><span className="expense-meter"><i/></span><b>15,1%</b> dari penjualan</div></article>
          <article className="kpi-card outlet-kpi"><div className="kpi-top"><span className="kpi-label">Outlet Aktif</span><span className="kpi-icon teal-icon"><Icon name="store" size={17}/></span></div><div className="kpi-main"><strong>8 <span className="kpi-total">/ 9</span></strong><span className="status-mini"><i/> 8 beroperasi</span></div><div className="kpi-foot"><span className="subtle-alert-dot"/>1 belum mulai operasi</div></article>
        </section>

        <section className="overview-grid">
          <article className="panel chart-card">
            <div className="panel-heading chart-heading"><div><div className="panel-title-row"><h2>Penjualan Hari Ini</h2><span className="chart-live"><i/> LIVE</span></div><div className="chart-total">Rp 8,45 <span>jt</span><span className="chart-change">↑ 12,4%</span></div></div><select className="period-select" aria-label="Periode grafik" value={period} onChange={(e) => setPeriod(e.target.value)}><option>Hari ini</option><option>Kemarin</option><option>7 hari</option></select></div>
            <SalesChart/>
            <div className="chart-foot"><span><i className="legend-dot"/>Penjualan terkumpul</span><span>Terakhir diperbarui 09:45 WIB</span></div>
          </article>

          <article className="panel attention-card">
            <div className="panel-heading attention-heading"><div><h2>Perlu Perhatian</h2><p>3 hal membutuhkan tindak lanjut</p></div><button className="icon-button more-button" aria-label="Lihat semua perhatian" onClick={() => showToast("Menampilkan seluruh perhatian")}>···</button></div>
            <div className="alert-list">
              <div className="alert-row"><span className="alert-icon alert-red"><Icon name="clock" size={17}/></span><div className="alert-copy"><div className="alert-title">Cikini <span className="alert-tag tag-red">Belum Mulai</span></div><p>Belum memulai operasional</p><button className="text-action" onClick={() => showToast("Membuka detail outlet Cikini")}>Lihat outlet <Icon name="arrow" size={13}/></button></div><span className="alert-time">09:40</span></div>
              <div className="alert-row"><span className="alert-icon alert-amber"><Icon name="warning" size={17}/></span><div className="alert-copy"><div className="alert-title">Pasar Minggu <span className="alert-tag tag-amber">Periksa</span></div><p>Pengeluaran mencapai 26% dari penjualan</p><button className="text-action" onClick={() => showToast("Membuka pengeluaran Pasar Minggu")}>Tinjau pengeluaran <Icon name="arrow" size={13}/></button></div><span className="alert-time">09:28</span></div>
              <div className="alert-row"><span className="alert-icon alert-yellow"><Icon name="box" size={17}/></span><div className="alert-copy"><div className="alert-title">Kuningan <span className="alert-tag tag-yellow">Stok Rendah</span></div><p>Stok Siomay Komplit menipis</p><button className="text-action" onClick={() => showToast("Membuka stok outlet Kuningan")}>Lihat stok <Icon name="arrow" size={13}/></button></div><span className="alert-time">09:26</span></div>
            </div>
            <button className="all-alerts" onClick={() => showToast("Semua peringatan operasional")}>Lihat semua peringatan <Icon name="arrow" size={14}/></button>
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel outlet-table-card">
            <div className="table-heading"><div><div className="table-title-line"><h2>Status Outlet</h2><span className="outlet-count">9 outlet terdaftar</span></div><p>Pantau performa dan status operasional outlet</p></div><div className="table-tools"><label className="table-search"><Icon name="search" size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari outlet" aria-label="Cari outlet pada tabel"/><kbd>⌘ K</kbd></label><button className="filter-button" onClick={() => showToast("Filter status outlet") }><Icon name="filter" size={16}/><span>Filter</span></button></div></div>
            <div className="table-scroll"><table><thead><tr><th>OUTLET</th><th>OPERATOR</th><th>MULAI</th><th>PENJUALAN</th><th>PENGELUARAN</th><th>STATUS</th><th aria-label="Aksi"/></tr></thead><tbody>{filteredOutlets.map((outlet) => <tr key={outlet.name}><td><div className="outlet-name-cell"><span className={`store-avatar store-${outlet.name === "Cikini" ? "muted" : "green"}`}><Icon name="store" size={15}/></span><strong>{outlet.name}</strong></div></td><td><span className="operator-name">{outlet.operator}</span></td><td className={outlet.start === "—" ? "muted-cell" : "time-cell"}>{outlet.start}</td><td className="money-cell">{rupiah(outlet.sales)}</td><td className="money-cell expense-cell">{rupiah(outlet.expense)}</td><td><span className={`status-badge ${outlet.status === "Beroperasi" ? "status-operating" : outlet.status === "Belum Mulai" ? "status-notstarted" : outlet.status === "Periksa" ? "status-review" : "status-attention"}`}><i/>{outlet.status}</span></td><td><button className="row-menu" aria-label={`Aksi ${outlet.name}`} onClick={() => showToast(`Aksi ${outlet.name}`)}><Icon name="dots" size={18}/></button></td></tr>)}</tbody></table>{filteredOutlets.length === 0 && <div className="empty-state">Tidak ada outlet yang cocok dengan “{search}”.</div>}</div>
            <div className="table-footer"><span>Menampilkan <b>{filteredOutlets.length ? 1 : 0}–{filteredOutlets.length}</b> dari <b>9</b> outlet</span><button onClick={() => showToast("Membuka daftar semua outlet")}>Lihat semua outlet <Icon name="arrow" size={13}/></button></div>
          </article>
          <article className="panel activity-card"><div className="activity-heading"><div><h2>Aktivitas Terbaru</h2><p>Aktivitas outlet hari ini</p></div><button className="icon-button more-button" aria-label="Menu aktivitas" onClick={() => showToast("Aktivitas terbaru")}>···</button></div><div className="activity-list">
            <div className="activity-entry"><span className="activity-timeline"><i className="timeline-sale"><Icon name="receipt" size={14}/></i></span><div><p><b>Tebet</b> mencatat transaksi <strong>Rp 85.000</strong></p><time>09:42 <span>· 3 menit lalu</span></time></div></div>
            <div className="activity-entry"><span className="activity-timeline"><i className="timeline-expense"><Icon name="wallet" size={14}/></i></span><div><p><b>Manggarai</b> mencatat pengeluaran <strong>Rp 50.000</strong><small>Parkir &amp; keamanan</small></p><time>09:38 <span>· 7 menit lalu</span></time></div></div>
            <div className="activity-entry"><span className="activity-timeline"><i className="timeline-product"><Icon name="box" size={14}/></i></span><div><p>Harga <b>Siomay Komplit</b> diperbarui di <b>Setiabudi</b></p><time>09:31 <span>· 14 menit lalu</span></time></div></div>
            <div className="activity-entry"><span className="activity-timeline last"><i className="timeline-start"><Icon name="check" size={14}/></i></span><div><p>Operator <b>Kuningan</b> memulai operasional</p><time>09:15 <span>· 30 menit lalu</span></time></div></div>
          </div><button className="activity-all" onClick={() => showToast("Membuka riwayat aktivitas")}>Lihat semua aktivitas <Icon name="arrow" size={13}/></button></article>
        </section>
        <footer className="page-footer"><span>SiomayOps <i>•</i> Sinkron terakhir 09:45 WIB</span><span><i className="sync-dot"/>Semua data tersinkron</span></footer>
      </main>
    </div>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><div className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="modal-head"><div><span className="modal-icon"><Icon name={modal === "transaction" ? "receipt" : "wallet"} size={19}/></span><div><h2 id="entry-title">{modal === "transaction" ? "Catat Transaksi" : "Catat Pengeluaran"}</h2><p>Simulasi formulir — data belum dikirim ke server</p></div></div><button className="icon-button" aria-label="Tutup" onClick={() => setModal(null)}><Icon name="close"/></button></div><form onSubmit={(e) => { e.preventDefault(); setModal(null); showToast(modal === "transaction" ? "Demo: transaksi belum disimpan ke server" : "Demo: pengeluaran belum disimpan ke server"); }}><label>Outlet<select required defaultValue=""><option value="" disabled>Pilih outlet</option>{["Manggarai", "Tebet", "Kuningan", "Pasar Minggu", "Cikini", "Setiabudi"].map((name) => <option key={name}>{name}</option>)}</select></label>{modal === "transaction" ? <><label>Total transaksi<div className="currency-input"><span>Rp</span><input required type="number" min="1" placeholder="0"/></div></label><label>Metode pembayaran<select defaultValue="Tunai"><option>Tunai</option><option>QRIS</option><option>Transfer</option></select></label></> : <><label>Kategori<select defaultValue=""><option value="" disabled>Pilih kategori</option><option>Bahan baku</option><option>Transportasi</option><option>Parkir &amp; keamanan</option><option>Lainnya</option></select></label><label>Jumlah<div className="currency-input"><span>Rp</span><input required type="number" min="1" placeholder="0"/></div></label></>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary">Simpan catatan</button></div></form></div></div>}
    {toast && <div className="toast"><span><Icon name="check" size={15}/></span>{toast}</div>}
  </div>;
}
