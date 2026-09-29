import { describe, it, expect } from "vitest";
import { getOpsMapReadModel } from "@/features/hq/ops-map";
import { fmtRelative, fmtRupiah, fmtTime } from "@/app/hq/operations/map/_map/format";

describe("HQ ops-map read model (Peta Operasional)", () => {
  it("exposes every stall as an explicit operator position report (ADR-0007)", async () => {
    const { data } = await getOpsMapReadModel("org-demo");
    expect(data.stalls.length).toBeGreaterThan(0);
    for (const s of data.stalls) {
      expect(["OPERATOR_APP_GPS", "OPERATOR_APP_MANUAL", "HQ_RECORDED"]).toContain(s.position.source);
      expect(s.position.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["normal", "attention", "incident", "offline"]).toContain(s.state);
    }
  });

  it("keeps traffic sampling anonymous: counts only, no identity attributes", async () => {
    const { data } = await getOpsMapReadModel("org-demo");
    const forbidden = /face|identity|ethnic|gender|age|plate|name/i;
    for (const s of data.stalls) {
      if (!s.sample) continue;
      expect(Object.keys(s.sample).some((k) => forbidden.test(k))).toBe(false);
      expect(Number.isInteger(s.sample.observations)).toBe(true);
      expect(s.sample.anonymised).toBe(true);
      expect(s.sample.thumbnailUrl).toMatch(/^\/hq\/samples\//);
    }
  });

  it("uses neutral wording for security incidents (no accusatory labels)", async () => {
    const { data } = await getOpsMapReadModel("org-demo");
    const accusatory = /preman|kriminal|pelaku|penjahat/i;
    for (const s of data.stalls) {
      const latest = s.security?.latest;
      if (!latest) continue;
      expect(accusatory.test(latest.categoryLabel)).toBe(false);
      expect(latest.reviewStatusLabel).toBeTruthy();
    }
  });

  it("matches the Screen 02 reference values for Kuningan 02 and Tebet 01", async () => {
    const { data } = await getOpsMapReadModel("org-demo");
    const kng = data.stalls.find((s) => s.code === "Kuningan 02");
    const tbt = data.stalls.find((s) => s.code === "Tebet 01");
    expect(kng?.operator.fullName).toBe("Bayu Saputra");
    expect(kng?.sales && fmtRupiah(kng.sales.grossMinor)).toBe("Rp 1.310.000");
    expect(kng?.sales?.transactions).toBe(31);
    expect(kng?.sales && fmtTime(kng.sales.operatingSince)).toBe("07:05");
    expect(fmtRelative(kng!.position.reportedAt, data.asOf)).toBe("22 detik lalu");
    expect(kng?.suitability?.overall).toBe(62);
    expect(kng?.suitability?.statusLabel).toBe("Pertimbangkan Relokasi");
    expect(kng?.security?.openCount).toBe(1);
    expect(kng?.security?.latest?.amountRecordedMinor).toBe(50_000);
    expect(tbt?.sales && fmtRupiah(tbt.sales.grossMinor)).toBe("Rp 1.185.000");
    expect(tbt?.traffic?.label).toBe("Ramai");
    expect(tbt?.site?.weatherLabel).toBe("Kering");
  });
});
