import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingsAccessPage from "../../src/app/settings/page";

describe("settings and access availability boundary", () => {
  it("explains that account, access, and persisted settings are unavailable", () => {
    const html = renderToStaticMarkup(<SettingsAccessPage />);

    expect(html).toContain("Pengaturan, pengguna &amp; akses");
    expect(html).toContain("Pengelolaan akun dan akses belum tersedia");
    expect(html).toContain("sumber akun dan pengaturan persisten");
    expect(html).toContain("Layanan autentikasi produksi belum tersedia");
  });

  it("does not expose profile data, settings, or access mutation controls", () => {
    const html = renderToStaticMarkup(<SettingsAccessPage />);

    expect(html).not.toMatch(/<(form|input|select|option|button)\b/i);
    expect(html).not.toMatch(/name=["'](role|permission|outlet|organization|threshold)/i);
    expect(html).not.toContain("FAKE_AUTH_ROLE");
    expect(html).not.toContain("cashToleranceMinor");
  });
});
