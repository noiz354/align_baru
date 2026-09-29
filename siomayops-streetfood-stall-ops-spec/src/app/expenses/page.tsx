"use client";

import { useEffect, useRef, useState } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";
import { ReasonChips } from "@/shared/ui/ReasonChips";
import { MoneyText } from "@/shared/ui/MoneyText";
import { money, formatMoneyForOperator } from "@/shared/money/money";

const expenseChips = [
  { code: "TRANSPORT", labelMessageId: "Transport" },
  { code: "PARKING", labelMessageId: "Parkir" },
  { code: "CLEANING", labelMessageId: "Kebersihan" },
  { code: "CONSUMABLE", labelMessageId: "Bahan habis pakai" },
  { code: "REPAIR_MINOR", labelMessageId: "Perbaikan kecil" },
  { code: "UNVERIFIED_FIELD_EXPENSE", labelMessageId: "Biaya lapangan lain" },
  { code: "OTHER_OPERATIONAL", labelMessageId: "Lainnya" },
];

interface AuthorizedOutlet {
  outletId: string;
  outletName: string;
  operatorName: string;
  shiftStatus: string;
}

interface ExpenseListItem {
  id: string;
  stallId?: string;
  category: string;
  amountMinor: number;
  description: string;
  note?: string;
  paidFrom: "CASH_BOX" | "PERSONAL";
  reviewStatus: string;
  incurredAt: string;
}

function generateClientUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ExpensesPage() {
  const [authorizedOutlets, setAuthorizedOutlets] = useState<AuthorizedOutlet[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseListItem[]>([]);
  const [outletId, setOutletId] = useState<string>("00000000-0000-7000-0000-000000000020");
  const [category, setCategory] = useState("PARKING");
  const [amountInput, setAmountInput] = useState("");
  const [desc, setDesc] = useState("");
  const [paidFrom, setPaidFrom] = useState<"CASH_BOX" | "PERSONAL">("CASH_BOX");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientExpenseId, setClientExpenseId] = useState<string>(() => generateClientUuid());
  const lockRef = useRef(false);

  const loadExpenses = async () => {
    try {
      const res = await fetch("/api/v1/expenses", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.authorizedOutlets) && json.authorizedOutlets.length > 0) {
          setAuthorizedOutlets(json.authorizedOutlets);
          setOutletId(prev => prev || json.authorizedOutlets[0].outletId);
        }
        if (Array.isArray(json.data)) {
          setRecentExpenses(json.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async () => {
    if (lockRef.current || submitting) return;

    const parsedAmount = Number(amountInput.trim());
    if (!outletId) {
      setIsError(true);
      setStatus("Pilih outlet terlebih dahulu.");
      return;
    }
    if (!category) {
      setIsError(true);
      setStatus("Pilih kategori pengeluaran.");
      return;
    }
    if (
      !amountInput.trim() ||
      !/^-?\d+(\.\d+)?$/.test(amountInput.trim()) ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > 50_000_000
    ) {
      setIsError(true);
      setStatus("Nominal harus bilangan bulat Rupiah antara Rp 1 dan Rp 50.000.000.");
      return;
    }
    if (!desc.trim() || desc.trim().length < 3) {
      setIsError(true);
      setStatus("Deskripsi minimal 3 karakter.");
      return;
    }

    lockRef.current = true;
    setSubmitting(true);
    setIsError(false);
    setStatus("Menyimpan pengeluaran...");

    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientExpenseId },
        body: JSON.stringify({
          outletId,
          categoryCode: category,
          description: desc.trim(),
          amount: parsedAmount,
          paidFrom,
          note: note.trim() || undefined,
          clientExpenseId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        const formatted = formatMoneyForOperator(money(json.data.amount.amountMinor, "IDR"));
        setIsError(false);
        setStatus(
          `Berhasil catat pengeluaran ${formatted} (${json.data.categoryCode}) pada ${json.data.outletName} (ID: ${json.data.expenseId.slice(0, 8)})`
        );
        setAmountInput("");
        setDesc("");
        setNote("");
        setClientExpenseId(generateClientUuid());
        await loadExpenses();
      } else {
        setIsError(true);
        setStatus(`Gagal: ${json?.error?.message || "Periksa kembali data pengeluaran Anda."}`);
      }
    } catch (e: any) {
      setIsError(true);
      setStatus(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
      lockRef.current = false;
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <header
        style={{
          padding: 16,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Catat Pengeluaran</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/hq" style={{ fontSize: 14, color: "#0f766e", fontWeight: 600 }}>
            HQ
          </a>
          <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>
            Beranda
          </a>
        </div>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 16 }}>
        {authorizedOutlets.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>Outlet / Gerobak</label>
            <select
              value={outletId}
              disabled={submitting}
              onChange={e => setOutletId(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                background: "#fff",
              }}
            >
              {authorizedOutlets.map(o => (
                <option key={o.outletId} value={o.outletId}>
                  {o.outletName} ({o.operatorName})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Kategori</label>
          <ReasonChips chips={expenseChips} selectedCode={category} onSelect={setCategory} />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Jumlah (Rp)</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            disabled={submitting}
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
            placeholder="Contoh: 37450"
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 16 }}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Deskripsi singkat</label>
          <input
            type="text"
            disabled={submitting}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Misal: Pembelian gas LPG 3kg & plastik kemasan"
            maxLength={300}
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
          />
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Kategori netral, tidak perlu menyebut penerima atau otoritas. Opsional bukti foto.
          </p>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Sumber Dana</label>
          <select
            value={paidFrom}
            disabled={submitting}
            onChange={e => setPaidFrom(e.target.value as "CASH_BOX" | "PERSONAL")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="CASH_BOX">Kotak Kas Shift (CASH_BOX)</option>
            <option value="PERSONAL">Dana Pribadi (PERSONAL)</option>
          </select>
        </div>

        {status && (
          <div
            style={{
              padding: 12,
              background: isError ? "#fee2e2" : "#d1fae5",
              color: isError ? "#991b1b" : "#065f46",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {status}
          </div>
        )}

        <TapTarget
          minSize={72}
          label="Simpan Pengeluaran"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Menyimpan..." : "Simpan Pengeluaran"}
        </TapTarget>

        {recentExpenses.length > 0 && (
          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>
              Pengeluaran Tercatat ({recentExpenses.length})
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {recentExpenses.slice(0, 10).map(exp => (
                <div
                  key={exp.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #f3f4f6",
                    background: "#f9fafb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                      {exp.category} • {exp.paidFrom} • {exp.reviewStatus}
                    </div>
                    <div style={{ fontSize: 13, color: "#111827" }}>{exp.description}</div>
                  </div>
                  <MoneyText value={money(exp.amountMinor, "IDR")} density="hq" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
