import Link from "next/link";

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <header style={{ textAlign: "center", maxWidth: "600px" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "12px", color: "#f43f5e" }}>
          Licensed Manga Reader
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "24px" }}>
          Minimal clean implementation conforming to reader spec (FR-READER-001..014, ADR-007, T-READER-001..031).
          Supports RTL/LTR, Single/Double/Vertical modes, bounded window caching, keyboard controls, and accessible navigation.
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <Link
            href="/manga/sample-manga/chapter/1"
            style={{
              backgroundColor: "#e11d48",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Open Reader (Chapter 1) →
          </Link>
          <Link
            href="/discover"
            style={{
              backgroundColor: "#27272a",
              color: "#e4e4e7",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 500,
              display: "inline-block",
            }}
          >
            Discover
          </Link>
        </div>
      </header>

      <section
        style={{
          marginTop: "48px",
          padding: "20px",
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "8px",
          maxWidth: "520px",
          width: "100%",
          fontSize: "14px",
          color: "#d4d4d8",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px", color: "#fafafa" }}>
          Reader Controls & Shortcuts
        </h3>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.8, margin: 0, color: "#a1a1aa" }}>
          <li><strong style={{ color: "#fafafa" }}>Arrow Left / Right:</strong> Turn pages (RTL/LTR aware)</li>
          <li><strong style={{ color: "#fafafa" }}>M:</strong> Cycle mode (Single / Double / Vertical)</li>
          <li><strong style={{ color: "#fafafa" }}>D:</strong> Toggle reading direction (RTL / LTR)</li>
          <li><strong style={{ color: "#fafafa" }}>H:</strong> Toggle controls overlay (chrome)</li>
          <li><strong style={{ color: "#fafafa" }}>Tap sides:</strong> Navigate (25% left / 25% right)</li>
        </ul>
      </section>
    </div>
  );
}
