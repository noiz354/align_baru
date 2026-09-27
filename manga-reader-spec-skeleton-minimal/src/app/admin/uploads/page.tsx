import Link from "next/link";

export default function AdminUploadsPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Admin — Upload Pipeline</h1>
          <Link href="/admin" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Admin
          </Link>
        </div>
      </header>

      <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "20px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Ingestion Gate (T-UPLOAD-014)</h3>
        <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: 1.6 }}>
          All archive ingestion enforces quarantine, MIME and dimensions checks, and immutable asset keys.
          Works are published only after integrity checks and explicit approval.
        </p>

        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#27272a", borderRadius: "4px" }}>
          <span style={{ fontSize: "13px", color: "#a1a1aa" }}>Pipeline Status: </span>
          <span style={{ color: "#34d399", fontWeight: 600, fontSize: "13px" }}>IDLE / READY</span>
        </div>
      </div>
    </div>
  );
}
