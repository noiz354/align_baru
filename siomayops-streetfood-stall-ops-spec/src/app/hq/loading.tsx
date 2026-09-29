/**
 * `/hq` loading state.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. Server rendering means the
 * dashboard streams a skeleton in the shape of the real page — header, KPI tiles, chart and card
 * grid — rather than a full-screen spinner. No operational number is shown while loading, because
 * a placeholder that looks like a figure is exactly the failure mode this integration removes.
 */

const BLOCK = "#f3f4f6";

function Bar({ width, height = 12 }: { readonly width: number | string; readonly height?: number }) {
  return <div style={{ width, height, background: BLOCK, borderRadius: 6 }} />;
}

function CardSkeleton({ tall = false }: { readonly tall?: boolean }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", minHeight: tall ? 220 : 120 }}>
      <Bar width={120} />
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <Bar width="60%" />
        <Bar width="80%" />
        <Bar width="40%" />
      </div>
    </div>
  );
}

export default function HqLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      style={{ maxWidth: 1200, margin: "0 auto", padding: 16, background: "#f9fafb", minHeight: "100vh" }}
    >
      <style>{"@keyframes hq-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } } .hq-skeleton { animation: hq-pulse 1.4s ease-in-out infinite }"}</style>
      <div className="hq-skeleton">
        <header style={{ marginBottom: 16 }}>
          <Bar width={220} height={24} />
          <div style={{ marginTop: 8 }}>
            <Bar width={320} />
          </div>
        </header>

        <div style={{ padding: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <Bar width={280} height={28} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
              <Bar width={110} />
              <div style={{ marginTop: 12 }}>
                <Bar width={140} height={20} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          <CardSkeleton tall />
          <CardSkeleton tall />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>Memuat data operasional dari server…</p>
      </div>
    </main>
  );
}
