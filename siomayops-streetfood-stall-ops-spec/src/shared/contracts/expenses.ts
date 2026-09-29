import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema } from "./common";

export const expenseSubmitRequestSchema = z.object({
  shiftId: uuidSchema,
  categoryId: uuidSchema.optional(),
  categoryCode: z.string().optional(),
  description: z.string().min(3).max(300),
  amount: moneySchema,
  paidFrom: z.enum(["CASH_BOX", "PERSONAL"]),
  operatorNote: z.string().max(500).optional(),
  evidenceAssetId: uuidSchema.optional(),
  clientExpenseId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional()
});
export type ExpenseSubmitRequest = z.infer<typeof expenseSubmitRequestSchema>;

export const expenseReviewRequestSchema = z.object({
  expenseId: uuidSchema,
  decision: z.enum(["REVIEWED", "REJECTED", "ESCALATED"]),
  reason: z.string().min(3).max(300)
});

export const MAX_EXPENSE_AMOUNT_MINOR = 50_000_000; // Rp 50.000.000 max per single operational expense

export const supportedExpenseCategories = [
  "TRANSPORT",
  "PARKING",
  "CLEANING",
  "CONSUMABLE",
  "REPAIR_MINOR",
  "UNVERIFIED_FIELD_EXPENSE",
  "OTHER_OPERATIONAL",
] as const;

export const supportedExpensePaidFrom = ["CASH_BOX", "PERSONAL"] as const;

export const recordExpenseRequestSchema = z.object({
  outletId: z.string().trim().min(1, "Outlet wajib dipilih"),
  categoryCode: z.enum(supportedExpenseCategories, {
    errorMap: () => ({ message: "Pilih kategori pengeluaran operasional yang valid" }),
  }),
  amount: z
    .number({
      required_error: "Nominal pengeluaran wajib diisi",
      invalid_type_error: "Nominal pengeluaran harus berupa angka",
    })
    .finite("Nominal pengeluaran harus berupa angka hingga (finite)")
    .int("Nominal pengeluaran harus berupa bilangan bulat (Rupiah)")
    .positive("Nominal pengeluaran harus lebih dari Rp 0")
    .max(MAX_EXPENSE_AMOUNT_MINOR, "Nominal pengeluaran melebihi batas maksimum Rp 50.000.000"),
  description: z
    .string({
      required_error: "Deskripsi pengeluaran wajib diisi",
      invalid_type_error: "Deskripsi pengeluaran harus berupa teks",
    })
    .trim()
    .min(3, "Deskripsi pengeluaran minimal 3 karakter")
    .max(300, "Deskripsi pengeluaran maksimal 300 karakter"),
  paidFrom: z.enum(supportedExpensePaidFrom).default("CASH_BOX"),
  incurredAt: z
    .string()
    .trim()
    .optional()
    .refine(
      val => {
        if (!val) return true;
        const ts = Date.parse(val);
        if (Number.isNaN(ts)) return false;
        return ts <= Date.now() + 5 * 60 * 1000;
      },
      { message: "Waktu pengeluaran tidak valid atau berada di masa depan" }
    ),
  note: z
    .string()
    .trim()
    .max(300, "Catatan pengeluaran maksimal 300 karakter")
    .optional(),
  evidenceAssetId: z.string().trim().optional(),
  clientExpenseId: z.string().trim().min(8).max(128).optional(),
});

export type RecordExpenseRequest = z.infer<typeof recordExpenseRequestSchema>;
