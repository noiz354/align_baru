/**
 * Loading and error state tests (Steps 10 and 12 of the dashboard integration brief).
 *
 * The loading state must not display a figure, and the error states must be actionable without
 * exposing internals. `error.tsx` is a client component, but the parts that matter here — the copy
 * and the retry affordance — render on the server too, so a static render is a fair check.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HqLoading from "@/app/hq/loading";
import HqError from "@/app/hq/error";
import { DashboardProblem } from "@/app/hq/_ui/problem-state";

function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

describe("HQ dashboard loading state", () => {
  it("renders a dashboard-shaped skeleton and no operational figure", () => {
    const text = visibleText(renderToStaticMarkup(<HqLoading />));
    expect(text).toContain("Memuat data operasional dari server");
    // No money, no counts presented as data.
    expect(text).not.toMatch(/Rp\s?\d/);
    expect(text).not.toMatch(/Penjualan Hari Ini|Transaksi|Outlet Aktif/);
  });

  it("announces itself to assistive technology", () => {
    const html = renderToStaticMarkup(<HqLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("HQ dashboard error state", () => {
  it("renders the dashboard-level error copy with a retry and no internal detail", () => {
    const text = visibleText(renderToStaticMarkup(<HqError error={new Error("ECONNREFUSED 10.0.0.5:5432 data/db.json")} reset={() => {}} />));
    expect(text).toContain("Data operasional tidak dapat dimuat.");
    expect(text).toContain("Coba Lagi");
    expect(text).toContain("Angka lama sengaja tidak ditampilkan");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("data/db.json");
    expect(text).not.toMatch(/at .*\.tsx?:\d+/);
  });

  it("shows only the correlation digest, never a stack trace", () => {
    const text = visibleText(renderToStaticMarkup(<HqError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={() => {}} />));
    expect(text).toContain("Kode kesalahan: abc123");
    expect(text).not.toContain("boom");
  });
});

describe("boundary problem states", () => {
  it("gives UNAVAILABLE a retry on the same URL and a correlation id", () => {
    const text = visibleText(
      renderToStaticMarkup(<DashboardProblem kind="UNAVAILABLE" retryHref="/hq?date=2026-09-29" requestId="req-42" />),
    );
    expect(text).toContain("Data operasional tidak dapat dimuat.");
    expect(text).toContain("Coba Lagi");
    expect(text).toContain("Kode permintaan: req-42");
    const html = renderToStaticMarkup(<DashboardProblem kind="UNAVAILABLE" retryHref="/hq?date=2026-09-29" requestId="req-42" />);
    expect(html).toContain('href="/hq?date=2026-09-29"');
  });

  it("tells an unauthenticated viewer to sign in through the existing flow", () => {
    const html = renderToStaticMarkup(<DashboardProblem kind="UNAUTHENTICATED" retryHref="/hq" requestId="req-1" />);
    const text = visibleText(html);
    expect(text).toContain("Tidak ada sesi aktif.");
    expect(html).toContain('href="/"');
  });

  it("explains a forbidden role without implying retrying will help", () => {
    const text = visibleText(renderToStaticMarkup(<DashboardProblem kind="FORBIDDEN" retryHref="/hq" requestId="req-2" />));
    expect(text).toContain("tidak dapat membaca dashboard ini");
    expect(text).toContain("hq:view");
    expect(text).not.toContain("Coba Lagi");
  });

  it("offers a scope-safe reset when the filter is not recognized", () => {
    const html = renderToStaticMarkup(
      <DashboardProblem kind="INVALID_FILTER" retryHref="/hq?date=2026-09-29" retryLabel="Tampilkan Semua Outlet" requestId="req-3" />,
    );
    expect(visibleText(html)).toContain("Filter tidak dikenali.");
    expect(visibleText(html)).toContain("Tampilkan Semua Outlet");
    expect(html).toContain('href="/hq?date=2026-09-29"');
  });
});
