import { MajelisHubDashboard } from "./majelishub-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Dasbor — MajelisHub Demo</h1>
      <p style={{ color: "#666" }}>Organization → Masjid → Kajian vertical (Jakarta vs Bandung, RLS, audit, permission)</p>
      <MajelisHubDashboard />
    </div>
  );
}
