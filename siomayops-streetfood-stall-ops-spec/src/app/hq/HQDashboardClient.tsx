"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FreshnessBadge } from "@/shared/ui/FreshnessBadge";
import { MoneyText } from "@/shared/ui/MoneyText";
import { TapTarget } from "@/shared/ui/TapTarget";
import { money, formatMoneyForOperator } from "@/shared/money/money";
import type { DashboardReadModel } from "@/features/hq";

interface HQDashboardClientProps {
  readonly initialData: DashboardReadModel;
  readonly autoOpenModal?: boolean;
  readonly autoOpenExpenseModal?: boolean;
}

type FormStatus = "idle" | "submitting" | "success" | "error";

interface TransactionFieldErrors {
  outletId?: string;
  amount?: string;
  paymentMethod?: string;
  occurredAt?: string;
  note?: string;
}

interface ExpenseFieldErrors {
  outletId?: string;
  categoryCode?: string;
  amount?: string;
  description?: string;
  paidFrom?: string;
  incurredAt?: string;
  note?: string;
}

const EXPENSE_CATEGORIES: readonly {
  code:
    | "TRANSPORT"
    | "PARKING"
    | "CLEANING"
    | "CONSUMABLE"
    | "REPAIR_MINOR"
    | "UNVERIFIED_FIELD_EXPENSE"
    | "OTHER_OPERATIONAL";
  label: string;
}[] = [
  { code: "TRANSPORT", label: "Transport & BBM (TRANSPORT)" },
  { code: "PARKING", label: "Parkir & Retribusi Lokasi (PARKING)" },
  { code: "CLEANING", label: "Kebersihan & Sanitasi (CLEANING)" },
  { code: "CONSUMABLE", label: "Bahan Habis Pakai / Kemasan (CONSUMABLE)" },
  { code: "REPAIR_MINOR", label: "Perbaikan Kecil Gerobak (REPAIR_MINOR)" },
  { code: "UNVERIFIED_FIELD_EXPENSE", label: "Biaya Lapangan Tanpa Bukti (UNVERIFIED_FIELD_EXPENSE)" },
  { code: "OTHER_OPERATIONAL", label: "Operasional Lainnya (OTHER_OPERATIONAL)" },
];

function generateClientUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function HQDashboardClient({
  initialData,
  autoOpenModal = false,
  autoOpenExpenseModal = false,
}: HQDashboardClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Authoritative server read model state (updated only from server read model)
  const [dashboard, setDashboard] = useState<DashboardReadModel>(initialData);

  // Sync when server component revalidates and passes updated initialData
  useEffect(() => {
    setDashboard(initialData);
  }, [initialData]);

  const [confirmationMessage, setConfirmationMessage] = useState<string>("");

  // --- Catat Transaksi Modal & Form State ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(autoOpenModal);
  const [outletId, setOutletId] = useState<string>(
    initialData.authorizedOutlets[0]?.outletId || ""
  );
  const [amountInput, setAmountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS_STATIC">("CASH");
  const [occurredAtInput, setOccurredAtInput] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");

  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<TransactionFieldErrors>({});
  const [serverError, setServerError] = useState<string>("");
  const [clientTransactionId, setClientTransactionId] = useState<string>(() => generateClientUuid());
  const submittingLockRef = useRef<boolean>(false);

  // --- Catat Pengeluaran Modal & Form State ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(autoOpenExpenseModal);
  const [expOutletId, setExpOutletId] = useState<string>(
    initialData.authorizedOutlets[0]?.outletId || ""
  );
  const [expCategoryCode, setExpCategoryCode] = useState<string>("PARKING");
  const [expAmountInput, setExpAmountInput] = useState<string>("");
  const [expDescriptionInput, setExpDescriptionInput] = useState<string>("");
  const [expPaidFrom, setExpPaidFrom] = useState<"CASH_BOX" | "PERSONAL">("CASH_BOX");
  const [expIncurredAtInput, setExpIncurredAtInput] = useState<string>("");
  const [expNoteInput, setExpNoteInput] = useState<string>("");

  const [expFormStatus, setExpFormStatus] = useState<FormStatus>("idle");
  const [expFieldErrors, setExpFieldErrors] = useState<ExpenseFieldErrors>({});
  const [expServerError, setExpServerError] = useState<string>("");
  const [clientExpenseId, setClientExpenseId] = useState<string>(() => generateClientUuid());
  const expSubmittingLockRef = useRef<boolean>(false);

  const openCatatTransaksiModal = (preselectedOutletId?: string) => {
    setOutletId(
      preselectedOutletId ||
        dashboard.authorizedOutlets[0]?.outletId ||
        ""
    );
    setAmountInput("");
    setPaymentMethod("CASH");
    setOccurredAtInput("");
    setNoteInput("");
    setFieldErrors({});
    setServerError("");
    setFormStatus("idle");
    setClientTransactionId(generateClientUuid());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (formStatus === "submitting") return;
    setIsModalOpen(false);
  };

  const openCatatPengeluaranModal = (preselectedOutletId?: string) => {
    setExpOutletId(
      preselectedOutletId ||
        dashboard.authorizedOutlets[0]?.outletId ||
        ""
    );
    setExpCategoryCode("PARKING");
    setExpAmountInput("");
    setExpDescriptionInput("");
    setExpPaidFrom("CASH_BOX");
    setExpIncurredAtInput("");
    setExpNoteInput("");
    setExpFieldErrors({});
    setExpServerError("");
    setExpFormStatus("idle");
    setClientExpenseId(generateClientUuid());
    setIsExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    if (expFormStatus === "submitting") return;
    setIsExpenseModalOpen(false);
  };

  const validateClientInput = (): {
    valid: boolean;
    parsedAmount: number;
    isoOccurredAt?: string;
  } => {
    const errors: TransactionFieldErrors = {};

    if (!outletId || !outletId.trim()) {
      errors.outletId = "Pilih outlet/gerobak terlebih dahulu.";
    }

    const cleanedAmount = amountInput.trim();
    const numericAmount = Number(cleanedAmount);
    if (!cleanedAmount) {
      errors.amount = "Nominal transaksi wajib diisi.";
    } else if (
      !/^-?\d+(\.\d+)?$/.test(cleanedAmount) ||
      !Number.isFinite(numericAmount)
    ) {
      errors.amount = "Nominal harus berupa angka yang valid.";
    } else if (!Number.isInteger(numericAmount)) {
      errors.amount = "Nominal harus bilangan bulat Rupiah (tanpa desimal).";
    } else if (numericAmount <= 0) {
      errors.amount = "Nominal transaksi harus lebih dari Rp 0.";
    } else if (numericAmount > 100_000_000) {
      errors.amount = "Nominal melebihi batas maksimum Rp 100.000.000.";
    }

    let isoOccurredAt: string | undefined = undefined;
    if (occurredAtInput.trim()) {
      const parsedDate = new Date(occurredAtInput.trim());
      if (Number.isNaN(parsedDate.getTime())) {
        errors.occurredAt = "Format waktu transaksi tidak valid.";
      } else if (parsedDate.getTime() > Date.now() + 5 * 60 * 1000) {
        errors.occurredAt = "Waktu transaksi tidak boleh di masa depan.";
      } else {
        isoOccurredAt = parsedDate.toISOString();
      }
    }

    if (noteInput.trim().length > 300) {
      errors.note = "Catatan maksimal 300 karakter.";
    }

    setFieldErrors(errors);
    return {
      valid: Object.keys(errors).length === 0,
      parsedAmount: numericAmount,
      isoOccurredAt,
    };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submittingLockRef.current || formStatus === "submitting") {
      return;
    }

    setServerError("");
    const validation = validateClientInput();
    if (!validation.valid) {
      setFormStatus("error");
      return;
    }

    submittingLockRef.current = true;
    setFormStatus("submitting");

    try {
      const response = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientTransactionId,
        },
        body: JSON.stringify({
          outletId: outletId.trim(),
          amount: validation.parsedAmount,
          paymentMethod,
          occurredAt: validation.isoOccurredAt,
          note: noteInput.trim() || undefined,
          clientTransactionId,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.data) {
        setFormStatus("error");
        const fieldErrs = json?.error?.details?.fieldErrors;
        if (fieldErrs) {
          setFieldErrors({
            outletId: fieldErrs.outletId?.[0],
            amount: fieldErrs.amount?.[0],
            paymentMethod: fieldErrs.paymentMethod?.[0],
            occurredAt: fieldErrs.occurredAt?.[0],
            note: fieldErrs.note?.[0],
          });
        }
        setServerError(
          json?.error?.message || "Gagal menyimpan transaksi. Silakan periksa kembali data Anda."
        );
        return;
      }

      const tx = json.data;
      if (json.dashboard) {
        setDashboard(json.dashboard);
      }
      setFormStatus("success");

      const formattedAmount = formatMoneyForOperator(
        money(tx.amount.amountMinor, "IDR")
      );
      setConfirmationMessage(
        `Transaksi ${formattedAmount} berhasil dicatat pada ${tx.outletName} (ID: ${tx.saleId.slice(0, 8)}).`
      );

      // Reset form & close modal after success
      setAmountInput("");
      setNoteInput("");
      setOccurredAtInput("");
      setFieldErrors({});
      setServerError("");
      setClientTransactionId(generateClientUuid());
      setIsModalOpen(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setFormStatus("error");
      setServerError(
        err?.message || "Gagal menghubungi server. Data Anda tetap tersimpan di formulir, silakan coba lagi."
      );
    } finally {
      submittingLockRef.current = false;
    }
  };

  const validateExpenseClientInput = (): {
    valid: boolean;
    parsedAmount: number;
    isoIncurredAt?: string;
  } => {
    const errors: ExpenseFieldErrors = {};

    if (!expOutletId || !expOutletId.trim()) {
      errors.outletId = "Pilih outlet/gerobak terlebih dahulu.";
    }

    if (!expCategoryCode || !EXPENSE_CATEGORIES.some(c => c.code === expCategoryCode)) {
      errors.categoryCode = "Pilih kategori pengeluaran operasional yang valid.";
    }

    const cleanedAmount = expAmountInput.trim();
    const numericAmount = Number(cleanedAmount);
    if (!cleanedAmount) {
      errors.amount = "Nominal pengeluaran wajib diisi.";
    } else if (
      !/^-?\d+(\.\d+)?$/.test(cleanedAmount) ||
      !Number.isFinite(numericAmount)
    ) {
      errors.amount = "Nominal harus berupa angka yang valid.";
    } else if (!Number.isInteger(numericAmount)) {
      errors.amount = "Nominal harus bilangan bulat Rupiah (tanpa desimal).";
    } else if (numericAmount <= 0) {
      errors.amount = "Nominal pengeluaran harus lebih dari Rp 0.";
    } else if (numericAmount > 50_000_000) {
      errors.amount = "Nominal melebihi batas maksimum Rp 50.000.000.";
    }

    const trimmedDesc = expDescriptionInput.trim();
    if (!trimmedDesc) {
      errors.description = "Deskripsi pengeluaran wajib diisi.";
    } else if (trimmedDesc.length < 3) {
      errors.description = "Deskripsi pengeluaran minimal 3 karakter.";
    } else if (trimmedDesc.length > 300) {
      errors.description = "Deskripsi pengeluaran maksimal 300 karakter.";
    }

    let isoIncurredAt: string | undefined = undefined;
    if (expIncurredAtInput.trim()) {
      const parsedDate = new Date(expIncurredAtInput.trim());
      if (Number.isNaN(parsedDate.getTime())) {
        errors.incurredAt = "Format waktu pengeluaran tidak valid.";
      } else if (parsedDate.getTime() > Date.now() + 5 * 60 * 1000) {
        errors.incurredAt = "Waktu pengeluaran tidak boleh di masa depan.";
      } else {
        isoIncurredAt = parsedDate.toISOString();
      }
    }

    if (expNoteInput.trim().length > 300) {
      errors.note = "Catatan pengeluaran maksimal 300 karakter.";
    }

    setExpFieldErrors(errors);
    return {
      valid: Object.keys(errors).length === 0,
      parsedAmount: numericAmount,
      isoIncurredAt,
    };
  };

  const handleExpenseSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (expSubmittingLockRef.current || expFormStatus === "submitting") {
      return;
    }

    setExpServerError("");
    const validation = validateExpenseClientInput();
    if (!validation.valid) {
      setExpFormStatus("error");
      return;
    }

    expSubmittingLockRef.current = true;
    setExpFormStatus("submitting");

    try {
      const response = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientExpenseId,
        },
        body: JSON.stringify({
          outletId: expOutletId.trim(),
          categoryCode: expCategoryCode,
          amount: validation.parsedAmount,
          description: expDescriptionInput.trim(),
          paidFrom: expPaidFrom,
          incurredAt: validation.isoIncurredAt,
          note: expNoteInput.trim() || undefined,
          clientExpenseId,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.data) {
        setExpFormStatus("error");
        const fieldErrs = json?.error?.details?.fieldErrors;
        if (fieldErrs) {
          setExpFieldErrors({
            outletId: fieldErrs.outletId?.[0],
            categoryCode: fieldErrs.categoryCode?.[0],
            amount: fieldErrs.amount?.[0],
            description: fieldErrs.description?.[0],
            paidFrom: fieldErrs.paidFrom?.[0],
            incurredAt: fieldErrs.incurredAt?.[0],
            note: fieldErrs.note?.[0],
          });
        }
        setExpServerError(
          json?.error?.message || "Gagal menyimpan pengeluaran. Silakan periksa kembali data Anda."
        );
        return;
      }

      const exp = json.data;
      if (json.dashboard) {
        setDashboard(json.dashboard);
      }
      setExpFormStatus("success");

      const formattedAmount = formatMoneyForOperator(
        money(exp.amount.amountMinor, "IDR")
      );
      setConfirmationMessage(
        `Pengeluaran ${formattedAmount} (${exp.categoryCode}) berhasil dicatat pada ${exp.outletName} (ID: ${exp.expenseId.slice(0, 8)}).`
      );

      // Reset form & close modal after success
      setExpAmountInput("");
      setExpDescriptionInput("");
      setExpNoteInput("");
      setExpIncurredAtInput("");
      setExpFieldErrors({});
      setExpServerError("");
      setClientExpenseId(generateClientUuid());
      setIsExpenseModalOpen(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setExpFormStatus("error");
      setExpServerError(
        err?.message || "Gagal menghubungi server. Data Anda tetap tersimpan di formulir, silakan coba lagi."
      );
    } finally {
      expSubmittingLockRef.current = false;
    }
  };

  const handleManualRefresh = async () => {
    try {
      const res = await fetch("/api/v1/hq/dashboard", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setDashboard(json.data);
        }
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {}
  };

  const previewAmountMinor =
    amountInput.trim() &&
    /^\d+$/.test(amountInput.trim()) &&
    Number.isSafeInteger(Number(amountInput.trim())) &&
    Number(amountInput.trim()) > 0
      ? Number(amountInput.trim())
      : null;

  const previewExpenseAmountMinor =
    expAmountInput.trim() &&
    /^\d+$/.test(expAmountInput.trim()) &&
    Number.isSafeInteger(Number(expAmountInput.trim())) &&
    Number(expAmountInput.trim()) > 0
      ? Number(expAmountInput.trim())
      : null;

  const Card = ({
    title,
    children,
    band = dashboard.freshnessBand,
  }: {
    title: string;
    children: React.ReactNode;
    band?: "current" | "recent" | "stale";
  }) => (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
        <FreshnessBadge computedAt={new Date(dashboard.computedAt)} band={band} />
      </div>
      {children}
    </div>
  );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16, background: "#f9fafb", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>HQ Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Coverage, penjualan, pengeluaran, kas, verifikasi, performa outlet, dan aktivitas terbaru — DB live ({dashboard.businessDay})
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="open-catat-transaksi-btn"
            onClick={() => openCatatTransaksiModal()}
            style={{
              padding: "10px 16px",
              background: "#0f766e",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            + Catat Transaksi
          </button>
          <button
            type="button"
            data-testid="open-catat-pengeluaran-btn"
            onClick={() => openCatatPengeluaranModal()}
            style={{
              padding: "10px 16px",
              background: "#b45309",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            + Catat Pengeluaran
          </button>
          <button
            type="button"
            onClick={handleManualRefresh}
            style={{
              padding: "10px 12px",
              background: "#ffffff",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Segarkan
          </button>
          <a href="/" style={{ fontSize: 14, color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
            ← Operator
          </a>
        </div>
      </header>

      {confirmationMessage && (
        <div
          role="status"
          data-testid="transaction-success-banner"
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "#d1fae5",
            border: "1px solid #6ee7b7",
            color: "#065f46",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{confirmationMessage}</span>
          <button
            type="button"
            onClick={() => setConfirmationMessage("")}
            style={{
              background: "transparent",
              border: "none",
              color: "#065f46",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        <Card title="Coverage Hari Ini">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Shift aktif</span>
              <strong>{dashboard.coverage.shiftsActive}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tanpa laporan lokasi</span>
              <strong>{dashboard.coverage.shiftsWithoutLocationReport}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Gerobak idle</span>
              <strong>{dashboard.coverage.stallsIdle}</strong>
            </div>
            {dashboard.coverage.activeShifts.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#0f766e" }}>
                {dashboard.coverage.activeShifts
                  .map(s => `Stall ${s.stallCode} • ${s.operatorName} • Kas awal Rp ${s.openingCash.amountMinor.toLocaleString("id-ID")}`)
                  .join(" | ")}
              </div>
            )}
          </div>
        </Card>

        <Card title="Penjualan Hari Ini">
          <div style={{ display: "grid", gap: 6 }} data-testid="kpi-sales-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>Total</span>
              <span data-testid="kpi-total-sales">
                <MoneyText value={money(dashboard.sales.totalSales.amountMinor, "IDR")} density="hq" />
              </span>
            </div>
            <div style={{ fontSize: 13 }} data-testid="kpi-transaction-count">
              Transaksi: {dashboard.sales.count}
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", display: "flex", justifyContent: "space-between" }}>
              <span>Tunai (PAID)</span>
              <MoneyText value={money(dashboard.sales.grossByMethod.CASH.amountMinor, "IDR")} density="hq" />
            </div>
            {dashboard.sales.grossByMethod.DIGITAL_UNVERIFIED.amountMinor > 0 && (
              <div style={{ fontSize: 12, color: "#b45309", display: "flex", justifyContent: "space-between" }}>
                <span>QRIS Belum Verifikasi</span>
                <MoneyText
                  value={money(dashboard.sales.grossByMethod.DIGITAL_UNVERIFIED.amountMinor, "IDR")}
                  density="hq"
                />
              </div>
            )}
            {dashboard.sales.count > 0 && (
              <div style={{ fontSize: 11, color: "#16a34a" }}>• Penjualan terbaru tersinkronisasi</div>
            )}
          </div>
        </Card>

        <Card title="Posisi Kas" band="recent">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }} data-testid="kpi-cash-card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Diharapkan</span>
              <span data-testid="kpi-expected-cash">
                <MoneyText value={money(dashboard.cashPosition.expectedCash.amountMinor, "IDR")} density="hq" />
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563" }}>
              <span>Pengeluaran Kas</span>
              <span data-testid="kpi-cash-expenses">
                <MoneyText value={money(dashboard.cashPosition.cashExpenses.amountMinor, "IDR")} density="hq" />
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Dihitung</span>
              <MoneyText value={money(dashboard.cashPosition.countedCash.amountMinor, "IDR")} density="hq" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Selisih</span>
              <MoneyText value={money(dashboard.cashPosition.varianceAmount.amountMinor, "IDR")} density="hq" />
            </div>
            <div>Verifikasi tertunda: {dashboard.cashPosition.unresolvedVerificationsCount}</div>
          </div>
        </Card>

        <Card title="Antrian Verifikasi">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Pending</span>
              <strong>{dashboard.verificationBacklog.pendingCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Nilai belum verifikasi</span>
              <MoneyText
                value={money(dashboard.verificationBacklog.pendingAmountUnverified.amountMinor, "IDR")}
                density="hq"
                emphasis="waiting"
              />
            </div>
            <div>Umur tertua: {dashboard.verificationBacklog.oldestAgeHours.toFixed(1)} jam</div>
          </div>
        </Card>

        <Card title="Pengeluaran & Antrian Review">
          <div style={{ fontSize: 13, display: "grid", gap: 6 }} data-testid="kpi-expense-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Total Pengeluaran</span>
              <span data-testid="kpi-total-expenses">
                <MoneyText value={money(dashboard.expenses.totalExpenses.amountMinor, "IDR")} density="hq" />
              </span>
            </div>
            <div data-testid="kpi-expense-count">
              Pengeluaran tercatat: {dashboard.expenses.count}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563" }}>
              <span>Dari Kotak Kas</span>
              <span data-testid="kpi-cashbox-expenses">
                <MoneyText value={money(dashboard.expenses.cashBoxExpenses.amountMinor, "IDR")} density="hq" />
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Pending review: {dashboard.expenseReview.pending} • Flagged: {dashboard.expenseReview.flagged}
            </div>
            <a href="/hq/expenses" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>
              Lihat antrian →
            </a>
          </div>
        </Card>

        <Card title="Insiden">
          <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
            <div>Terbuka: {dashboard.incidents.open}</div>
            <div>Kritis: {dashboard.incidents.critical}</div>
            <a href="/hq/incidents" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>
              Lihat board →
            </a>
          </div>
        </Card>

        <Card title="Kelengkapan Tutup Shift">
          <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
            <div>Terkirim: {dashboard.closings.submitted}</div>
            <div>Belum: {dashboard.closings.missing}</div>
          </div>
        </Card>

        <Card title="Penggunaan Lokasi">
          <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
            <div>
              Lokasi aktif: {dashboard.locations.activeLocations} — {dashboard.locations.primaryLocationName}
            </div>
            <div>Padat: {dashboard.locations.crowded}</div>
          </div>
        </Card>

        <Card title="Eksepsi">
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {dashboard.exceptions.items.length === 0 ? (
              <div>• Tidak ada eksepsi</div>
            ) : (
              dashboard.exceptions.items.slice(0, 3).map((ex, i) => <div key={i}>• {ex}</div>)
            )}
          </div>
        </Card>

        <Card title="Stok">
          <div style={{ fontSize: 13 }}>
            <div>Stok menipis: {dashboard.stock.low}</div>
            <div>Habis: {dashboard.stock.habis}</div>
            {dashboard.stock.items.slice(0, 4).map(it => (
              <div
                key={it.stockItemId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: it.currentQty < 10 ? "#b45309" : "#374151",
                }}
              >
                <span>{it.name}</span>
                <strong>{it.currentQty}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Per-Outlet Sales & Expense Aggregation Section */}
      <section
        data-testid="outlet-aggregation-section"
        style={{
          marginTop: 24,
          padding: 16,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Penjualan & Pengeluaran per Outlet / Gerobak</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
              Agregasi penjualan terverifikasi, pengeluaran operasional, dan jumlah transaksi per outlet aktif
            </p>
          </div>
          <FreshnessBadge computedAt={new Date(dashboard.computedAt)} band={dashboard.freshnessBand} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                <th style={{ padding: "8px 10px" }}>Outlet / Lokasi</th>
                <th style={{ padding: "8px 10px" }}>Operator</th>
                <th style={{ padding: "8px 10px" }}>Status Shift</th>
                <th style={{ padding: "8px 10px" }}>Transaksi</th>
                <th style={{ padding: "8px 10px" }}>Total Penjualan</th>
                <th style={{ padding: "8px 10px" }}>Pengeluaran</th>
                <th style={{ padding: "8px 10px" }}>Total Pengeluaran</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.outlets.map(outlet => (
                <tr
                  key={outlet.outletId}
                  data-testid={`outlet-row-${outlet.stallCode}`}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "10px", fontWeight: 600 }}>{outlet.outletName}</td>
                  <td style={{ padding: "10px" }}>{outlet.operatorName}</td>
                  <td style={{ padding: "10px" }}>
                    <span
                      style={{
                        background: outlet.shiftStatus === "OPEN" ? "#d1fae5" : "#f3f4f6",
                        color: outlet.shiftStatus === "OPEN" ? "#065f46" : "#374151",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {outlet.shiftStatus}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }} data-testid={`outlet-tx-count-${outlet.stallCode}`}>
                    {outlet.transactionCount} transaksi
                  </td>
                  <td style={{ padding: "10px" }} data-testid={`outlet-sales-${outlet.stallCode}`}>
                    <MoneyText value={money(outlet.totalSales.amountMinor, "IDR")} density="hq" />
                  </td>
                  <td style={{ padding: "10px" }} data-testid={`outlet-expense-count-${outlet.stallCode}`}>
                    {outlet.expenseCount} pengeluaran
                  </td>
                  <td style={{ padding: "10px" }} data-testid={`outlet-expenses-${outlet.stallCode}`}>
                    <MoneyText value={money(outlet.totalExpenses.amountMinor, "IDR")} density="hq" />
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => openCatatTransaksiModal(outlet.outletId)}
                        style={{
                          padding: "6px 10px",
                          background: "#f0fdfa",
                          color: "#0f766e",
                          border: "1px solid #99f6e4",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        + Transaksi
                      </button>
                      <button
                        type="button"
                        onClick={() => openCatatPengeluaranModal(outlet.outletId)}
                        style={{
                          padding: "6px 10px",
                          background: "#fffbeb",
                          color: "#b45309",
                          border: "1px solid #fde68a",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        + Pengeluaran
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Activity Feed Section */}
      <section
        data-testid="recent-activity-section"
        style={{
          marginTop: 24,
          padding: 16,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Aktivitas Terbaru</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
              Riwayat transaksi penjualan dan pengeluaran operasional pada penyimpanan otoritatif
            </p>
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Menampilkan {dashboard.recentActivity.length} aktivitas terbaru
          </span>
        </div>

        {dashboard.recentActivity.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            Belum ada aktivitas hari ini.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {dashboard.recentActivity.map((act, index) => {
              const isExpense = act.kind === "EXPENSE";
              return (
                <div
                  key={`${act.kind}-${act.id}`}
                  data-testid={index === 0 ? "latest-activity-item" : `activity-item-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    border: "1px solid #f3f4f6",
                    borderRadius: 10,
                    background: index === 0 ? (isExpense ? "#fffbeb" : "#f0fdf4") : "#f9fafb",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "grid", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: isExpense
                            ? "#fef3c7"
                            : act.paymentStatus === "PAID"
                              ? "#d1fae5"
                              : "#fef3c7",
                          color: isExpense
                            ? "#92400e"
                            : act.paymentStatus === "PAID"
                              ? "#065f46"
                              : "#92400e",
                        }}
                      >
                        {isExpense
                          ? `PENGELUARAN • ${act.categoryCode || "OPERATIONAL"} • ${act.paidFrom || act.paymentMethod} • ${act.status}`
                          : `${act.paymentMethod} • ${act.paymentStatus}`}
                      </span>
                      <strong style={{ fontSize: 13, color: "#111827" }}>{act.outletName}</strong>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>({act.operatorName})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      ID: {act.id.slice(0, 8)}
                      {act.note ? ` • ${act.note}` : ""}
                      {" • "}
                      {new Date(act.occurredAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: isExpense ? "#b45309" : "#111827" }}>
                    <MoneyText value={money(act.amount.amountMinor, "IDR")} density="hq" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Aksi Cepat</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => openCatatTransaksiModal()}
            style={{
              padding: "8px 14px",
              background: "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Catat Transaksi
          </button>
          <button
            type="button"
            onClick={() => openCatatPengeluaranModal()}
            style={{
              padding: "8px 14px",
              background: "#b45309",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Catat Pengeluaran
          </button>
          <a
            href="/hq/verification"
            style={{
              padding: "8px 12px",
              background: "#fff",
              color: "#0f766e",
              border: "1px solid #0f766e",
              borderRadius: 8,
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Verifikasi Pembayaran
          </a>
          <a
            href="/hq/expenses"
            style={{
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 13,
              textDecoration: "none",
              color: "#111",
            }}
          >
            Review Pengeluaran
          </a>
          <a
            href="/hq/incidents"
            style={{
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 13,
              textDecoration: "none",
              color: "#111",
            }}
          >
            Insiden
          </a>
        </div>
      </section>

      {/* Catat Transaksi Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="catat-transaksi-title"
          data-testid="catat-transaksi-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 id="catat-transaksi-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Catat Transaksi
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Catat transaksi penjualan langsung ke penyimpanan otoritatif
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={formStatus === "submitting"}
                aria-label="Tutup modal"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  color: "#6b7280",
                  cursor: formStatus === "submitting" ? "not-allowed" : "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 20, display: "grid", gap: 14 }} noValidate>
              {serverError && (
                <div
                  role="alert"
                  data-testid="transaction-form-error"
                  style={{
                    padding: "10px 12px",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#991b1b",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {serverError}
                </div>
              )}

              {/* Outlet Selection */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="tx-outlet-select" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Outlet / Gerobak Resmi *
                </label>
                <select
                  id="tx-outlet-select"
                  data-testid="tx-outlet-select"
                  value={outletId}
                  disabled={formStatus === "submitting"}
                  onChange={e => {
                    setOutletId(e.target.value);
                    if (fieldErrors.outletId) setFieldErrors(prev => ({ ...prev, outletId: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: fieldErrors.outletId ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="">-- Pilih Outlet Resmi --</option>
                  {dashboard.authorizedOutlets.map(o => (
                    <option key={o.outletId} value={o.outletId}>
                      {o.outletName} ({o.operatorName} • {o.shiftStatus})
                    </option>
                  ))}
                </select>
                {fieldErrors.outletId && (
                  <span data-testid="error-outletId" style={{ fontSize: 12, color: "#dc2626" }}>
                    {fieldErrors.outletId}
                  </span>
                )}
              </div>

              {/* Amount Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="tx-amount-input" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    Nominal Transaksi (Rp) *
                  </label>
                  {previewAmountMinor !== null && (
                    <span style={{ fontSize: 12, color: "#0f766e", fontWeight: 700 }}>
                      {formatMoneyForOperator(money(previewAmountMinor, "IDR"))}
                    </span>
                  )}
                </div>
                <input
                  id="tx-amount-input"
                  data-testid="tx-amount-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="Contoh: 85137"
                  value={amountInput}
                  disabled={formStatus === "submitting"}
                  onChange={e => {
                    setAmountInput(e.target.value);
                    if (fieldErrors.amount) setFieldErrors(prev => ({ ...prev, amount: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: fieldErrors.amount ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                />
                {fieldErrors.amount && (
                  <span data-testid="error-amount" style={{ fontSize: 12, color: "#dc2626" }}>
                    {fieldErrors.amount}
                  </span>
                )}
              </div>

              {/* Payment Method */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="tx-payment-method" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Metode Pembayaran
                </label>
                <select
                  id="tx-payment-method"
                  data-testid="tx-payment-method"
                  value={paymentMethod}
                  disabled={formStatus === "submitting"}
                  onChange={e => setPaymentMethod(e.target.value as "CASH" | "QRIS_STATIC")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="CASH">Tunai (CASH — Langsung Lunas)</option>
                  <option value="QRIS_STATIC">QRIS Statis (Menunggu Verifikasi)</option>
                </select>
              </div>

              {/* OccurredAt Optional Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="tx-occurred-at" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Waktu Transaksi (Opsional — Default Waktu Server)
                </label>
                <input
                  id="tx-occurred-at"
                  data-testid="tx-occurred-at"
                  type="datetime-local"
                  value={occurredAtInput}
                  disabled={formStatus === "submitting"}
                  onChange={e => {
                    setOccurredAtInput(e.target.value);
                    if (fieldErrors.occurredAt) setFieldErrors(prev => ({ ...prev, occurredAt: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: fieldErrors.occurredAt ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
                {fieldErrors.occurredAt && (
                  <span data-testid="error-occurredAt" style={{ fontSize: 12, color: "#dc2626" }}>
                    {fieldErrors.occurredAt}
                  </span>
                )}
              </div>

              {/* Note Optional Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="tx-note-input" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  id="tx-note-input"
                  data-testid="tx-note-input"
                  type="text"
                  maxLength={300}
                  placeholder="Misal: Pesanan rombongan siang"
                  value={noteInput}
                  disabled={formStatus === "submitting"}
                  onChange={e => {
                    setNoteInput(e.target.value);
                    if (fieldErrors.note) setFieldErrors(prev => ({ ...prev, note: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: fieldErrors.note ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
                {fieldErrors.note && (
                  <span data-testid="error-note" style={{ fontSize: 12, color: "#dc2626" }}>
                    {fieldErrors.note}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={formStatus === "submitting"}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: formStatus === "submitting" ? "not-allowed" : "pointer",
                    minHeight: 44,
                  }}
                >
                  Batal
                </button>
                <TapTarget
                  minSize={44}
                  label="Simpan Transaksi"
                  disabled={formStatus === "submitting"}
                  onClick={() => handleSubmit()}
                >
                  {formStatus === "submitting" ? "Menyimpan..." : "Simpan Transaksi"}
                </TapTarget>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Catat Pengeluaran Modal */}
      {isExpenseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="catat-pengeluaran-title"
          data-testid="catat-pengeluaran-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 id="catat-pengeluaran-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Catat Pengeluaran
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Catat pengeluaran operasional outlet dengan kategori netral
                </p>
              </div>
              <button
                type="button"
                onClick={closeExpenseModal}
                disabled={expFormStatus === "submitting"}
                aria-label="Tutup modal pengeluaran"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  color: "#6b7280",
                  cursor: expFormStatus === "submitting" ? "not-allowed" : "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} style={{ padding: 20, display: "grid", gap: 14 }} noValidate>
              {expServerError && (
                <div
                  role="alert"
                  data-testid="expense-form-error"
                  style={{
                    padding: "10px 12px",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#991b1b",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {expServerError}
                </div>
              )}

              {/* Outlet Selection */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-outlet-select" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Outlet / Gerobak Resmi *
                </label>
                <select
                  id="exp-outlet-select"
                  data-testid="exp-outlet-select"
                  value={expOutletId}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpOutletId(e.target.value);
                    if (expFieldErrors.outletId) setExpFieldErrors(prev => ({ ...prev, outletId: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.outletId ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="">-- Pilih Outlet Resmi --</option>
                  {dashboard.authorizedOutlets.map(o => (
                    <option key={o.outletId} value={o.outletId}>
                      {o.outletName} ({o.operatorName} • {o.shiftStatus})
                    </option>
                  ))}
                </select>
                {expFieldErrors.outletId && (
                  <span data-testid="error-exp-outletId" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.outletId}
                  </span>
                )}
              </div>

              {/* Neutral Category Selection */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-category-select" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Kategori Pengeluaran Operasional *
                </label>
                <select
                  id="exp-category-select"
                  data-testid="exp-category-select"
                  value={expCategoryCode}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpCategoryCode(e.target.value);
                    if (expFieldErrors.categoryCode) setExpFieldErrors(prev => ({ ...prev, categoryCode: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.categoryCode ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {expFieldErrors.categoryCode && (
                  <span data-testid="error-exp-categoryCode" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.categoryCode}
                  </span>
                )}
              </div>

              {/* Expense Amount Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="exp-amount-input" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    Nominal Pengeluaran (Rp) *
                  </label>
                  {previewExpenseAmountMinor !== null && (
                    <span style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                      {formatMoneyForOperator(money(previewExpenseAmountMinor, "IDR"))}
                    </span>
                  )}
                </div>
                <input
                  id="exp-amount-input"
                  data-testid="exp-amount-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="Contoh: 37450"
                  value={expAmountInput}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpAmountInput(e.target.value);
                    if (expFieldErrors.amount) setExpFieldErrors(prev => ({ ...prev, amount: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.amount ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                />
                {expFieldErrors.amount && (
                  <span data-testid="error-exp-amount" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.amount}
                  </span>
                )}
              </div>

              {/* Description Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-description-input" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Deskripsi Singkat *
                </label>
                <input
                  id="exp-description-input"
                  data-testid="exp-description-input"
                  type="text"
                  maxLength={300}
                  placeholder="Misal: Pembelian gas LPG 3kg & plastik kemasan"
                  value={expDescriptionInput}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpDescriptionInput(e.target.value);
                    if (expFieldErrors.description) setExpFieldErrors(prev => ({ ...prev, description: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.description ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
                {expFieldErrors.description && (
                  <span data-testid="error-exp-description" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.description}
                  </span>
                )}
              </div>

              {/* Paid From Selection */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-paid-from" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Sumber Dana
                </label>
                <select
                  id="exp-paid-from"
                  data-testid="exp-paid-from"
                  value={expPaidFrom}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => setExpPaidFrom(e.target.value as "CASH_BOX" | "PERSONAL")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  <option value="CASH_BOX">Kotak Kas Shift (CASH_BOX — Mengurangi Kas Diharapkan)</option>
                  <option value="PERSONAL">Dana Pribadi Operator (PERSONAL — Reimburse)</option>
                </select>
              </div>

              {/* IncurredAt Optional Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-incurred-at" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Waktu Pengeluaran (Opsional — Default Waktu Server)
                </label>
                <input
                  id="exp-incurred-at"
                  data-testid="exp-incurred-at"
                  type="datetime-local"
                  value={expIncurredAtInput}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpIncurredAtInput(e.target.value);
                    if (expFieldErrors.incurredAt) setExpFieldErrors(prev => ({ ...prev, incurredAt: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.incurredAt ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
                {expFieldErrors.incurredAt && (
                  <span data-testid="error-exp-incurredAt" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.incurredAt}
                  </span>
                )}
              </div>

              {/* Note Optional Input */}
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="exp-note-input" style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  id="exp-note-input"
                  data-testid="exp-note-input"
                  type="text"
                  maxLength={300}
                  placeholder="Misal: Nota fisik disimpan di laci gerobak"
                  value={expNoteInput}
                  disabled={expFormStatus === "submitting"}
                  onChange={e => {
                    setExpNoteInput(e.target.value);
                    if (expFieldErrors.note) setExpFieldErrors(prev => ({ ...prev, note: undefined }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: expFieldErrors.note ? "1px solid #dc2626" : "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
                {expFieldErrors.note && (
                  <span data-testid="error-exp-note" style={{ fontSize: 12, color: "#dc2626" }}>
                    {expFieldErrors.note}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={closeExpenseModal}
                  disabled={expFormStatus === "submitting"}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: expFormStatus === "submitting" ? "not-allowed" : "pointer",
                    minHeight: 44,
                  }}
                >
                  Batal
                </button>
                <TapTarget
                  minSize={44}
                  label="Simpan Pengeluaran"
                  disabled={expFormStatus === "submitting"}
                  onClick={() => handleExpenseSubmit()}
                >
                  {expFormStatus === "submitting" ? "Menyimpan..." : "Simpan Pengeluaran"}
                </TapTarget>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
