"use server";

import { revalidatePath } from "next/cache";
import { createAuthPort } from "@/server/auth/port";
import { recordTransaction, type RecordTransactionResult } from "@/features/sales";
import { recordExpense, type RecordExpenseResult } from "@/features/expenses";
import { getDashboardReadModel, type DashboardReadModel } from "@/features/hq";

export interface SubmitTransactionActionInput {
  outletId: string;
  amount: number;
  paymentMethod?: "CASH" | "QRIS_STATIC" | "QRIS_DYNAMIC" | "BANK_TRANSFER" | "EWALLET" | "OTHER_DIGITAL";
  occurredAt?: string;
  note?: string;
  clientTransactionId: string;
}

export type SubmitTransactionActionResult =
  | {
      ok: true;
      transaction: RecordTransactionResult;
      dashboard: DashboardReadModel;
      replayed: boolean;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[] | undefined>;
      };
    };

export async function submitTransactionAction(
  input: SubmitTransactionActionInput
): Promise<SubmitTransactionActionResult> {
  try {
    const authPort = createAuthPort();
    const session = await authPort.resolveSession();
    if (!session) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sesi tidak terautentikasi. Silakan masuk kembali.",
        },
      };
    }

    const transaction = await recordTransaction(session, input, {
      idempotencyKey: input.clientTransactionId,
    });

    revalidatePath("/hq");
    revalidatePath("/");

    const dashboard = await getDashboardReadModel(session);

    return {
      ok: true,
      transaction,
      dashboard,
      replayed: transaction.replayed,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: {
        code: e.code || "INTERNAL",
        message: e.message || "Gagal menyimpan transaksi. Silakan coba lagi.",
        fieldErrors: e.details?.fieldErrors,
      },
    };
  }
}

export interface SubmitExpenseActionInput {
  outletId: string;
  categoryCode:
    | "TRANSPORT"
    | "PARKING"
    | "CLEANING"
    | "CONSUMABLE"
    | "REPAIR_MINOR"
    | "UNVERIFIED_FIELD_EXPENSE"
    | "OTHER_OPERATIONAL";
  amount: number;
  description: string;
  paidFrom?: "CASH_BOX" | "PERSONAL";
  incurredAt?: string;
  note?: string;
  clientExpenseId: string;
}

export type SubmitExpenseActionResult =
  | {
      ok: true;
      expense: RecordExpenseResult;
      dashboard: DashboardReadModel;
      replayed: boolean;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[] | undefined>;
      };
    };

export async function submitExpenseAction(
  input: SubmitExpenseActionInput
): Promise<SubmitExpenseActionResult> {
  try {
    const authPort = createAuthPort();
    const session = await authPort.resolveSession();
    if (!session) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sesi tidak terautentikasi. Silakan masuk kembali.",
        },
      };
    }

    const expense = await recordExpense(session, input, {
      idempotencyKey: input.clientExpenseId,
    });

    revalidatePath("/hq");
    revalidatePath("/hq/expenses");
    revalidatePath("/expenses");
    revalidatePath("/");

    const dashboard = await getDashboardReadModel(session);

    return {
      ok: true,
      expense,
      dashboard,
      replayed: expense.replayed,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: {
        code: e.code || "INTERNAL",
        message: e.message || "Gagal menyimpan pengeluaran. Silakan coba lagi.",
        fieldErrors: e.details?.fieldErrors,
      },
    };
  }
}

export async function refreshDashboardReadModelAction(): Promise<DashboardReadModel | null> {
  const authPort = createAuthPort();
  const session = await authPort.resolveSession();
  if (!session) return null;
  return getDashboardReadModel(session);
}
