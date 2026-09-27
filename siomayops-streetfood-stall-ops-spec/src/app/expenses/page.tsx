"use client";

import { useState } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";
import { ReasonChips } from "@/shared/ui/ReasonChips";

const expenseChips = [
  { code: "TRANSPORT", labelMessageId: "Transport" },
  { code: "PARKING", labelMessageId: "Parkir" },
  { code: "CLEANING", labelMessageId: "Kebersihan" },
  { code: "CONSUMABLE", labelMessageId: "Bahan habis pakai" },
  { code: "REPAIR_MINOR", labelMessageId: "Perbaikan kecil" },
  { code: "UNVERIFIED_FIELD_EXPENSE", labelMessageId: "Biaya lapangan lain" },
  { code: "OTHER_OPERATIONAL", labelMessageId: "Lainnya" },
];

export default function ExpensesPage() {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async () => {
    if (!category || !amount || !desc) {
      setStatus("Lengkapi kategori, jumlah, dan deskripsi");
      return;
    }
    setStatus("Mengirim...");
    try {
      const clientExpenseId = crypto.randomUUID();
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientExpenseId },
        body: JSON.stringify({
          shiftId: "00000000-0000-7000-0000-000000000001",
          categoryId: "00000000-0000-7000-0000-000000000040",
          description: desc,
          amount: { amountMinor: amount, currency: "IDR" },
          paidFrom: "CASH_BOX",
          clientExpenseId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Berhasil catat pengeluaran: ${data.expenseId}`);
        setCategory("");
        setAmount(0);
        setDesc("");
      } else {
        setStatus(`Gagal: ${data.error?.message}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Pengeluaran</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 16 }}>
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Kategori</label>
          <ReasonChips chips={expenseChips} selectedCode={category} onSelect={setCategory} />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Jumlah (Rp)</label>
          <input
            type="number"
            value={amount || ""}
            onChange={e => setAmount(Number(e.target.value))}
            placeholder="Contoh: 20000"
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 16 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Deskripsi singkat</label>
          <input
            type="text"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Misal: Parkir alun-alun"
            maxLength={300}
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
          />
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Kategori netral, tidak perlu menyebut penerima atau otoritas. Opsional bukti foto.
          </p>
        </div>

        {status && (
          <div style={{ padding: 12, background: status.startsWith("Berhasil") ? "#d1fae5" : "#fee2e2", borderRadius: 8, fontSize: 14 }}>
            {status}
          </div>
        )}

        <TapTarget minSize={72} label="Simpan Pengeluaran" onClick={handleSubmit}>
          Simpan Pengeluaran
        </TapTarget>
      </section>
    </main>
  );
}
