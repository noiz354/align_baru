"use client";

import { useState, useEffect } from "react";
import { MoneyText } from "@/shared/ui/MoneyText";
import { TapTarget } from "@/shared/ui/TapTarget";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { money } from "@/shared/money/money";

type CartItem = { menuItemId: string; name: string; qty: number; priceMinor: number };

const MOCK_MENU: CartItem[] = [
  { menuItemId: "00000000-0000-7000-0000-000000000101", name: "Siomay Ayam", qty: 0, priceMinor: 15000 },
  { menuItemId: "00000000-0000-7000-0000-000000000102", name: "Siomay Campur", qty: 0, priceMinor: 18000 },
  { menuItemId: "00000000-0000-7000-0000-000000000103", name: "Batagor", qty: 0, priceMinor: 12000 },
  { menuItemId: "00000000-0000-7000-0000-000000000104", name: "Es Teh", qty: 0, priceMinor: 5000 },
];

export default function SellPage() {
  const [cart, setCart] = useState<CartItem[]>(MOCK_MENU);
  const [saleStatus, setSaleStatus] = useState<string>("");
  const [isOffline, setIsOffline] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);

  useEffect(() => {
    const upd = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    upd();
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
    };
  }, []);

  const totalMinor = cart.reduce((s, i) => s + i.qty * i.priceMinor, 0);
  const total = money(totalMinor, "IDR");

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(it => it.menuItemId === id ? { ...it, qty: Math.max(0, it.qty + delta) } : it));
  };

  const handleCashSale = async () => {
    if (totalMinor === 0) {
      setSaleStatus("Keranjang kosong");
      return;
    }
    setSaleStatus("Memproses...");
    try {
      const clientSaleId = crypto.randomUUID();
      const clientPaymentId = crypto.randomUUID();

      // Create sale
      const saleRes = await fetch("/api/v1/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientSaleId },
        body: JSON.stringify({
          shiftId: "00000000-0000-7000-0000-000000000001",
          lines: cart.filter(c => c.qty > 0).map(c => ({ menuItemId: c.menuItemId, quantity: c.qty })),
          clientSaleId,
        }),
      });
      const saleData = await saleRes.json();
      if (!saleRes.ok) throw new Error(saleData.error?.message || "Gagal buat sale");

      // Cash payment
      const payRes = await fetch("/api/v1/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientPaymentId },
        body: JSON.stringify({
          saleId: saleData.saleId,
          amount: { amountMinor: totalMinor, currency: "IDR" },
          cashReceived: { amountMinor: cashReceived || totalMinor, currency: "IDR" },
          clientPaymentId,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error?.message || "Gagal bayar");

      setSaleStatus(`Berhasil! Kembalian Rp ${(payData.change?.amountMinor || 0).toLocaleString("id-ID")}`);
      setCart(MOCK_MENU.map(m => ({ ...m, qty: 0 })));
      setCashReceived(0);
    } catch (e: any) {
      setSaleStatus(`Gagal: ${e.message}`);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      <OfflineBanner isOffline={isOffline} pendingRecordCount={0} />
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Jualan</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <StatusBadge tone="neutral" messageId={`Total: ${cart.filter(c => c.qty > 0).length} item`} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {cart.map(item => (
            <div key={item.menuItemId} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Rp {item.priceMinor.toLocaleString("id-ID")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
                <button onClick={() => updateQty(item.menuItemId, -1)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb" }}>-</button>
                <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{item.qty}</span>
                <button onClick={() => updateQty(item.menuItemId, 1)} style={{ width: 36, height: 36, borderRadius: 8, background: "#0f766e", color: "#fff", border: "none" }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 16, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Total bayar</span>
            <MoneyText value={total} density="operator" />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}>Tunai diterima:</label>
            <input
              type="number"
              value={cashReceived || ""}
              onChange={e => setCashReceived(Number(e.target.value))}
              placeholder={String(totalMinor)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
            />
          </div>
          {cashReceived > 0 && cashReceived >= totalMinor && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Kembalian: Rp {(cashReceived - totalMinor).toLocaleString("id-ID")}
            </div>
          )}
        </div>

        {saleStatus && (
          <div style={{ padding: 12, background: saleStatus.startsWith("Berhasil") ? "#d1fae5" : "#fee2e2", borderRadius: 8, fontSize: 14 }}>
            {saleStatus}
          </div>
        )}

        <TapTarget minSize={72} label="Bayar Tunai" onClick={handleCashSale}>
          Bayar Tunai
        </TapTarget>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => alert("QRIS Static: Tampilkan QR untuk pelanggan, status Menunggu verifikasi")}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 }}
          >
            QRIS Static
          </button>
          <button
            onClick={() => (window.location.href = "/expenses")}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 }}
          >
            Catat Pengeluaran
          </button>
        </div>
      </section>
    </main>
  );
}
