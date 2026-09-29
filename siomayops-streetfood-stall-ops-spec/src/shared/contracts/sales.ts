import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema } from "./common";

export const saleLineInputSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z.number().int().positive(),
  overridePriceId: uuidSchema.optional()
});

export const createSaleRequestSchema = z.object({
  shiftId: uuidSchema,
  locationReportId: uuidSchema.optional(),
  lines: z.array(saleLineInputSchema).min(1),
  clientSaleId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional(),
  customerReference: z.string().max(120).optional()
});
export type CreateSaleRequest = z.infer<typeof createSaleRequestSchema>;

export const saleResponseSchema = z.object({
  saleId: uuidSchema,
  status: z.enum(["DRAFT", "COMPLETED", "VOIDED", "CORRECTED"]),
  total: moneySchema,
  lines: z.array(z.object({
    menuItemId: uuidSchema,
    quantity: z.number().int(),
    unitPriceSnapshot: moneySchema,
    pricePolicyId: uuidSchema.optional(),
    lineTotal: moneySchema
  })),
  paymentId: uuidSchema.optional(),
  paymentState: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED", "PENDING_VERIFICATION"]).optional(),
  version: z.number().int()
});
export type SaleResponse = z.infer<typeof saleResponseSchema>;

export const voidSaleRequestSchema = z.object({ reason: z.string().min(3).max(300) });

export const MAX_TRANSACTION_AMOUNT_MINOR = 100_000_000; // Rp 100.000.000

export const supportedPaymentMethods = [
  "CASH",
  "QRIS_STATIC",
  "QRIS_DYNAMIC",
  "BANK_TRANSFER",
  "EWALLET",
  "OTHER_DIGITAL",
] as const;

export const recordTransactionRequestSchema = z.object({
  outletId: z.string().trim().min(1, "Outlet wajib dipilih"),
  amount: z
    .number({
      required_error: "Nominal transaksi wajib diisi",
      invalid_type_error: "Nominal transaksi harus berupa angka",
    })
    .finite("Nominal transaksi harus berupa angka valid")
    .int("Nominal transaksi harus bilangan bulat Rupiah (tanpa desimal)")
    .positive("Nominal transaksi harus lebih dari Rp 0")
    .max(MAX_TRANSACTION_AMOUNT_MINOR, "Nominal transaksi melebihi batas maksimum Rp 100.000.000"),
  paymentMethod: z
    .enum(supportedPaymentMethods, {
      errorMap: () => ({ message: "Metode pembayaran tidak didukung" }),
    })
    .default("CASH"),
  occurredAt: z.string().trim().optional(),
  note: z.string().trim().max(300, "Catatan maksimal 300 karakter").optional(),
  clientTransactionId: z.string().trim().min(8, "ID transaksi klien minimal 8 karakter").max(128).optional(),
});
export type RecordTransactionRequest = z.infer<typeof recordTransactionRequestSchema>;
