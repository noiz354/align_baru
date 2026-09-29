/**
 * Presentation-layer tests (Step 22 of the dashboard integration brief).
 *
 * Two concerns live here:
 *  1. `_lib/copy.ts` and `_lib/format.ts` — the mapping from structured codes to Indonesian copy,
 *     including the unknown-code paths that must degrade instead of crashing;
 *  2. the outlet table's client-only filters — presentational narrowing of an already authorized
 *     list, which is never an authorization decision.
 *
 * The filter helper and the outlet row are hook-free on purpose, so they can be exercised here the
 * same way the Server Component renders them.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  activityPhrase,
  activitySubjectLabel,
  alertDetail,
  alertTitle,
  EMPTY_ACTIVITY_MESSAGE,
  exceptionTitle,
  outletStatusLabel,
} from "@/app/hq/_lib/copy";
import { formatBusinessDay, formatCount, formatHours, formatJakartaTime, formatPercent } from "@/app/hq/_lib/format";
import { filterOutlets, OutletRow, OutletTableHeader } from "@/app/hq/_ui/outlet-table-parts";
import type { DashboardAlert, DashboardOutlet } from "@/features/hq/dashboard-read-model";
import { money } from "@/shared/money/money";

function outlet(overrides: Partial<DashboardOutlet> = {}): DashboardOutlet {
  return {
    outletId: "stall-1",
    code: "ST-001",
    operatorName: "Budi",
    shiftStartedAt: "2026-09-29T06:10:00.000Z",
    status: "OPEN",
    sales: money(35000, "IDR"),
    expenses: money(0, "IDR"),
    ...overrides,
  };
}

function alert(overrides: Partial<DashboardAlert> = {}): DashboardAlert {
  return {
    id: "alert-1",
    type: "OUTLET_NOT_STARTED",
    severity: "ATTENTION",
    subjectKind: "STALL",
    subjectId: "stall-2",
    outletId: "stall-2",
    occurredAt: null,
    context: {},
    source: "RULE",
    ...overrides,
  };
}

describe("alert copy mapping", () => {
  it("maps every modelled alert type to Indonesian copy", () => {
    expect(alertTitle("OUTLET_NOT_STARTED")).toBe("Belum memulai operasional");
    expect(alertTitle("UNVERIFIED_DIGITAL_PAYMENT")).toBe("Pembayaran digital belum diverifikasi");
    expect(alertTitle("CASH_VARIANCE_BEYOND_TOLERANCE")).toBe("Selisih kas melebihi toleransi");
    expect(alertTitle("STOCK_OUT")).toBe("Stok habis");
  });

  it("degrades safely for an unmodelled alert type instead of showing a raw code", () => {
    expect(alertTitle("UNCLASSIFIED")).toBe("Peringatan tercatat");
    const title = alertTitle("SOMETHING_NEW" as DashboardAlert["type"]);
    expect(title).toBe("Peringatan tercatat");
    expect(title).not.toContain("SOMETHING_NEW");
  });

  it("describes an alert with its context figures, never with a cause or a person", () => {
    const detail = alertDetail(
      alert({
        type: "UNVERIFIED_DIGITAL_PAYMENT",
        context: { amountMinor: 18000, ageHours: 2.5 },
        occurredAt: "2026-09-29T06:26:00.000Z",
      }),
    );
    // Intl inserts U+00A0 between "Rp" and the amount.
    expect(detail.replace(/\u00a0/g, " ")).toContain("Rp 18.000");
    expect(detail).toContain("usia 2,5 jam");
    expect(detail).toContain("sejak 13:26");
    expect(detail).not.toMatch(/hilang|curang|mencuri/i);
  });

  it("shows the persisted alert type for an unclassified record so the operator can act", () => {
    const detail = alertDetail(alert({ type: "UNCLASSIFIED", source: "PERSISTED", sourceType: "EXPIRY_WARNING" }));
    expect(detail).toContain("EXPIRY_WARNING");
  });
});

describe("activity copy mapping", () => {
  it("maps known audit actions to Indonesian phrases", () => {
    expect(activityPhrase("sale.created")).toBe("mencatat penjualan");
    expect(activityPhrase("shift.closed")).toBe("menutup shift");
    expect(activityPhrase("expense.submitted")).toBe("mencatat pengeluaran");
  });

  it("uses a neutral phrase for an unknown action", () => {
    expect(activityPhrase("future.event.v2")).toBe("mencatat aktivitas operasional");
    expect(activitySubjectLabel("future_kind")).toBe("Catatan");
    expect(activitySubjectLabel("shift")).toBe("Shift");
    expect(EMPTY_ACTIVITY_MESSAGE).toContain("Belum ada aktivitas");
  });
});

describe("formatting helpers", () => {
  it("renders Jakarta time and the established dash for a missing instant", () => {
    expect(formatJakartaTime("2026-09-29T06:10:00.000Z")).toBe("13:10");
    expect(formatJakartaTime(null)).toBe("—");
    expect(formatJakartaTime("not-a-date")).toBe("—");
  });

  it("renders the business day in Indonesian and the dash-free ratio", () => {
    expect(formatBusinessDay("2026-09-29")).toBe("29 September 2026");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(71)).toBe("71%");
    expect(formatCount(1234)).toBe("1.234");
    expect(formatHours(0.5)).toBe("30 menit");
    expect(formatHours(2.5)).toContain("jam");
  });

  it("maps outlet statuses to Indonesian labels", () => {
    expect(outletStatusLabel("NOT_STARTED")).toBe("Belum mulai");
    expect(outletStatusLabel("OPEN")).toBe("Buka");
    expect(outletStatusLabel("CLOSING_SUBMITTED")).toBe("Tutup terkirim");
  });
});

describe("outlet table presentation", () => {
  const rows: readonly DashboardOutlet[] = [
    outlet({ outletId: "stall-1", code: "ST-001", operatorName: "Budi", status: "OPEN" }),
    outlet({ outletId: "stall-2", code: "ST-002", operatorName: null, status: "NOT_STARTED", shiftStartedAt: null, sales: money(0, "IDR") }),
    outlet({ outletId: "stall-3", code: "ST-003", operatorName: "Sari", status: "CLOSED", sales: money(12000, "IDR") }),
  ];

  it("filters by search across code, operator and status label", () => {
    expect(filterOutlets(rows, { query: "st-002", status: "ALL" }).map((r) => r.code)).toEqual(["ST-002"]);
    expect(filterOutlets(rows, { query: "sari", status: "ALL" }).map((r) => r.code)).toEqual(["ST-003"]);
    expect(filterOutlets(rows, { query: "belum mulai", status: "ALL" }).map((r) => r.code)).toEqual(["ST-002"]);
    expect(filterOutlets(rows, { query: "  ", status: "ALL" })).toHaveLength(3);
  });

  it("filters by status", () => {
    expect(filterOutlets(rows, { query: "", status: "OPEN" }).map((r) => r.code)).toEqual(["ST-001"]);
    expect(filterOutlets(rows, { query: "", status: "NOT_STARTED" }).map((r) => r.code)).toEqual(["ST-002"]);
  });

  it("renders a row with the operator dash and formatted money when the values are absent", () => {
    const html = renderToStaticMarkup(
      <table>
        <OutletTableHeader />
        <tbody>
          <OutletRow outlet={rows[1]!} />
        </tbody>
      </table>,
    );
    const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/\s+/g, " ").trim();
    expect(text).toContain("ST-002 — — Rp 0 Rp 0 Belum mulai");
    expect(text).not.toContain("null");
  });
});
