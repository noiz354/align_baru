import { describe, expect, it } from "vitest";
import { alertHref, buildQuery, chartGeometry, compactRupiah, formatBps, formatClock, formatLongDay, niceCeiling, presentAlert, rupiah } from "../../src/app/_dashboard/format";

describe("dashboard presentation helpers", () => {
  it("formats integer rupiah in Indonesian grouping without touching the value", () => {
    expect(rupiah(8450000)).toBe("Rp 8.450.000");
    expect(rupiah(0)).toBe("Rp 0");
    expect(compactRupiah(8450000)).toBe("Rp 8,45 jt");
    expect(compactRupiah(750000)).toBe("Rp 750 rb");
    expect(formatBps(1510)).toBe("15,1%");
  });

  it("renders instants in Asia/Jakarta and business days as stable calendar dates", () => {
    expect(formatClock("2026-09-29T00:12:00.000Z")).toBe("07:12");
    expect(formatClock(null)).toBe("—");
    expect(formatClock("not-a-date")).toBe("—");
    expect(formatLongDay("2026-09-29")).toContain("29 September 2026");
  });

  it("scales the sales chart from real values and never fabricates a trend for an empty day", () => {
    const empty = chartGeometry([{ label: "06:00", cumulativeMinor: 0 }, { label: "08:00", cumulativeMinor: 0 }]);
    expect(empty.points.every((point) => point.y === 145)).toBe(true);
    expect(empty.yLabels.at(-1)).toBe("Rp 0");
    const real = chartGeometry([{ label: "06:00", cumulativeMinor: 0 }, { label: "08:00", cumulativeMinor: 300000 }, { label: "10:00", cumulativeMinor: 900000 }]);
    expect(real.max).toBe(1_000_000);
    expect(real.points.map((point) => point.x)).toEqual([0, 350, 700]);
    expect(real.points[2]!.y).toBeLessThan(real.points[1]!.y);
    expect(niceCeiling(8450000)).toBe(10_000_000);
  });

  it("maps structured alert kinds to Indonesian presentation and only links to routes that exist", () => {
    expect(presentAlert({ kind: "SHIFT_LOCATION_MISSING", severity: "WARNING" }).tag).toBe("Tanpa Lokasi");
    expect(presentAlert({ kind: "INCIDENT", severity: "CRITICAL" }).tone).toBe("red");
    expect(alertHref({ href: "/hq/records/expense/x", outletId: "o1" }, "2026-09-29")).toBe("/hq/outlets/o1?date=2026-09-29");
    expect(alertHref({ href: "/hq/incidents?incidentId=i", outletId: null }, "2026-09-29")).toBe("/hq/incidents?incidentId=i");
    expect(alertHref({ href: "/hq/records/expense/x", outletId: null }, "2026-09-29")).toBeNull();
  });

  it("builds filter query strings that omit empty values", () => {
    expect(buildQuery({ date: "2026-09-29", outletId: null })).toBe("?date=2026-09-29");
    expect(buildQuery({ date: undefined, outletId: "" })).toBe("");
  });
});
