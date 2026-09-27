import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: "32px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ marginBottom: "32px", borderBottom: "1px solid #27272a", paddingBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Admin Portal</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
        <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "20px" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Catalog Management</h3>
          <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px" }}>
            Manage authorized series, volumes, and metadata.
          </p>
          <Link href="/admin/manga" style={{ color: "#f43f5e", textDecoration: "none", fontSize: "14px" }}>
            Manage Manga →
          </Link>
        </div>

        <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "20px" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Upload Pipeline</h3>
          <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px" }}>
            Quarantined chapter intake, validation, and publication.
          </p>
          <Link href="/admin/uploads" style={{ color: "#f43f5e", textDecoration: "none", fontSize: "14px" }}>
            View Uploads →
          </Link>
        </div>
      </div>
    </div>
  );
}
