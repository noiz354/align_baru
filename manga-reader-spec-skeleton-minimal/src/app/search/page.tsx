import Link from "next/link";

export default function SearchPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Search Manga</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <input
          type="search"
          placeholder="Search by title, author, or genre..."
          style={{
            width: "100%",
            padding: "12px 16px",
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "15px",
            marginBottom: "24px",
          }}
        />

        <div style={{ color: "#71717a", textAlign: "center", fontSize: "14px", marginTop: "40px" }}>
          Type a query above to search the catalog.
        </div>
      </div>
    </div>
  );
}
