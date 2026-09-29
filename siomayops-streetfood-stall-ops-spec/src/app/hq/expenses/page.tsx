"use client";

import { useEffect, useState } from "react";
import { MoneyText } from "@/shared/ui/MoneyText";
import { money } from "@/shared/money/money";

interface PersistedExpense {
  id: string;
  shiftId: string;
  stallId?: string;
  category: string;
  amountMinor: number;
  description: string;
  note?: string;
  paidFrom: "CASH_BOX" | "PERSONAL";
  reviewStatus: string;
  flaggedReason?: string;
  incurredAt: string;
}

export default function HQExpensesPage() {
  const [expenses, setExpenses] = useState<PersistedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/expenses", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setExpenses(Array.isArray(json.data) ? json.data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const totalMinor = expenses
    .filter(e => e.reviewStatus !== "REJECTED")
    .reduce((sum, e) => sum + e.amountMinor, 0);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review & Daftar Pengeluaran</h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "4px 0 0" }}>
            Antrian pengeluaran lapangan dengan kategori netral dari penyimpanan otoritatif.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/hq?action=catat-pengeluaran"
            style={{
              padding: "8px 14px",
              background: "#b45309",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            + Catat Pengeluaran
          </a>
          <a href="/hq" style={{ fontSize: 14, color: "#0f766e", fontWeight: 600 }}>
            ← Kembali ke Dashboard
          </a>
        </div>
      </header>

      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
          Total Pengeluaran Aktif ({expenses.length} item)
        </span>
        <MoneyText value={money(totalMinor, "IDR")} density="hq" />
      </div>

      <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Memuat data pengeluaran...</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>
            Belum ada pengeluaran yang tercatat hari ini.
          </div>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: 8 }}>ID</th>
                <th style={{ padding: 8 }}>Kategori</th>
                <th style={{ padding: 8 }}>Deskripsi</th>
                <th style={{ padding: 8 }}>Sumber Dana</th>
                <th style={{ padding: 8 }}>Jumlah</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{exp.id.slice(0, 8)}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{exp.category}</td>
                  <td style={{ padding: 8 }}>
                    {exp.description}
                    {exp.note ? <span style={{ color: "#6b7280" }}> ({exp.note})</span> : null}
                  </td>
                  <td style={{ padding: 8 }}>{exp.paidFrom}</td>
                  <td style={{ padding: 8 }}>
                    <MoneyText value={money(exp.amountMinor, "IDR")} density="hq" />
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        background: exp.reviewStatus === "REVIEW_REQUIRED" ? "#fef3c7" : "#d1fae5",
                        color: exp.reviewStatus === "REVIEW_REQUIRED" ? "#92400e" : "#065f46",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {exp.reviewStatus}
                      {exp.flaggedReason ? ` (${exp.flaggedReason})` : ""}
                    </span>
                  </td>
                  <td style={{ padding: 8, color: "#6b7280" }}>
                    {new Date(exp.incurredAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
