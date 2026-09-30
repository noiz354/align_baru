"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PriceScope = "ORG" | "AREA" | "LOCATION";
type Price = { policyId: string; amountMinor: number; currency: "IDR"; scope: PriceScope; effectiveFrom: string; effectiveTo: string | null };
type Policy = Price & { scopeId: string; scopeLabel: string; state: "CURRENT" | "FUTURE" | "EXPIRED" };
type Product = {
  id: string; name: string; categoryId: string; categoryName: string | null; active: boolean; canDeactivate: boolean; sortOrder: number;
  basePrice: Price | null; effectivePrice: Price | null; effectivePriceState: "RESOLVED" | "NOT_SELLABLE" | "AMBIGUOUS";
  pricePolicies: Policy[]; totalPolicyCount: number;
};
type Category = { id: string; name: string };
type Area = { id: string; label: string };
type Location = { id: string; name: string; areaId: string };
type Dialog = { kind: "create" } | { kind: "price"; product: Product } | { kind: "status"; product: Product; active: boolean } | null;
const PAGE_SIZE = 100;

const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const statusName = (active: boolean) => active ? "Aktif" : "Nonaktif";
function defaultLocalDateTime() {
  const localDate = new Date(Date.now() + 60_000 - new Date().getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [canManageProducts, setCanManageProducts] = useState(false);
  const [canManagePrices, setCanManagePrices] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sellingLocationId, setSellingLocationId] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [scope, setScope] = useState<PriceScope>("ORG");
  const [scopeId, setScopeId] = useState("");
  const [priceAmount, setPriceAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(defaultLocalDateTime);
  const [reason, setReason] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (sellingLocationId) params.set("sellingLocationId", sellingLocationId);
      const response = await fetch(`/api/v1/menu/items?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Katalog tidak dapat dimuat.");
      setProducts(payload.data ?? []);
      setTotal(payload.pagination?.total ?? 0);
      setCategories(payload.categories ?? []);
      setAreas(payload.areas ?? []);
      setLocations(payload.locations ?? []);
      setOrganizationId(payload.scopeOptions?.organizationId ?? "");
      setCanManageProducts(payload.capabilities?.canManageProducts === true);
      setCanManagePrices(payload.capabilities?.canManagePrices === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Katalog tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, sellingLocationId, offset]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  const locationName = locations.find((item) => item.id === sellingLocationId)?.name;
  const visibleCount = useMemo(() => products.length, [products]);

  function openCreate() {
    setFormError(""); setProductName(""); setProductCategoryId(categories[0]?.id ?? ""); setReason(""); setDialog({ kind: "create" });
  }
  function openPrice(product: Product) {
    setFormError(""); setPriceAmount(0); setEffectiveFrom(defaultLocalDateTime()); setReason("");
    setScope("ORG"); setScopeId(organizationId); setDialog({ kind: "price", product });
  }
  function setPriceScope(next: PriceScope) {
    setScope(next);
    setScopeId(next === "ORG" ? organizationId : next === "AREA" ? (areas[0]?.id ?? "") : (locations[0]?.id ?? ""));
  }

  async function submitDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!reason.trim() || reason.trim().length < 3) return setFormError("Alasan wajib diisi minimal 3 karakter.");
    setSaving(true);
    try {
      const headers = { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() };
      let response: Response;
      let body: unknown;
      if (dialog?.kind === "create") {
        if (!productCategoryId) throw new Error("Belum ada kategori katalog yang tersedia untuk produk baru.");
        response = await fetch("/api/v1/menu/items", { method: "POST", headers, body: JSON.stringify({ name: productName.trim(), categoryId: productCategoryId, reason: reason.trim() }) });
        body = { success: "Produk baru tersimpan. Harga dapat diatur terpisah dan tidak dibuat otomatis." };
      } else if (dialog?.kind === "price") {
        if (!dialog.product.active) throw new Error("Produk nonaktif tidak dapat menerima kebijakan harga baru.");
        if (!Number.isSafeInteger(priceAmount) || priceAmount <= 0) throw new Error("Masukkan harga lebih dari nol dalam rupiah bulat.");
        if (!scopeId) throw new Error("Pilih cakupan harga yang tersedia.");
        response = await fetch("/api/v1/menu/prices", { method: "POST", headers, body: JSON.stringify({
          menuItemId: dialog.product.id, scope, scopeId,
          unitPrice: { amountMinor: priceAmount, currency: "IDR" },
          effectiveFrom: new Date(effectiveFrom).toISOString(), reason: reason.trim(),
        }) });
        body = { success: "Kebijakan harga tersimpan dan akan berlaku sesuai tanggal efektif." };
      } else if (dialog?.kind === "status") {
        response = await fetch(`/api/v1/menu/items/${encodeURIComponent(dialog.product.id)}/status`, { method: "PATCH", headers, body: JSON.stringify({ active: dialog.active, reason: reason.trim() }) });
        body = { success: `Status produk berubah menjadi ${statusName(dialog.active).toLowerCase()}.` };
      } else return;

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Perubahan tidak dapat disimpan.");
      setDialog(null);
      setSuccess((body as { success: string }).success);
      await loadProducts();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Perubahan tidak dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return <main style={{ minHeight: "100vh", background: "#f6f8f6", color: "#203c33", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/" style={{ color: "inherit" }}>Beranda</a><span aria-hidden="true"> / </span><strong style={{ color: "#173c34" }}>Produk &amp; Harga</strong></nav>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, margin: "0 0 6px" }}>KATALOG · KEBIJAKAN HARGA</p><h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: 0, color: "#173c34" }}>Produk &amp; Harga</h1><p style={{ color: "#687a74", margin: "8px 0 0" }}>Harga berasal dari kebijakan tersimpan; perubahan tidak menulis ulang transaksi lama.</p></div>
        {canManageProducts && <button onClick={openCreate} style={primaryButton} disabled={categories.length === 0}>＋ Tambah produk</button>}
      </header>
      {success && <div role="status" style={noticeStyle("success")}>{success}<button onClick={() => setSuccess("")} aria-label="Tutup pesan" style={closeButton}>×</button></div>}

      <section aria-label="Filter katalog" style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={labelStyle}>Cari produk<input value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value); }} maxLength={100} placeholder="Nama produk" style={inputStyle}/></label>
        <label style={labelStyle}>Kategori<select value={categoryFilter} onChange={(event) => { setOffset(0); setCategoryFilter(event.target.value); }} style={inputStyle}><option value="">Semua kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label style={labelStyle}>Status<select value={statusFilter} onChange={(event) => { setOffset(0); setStatusFilter(event.target.value); }} style={inputStyle}><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label>
        <label style={labelStyle}>Harga efektif di<select value={sellingLocationId} onChange={(event) => { setOffset(0); setSellingLocationId(event.target.value); }} style={inputStyle}><option value="">Harga dasar organisasi</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <button onClick={() => { setOffset(0); setSearch(""); setCategoryFilter(""); setStatusFilter(""); setSellingLocationId(""); }} style={secondaryButton}>Hapus filter</button>
      </section>

      <section style={panel} aria-labelledby="catalog-title">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}><div><h2 id="catalog-title" style={{ margin: 0, fontSize: 18 }}>Katalog tersimpan</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>{loading ? "Memuat data…" : `${visibleCount} ditampilkan dari ${total} produk${locationName ? ` · harga ${locationName}` : ""}`}</p></div><button onClick={() => void loadProducts()} style={secondaryButton} disabled={loading}>Muat ulang</button></div>
        {error && <div role="alert" style={noticeStyle("error")}>{error}<button onClick={() => void loadProducts()} style={{ ...secondaryButton, marginLeft: 12 }}>Coba lagi</button></div>}
        {loading ? <div style={emptyStyle}>Memuat katalog dan kebijakan harga tersimpan…</div> : !error && products.length === 0 ? <div style={emptyStyle}><strong>Katalog kosong untuk filter ini.</strong><span style={{ display: "block", marginTop: 6 }}>{canManageProducts ? "Tambahkan produk dari kategori yang sudah tersedia." : "Tidak ada produk yang tersedia pada cakupan ini."}</span></div> : !error && (
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}><thead><tr>{["PRODUK", "KATEGORI", "STATUS", "HARGA DASAR", locationName ? "HARGA EFEKTIF" : "KEBIJAKAN TERKAIT", "AKSI"].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr></thead><tbody>{products.map((product) => <tr key={product.id}>
            <td style={tdStyle}><strong style={{ color: "#203c33" }}>{product.name}</strong><small style={{ display: "block", color: "#819089", marginTop: 4 }}>#{product.id.slice(0, 8)}</small></td>
            <td style={tdStyle}>{product.categoryName ?? "Kategori tidak tersedia"}</td>
            <td style={tdStyle}><span style={statusBadge(product.active)}>{statusName(product.active)}</span></td>
            <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{product.basePrice ? money(product.basePrice.amountMinor) : <span style={{ color: "#946513", fontWeight: 600 }}>Belum diatur</span>}</td>
            <td style={tdStyle}>{locationName ? <PriceCell product={product}/> : <details><summary style={{ color: "#087960", cursor: "pointer" }}>{product.totalPolicyCount} kebijakan harga</summary><PolicyList product={product}/></details>}</td>
            <td style={tdStyle}><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{canManagePrices && product.active && <button onClick={() => openPrice(product)} style={smallPrimary}>Ubah harga</button>}{canManageProducts && (product.active ? <button onClick={() => setDialog({ kind: "status", product, active: false })} style={smallSecondary} disabled={!product.canDeactivate} title={!product.canDeactivate ? "Kebijakan harga saat ini/terjadwal harus diganti atau berakhir sebelum produk dinonaktifkan." : undefined}>Nonaktifkan</button> : <button onClick={() => setDialog({ kind: "status", product, active: true })} style={smallSecondary}>Aktifkan</button>)}</div>{product.active && !product.canDeactivate && canManageProducts && <small style={{ display: "block", color: "#788780", marginTop: 5, maxWidth: 200 }}>Harga aktif/terjadwal mencegah penonaktifan sampai kebijakan berakhir.</small>}</td>
          </tr>)}</tbody></table></div>
        )}
        {!loading && !error && total > PAGE_SIZE && <nav aria-label="Halaman katalog" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14 }}>
          <span style={{ color: "#72817c", fontSize: 13 }}>Menampilkan {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} dari {total}</span>
          <div style={{ display: "flex", gap: 8 }}><button onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} disabled={offset === 0} style={secondaryButton}>Sebelumnya</button><button onClick={() => setOffset((current) => current + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} style={secondaryButton}>Berikutnya</button></div>
        </nav>}
      </section>
      <p style={{ color: "#778781", fontSize: 12, marginTop: 14 }}>Perubahan harga membuat kebijakan baru dengan jejak audit. Pengeditan nama, impor CSV, paket/komponen, persetujuan harga, dan ketersediaan per lokasi belum tersedia di runtime ini.</p>
    </div>

    {dialog && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }} style={modalBackdrop}><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" style={modalPanel}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 18 }}><div><h2 id="dialog-title" style={{ margin: 0, color: "#173c34" }}>{dialog.kind === "create" ? "Tambah produk" : dialog.kind === "price" ? "Buat kebijakan harga" : `${dialog.active ? "Aktifkan" : "Nonaktifkan"} produk`}</h2><p style={{ margin: "6px 0 0", color: "#72817c", fontSize: 14 }}>{dialog.kind === "price" ? `Produk: ${dialog.product.name}. Harga lama tetap menjadi bagian dari riwayat.` : dialog.kind === "status" ? `Produk: ${dialog.product.name}. Perubahan dicatat di audit.` : "Hanya produk sederhana yang didukung; kategori harus sudah tersedia."}</p></div><button onClick={() => setDialog(null)} disabled={saving} aria-label="Tutup" style={closeButton}>×</button></header>
      <form onSubmit={(event) => void submitDialog(event)}>
        {formError && <div role="alert" style={noticeStyle("error")}>{formError}</div>}
        {dialog.kind === "create" && <>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Nama produk<input required minLength={2} maxLength={120} value={productName} onChange={(event) => setProductName(event.target.value)} autoFocus style={inputStyle}/></label>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Kategori<select required value={productCategoryId} onChange={(event) => setProductCategoryId(event.target.value)} style={inputStyle}><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div style={infoBox}>Harga awal tidak dibuat otomatis. Atur kebijakan harga secara terpisah setelah produk tersimpan.</div>
        </>}
        {dialog.kind === "price" && <>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Cakupan harga<select value={scope} onChange={(event) => setPriceScope(event.target.value as PriceScope)} style={inputStyle}><option value="ORG">Organisasi · harga dasar</option><option value="AREA" disabled={areas.length === 0}>Area</option><option value="LOCATION" disabled={locations.length === 0}>Titik jual</option></select></label>
          {scope !== "ORG" && <label style={{ ...labelStyle, marginBottom: 14 }}>{scope === "AREA" ? "Area" : "Titik jual"}<select required value={scopeId} onChange={(event) => setScopeId(event.target.value)} style={inputStyle}><option value="">Pilih cakupan</option>{scope === "AREA" ? areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>) : locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
          <label style={{ ...labelStyle, marginBottom: 14 }}>Harga (Rp)<input required type="number" min="1" step="1" value={priceAmount || ""} onChange={(event) => setPriceAmount(Number(event.target.value))} placeholder="Masukkan harga rupiah bulat" style={inputStyle}/></label>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Berlaku mulai (waktu perangkat)<input required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} style={inputStyle}/></label>
        </>}
        {dialog.kind === "status" && <div style={infoBox}>{dialog.active ? "Produk kembali muncul pada pilihan jual setelah dibaca ulang oleh server." : "Produk dengan kebijakan harga saat ini atau terjadwal tidak dapat dinonaktifkan. Perubahan tidak menghapus transaksi lama."}</div>}
        <label style={{ ...labelStyle, margin: "14px 0 16px" }}>Alasan (wajib)<textarea required minLength={3} maxLength={300} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Alasan perubahan untuk jejak audit" style={textarea}/></label>
        <div style={{ display: "flex", justifyContent: "end", gap: 10 }}><button type="button" onClick={() => setDialog(null)} disabled={saving} style={secondaryButton}>Batal</button><button type="submit" disabled={saving || (dialog.kind === "create" && (!productName.trim() || !productCategoryId)) || (dialog.kind === "price" && (!priceAmount || !scopeId))} style={primaryButton}>{saving ? "Menyimpan…" : dialog.kind === "price" ? "Simpan kebijakan" : dialog.kind === "status" ? "Simpan status" : "Simpan produk"}</button></div>
      </form>
    </section></div>}
  </main>;
}

function PriceCell({ product }: { product: Product }) {
  if (product.effectivePriceState === "AMBIGUOUS") return <span style={{ color: "#a63f35", fontWeight: 600 }}>Harga ambigu · perlu ditinjau</span>;
  if (!product.effectivePrice) return <span style={{ color: "#946513", fontWeight: 600 }}>Tidak ada harga efektif</span>;
  return <><strong>{money(product.effectivePrice.amountMinor)}</strong><small style={{ display: "block", color: "#819089", marginTop: 4 }}>Berlaku {dateLabel(product.effectivePrice.effectiveFrom)} · {product.effectivePrice.scope}</small></>;
}
function PolicyList({ product }: { product: Product }) {
  if (!product.pricePolicies.length) return <p style={{ color: "#819089", fontSize: 12 }}>Belum ada kebijakan harga tersimpan.</p>;
  return <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{product.pricePolicies.map((policy) => <div key={policy.policyId} style={{ borderTop: "1px solid #edf1ef", paddingTop: 8, fontSize: 12 }}><strong>{policy.scopeLabel} · {money(policy.amountMinor)}</strong><small style={{ display: "block", color: "#819089", marginTop: 3 }}>{policy.state === "CURRENT" ? "Berlaku" : policy.state === "FUTURE" ? "Terjadwal" : "Berakhir"} · mulai {dateLabel(policy.effectiveFrom)}{policy.effectiveTo ? ` · sampai ${dateLabel(policy.effectiveTo)}` : ""}</small></div>)}{product.totalPolicyCount > product.pricePolicies.length && <small style={{ color: "#819089" }}>Menampilkan {product.pricePolicies.length} dari {product.totalPolicyCount} kebijakan terbaru.</small>}</div>;
}

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1e9e5", borderRadius: 16, padding: "18px 20px", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const primaryButton: React.CSSProperties = { border: 0, background: "#087960", color: "white", fontWeight: 700, borderRadius: 11, padding: "13px 18px", minHeight: 48, cursor: "pointer" };
const smallPrimary: React.CSSProperties = { border: 0, background: "#087960", color: "white", fontWeight: 700, borderRadius: 8, padding: "9px 11px", minHeight: 38, cursor: "pointer", whiteSpace: "nowrap" };
const smallSecondary: React.CSSProperties = { border: "1px solid #dbe5e0", background: "#fff", color: "#31534a", fontWeight: 600, borderRadius: 8, padding: "9px 11px", minHeight: 38, cursor: "pointer", whiteSpace: "nowrap" };
const secondaryButton: React.CSSProperties = { border: "1px solid #dbe5e0", background: "#fff", color: "#31534a", fontWeight: 600, borderRadius: 9, padding: "10px 13px", minHeight: 42, cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#4f655d", fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { minHeight: 44, minWidth: 150, border: "1px solid #dbe5e0", borderRadius: 9, padding: "8px 10px", color: "#203c33", background: "white", font: "inherit" };
const emptyStyle: React.CSSProperties = { padding: "42px 16px", textAlign: "center", color: "#778781", background: "#fafcfb", borderRadius: 12 };
const thStyle: React.CSSProperties = { textAlign: "left", fontSize: 10, letterSpacing: ".08em", color: "#819089", padding: "12px 10px", borderBottom: "1px solid #e9efec", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "14px 10px", borderBottom: "1px solid #edf1ef", fontSize: 13, verticalAlign: "middle" };
const modalBackdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,35,28,.42)", zIndex: 20, display: "grid", placeItems: "center", padding: 14 };
const modalPanel: React.CSSProperties = { background: "white", width: "min(100%, 580px)", maxHeight: "92vh", overflowY: "auto", borderRadius: 18, padding: "22px clamp(16px, 4vw, 28px)", boxShadow: "0 18px 60px rgba(10,35,25,.22)" };
const closeButton: React.CSSProperties = { border: 0, background: "transparent", color: "#587067", fontSize: 25, cursor: "pointer" };
const textarea: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, border: "1px solid #dbe5e0", borderRadius: 9, padding: 11, font: "inherit", resize: "vertical" };
const infoBox: React.CSSProperties = { border: "1px solid #dbe9e0", background: "#f4faf6", color: "#526d5f", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.5 };
const statusBadge = (active: boolean): React.CSSProperties => ({ display: "inline-block", borderRadius: 999, padding: "6px 10px", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: active ? "#087960" : "#69746f", background: active ? "#e2f5ee" : "#eef2f0" });
function noticeStyle(tone: "success" | "error"): React.CSSProperties { return { background: tone === "success" ? "#e8f7ef" : "#fff0ef", color: tone === "success" ? "#176b4f" : "#9f352b", border: `1px solid ${tone === "success" ? "#bfe6d1" : "#f0c8c4"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }; }
