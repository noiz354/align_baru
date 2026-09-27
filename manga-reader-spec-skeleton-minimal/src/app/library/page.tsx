import Link from "next/link";

export default function LibraryPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Your Library</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "24px" }}>
        <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>Continue Reading</h3>
        <p style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "16px" }}>
          The Licensed Adventure — Chapter 1
        </p>
        <Link
          href="/manga/sample-manga/chapter/1"
          style={{
            backgroundColor: "#e11d48",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Resume Reading →
        </Link>
      </div>
    </div>
  );
}
