import Link from "next/link";

export default function AdminMangaListPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Admin — Manga Series</h1>
          <Link href="/admin" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Admin
          </Link>
        </div>
      </header>

      <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #27272a", color: "#a1a1aa" }}>
              <th style={{ padding: "10px" }}>ID</th>
              <th style={{ padding: "10px" }}>Title</th>
              <th style={{ padding: "10px" }}>Status</th>
              <th style={{ padding: "10px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #1f1f23" }}>
              <td style={{ padding: "12px 10px", fontFamily: "monospace" }}>manga-sample</td>
              <td style={{ padding: "12px 10px" }}>The Licensed Adventure</td>
              <td style={{ padding: "12px 10px" }}>
                <span style={{ backgroundColor: "#064e3b", color: "#34d399", padding: "2px 8px", borderRadius: "10px", fontSize: "12px" }}>
                  PUBLISHED
                </span>
              </td>
              <td style={{ padding: "12px 10px" }}>
                <Link href="/admin/manga/manga-sample/chapters" style={{ color: "#f43f5e", textDecoration: "none" }}>
                  Chapters →
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
