import Link from "next/link";

export default function HistoryPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Reading History</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "20px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #27272a", color: "#a1a1aa" }}>
              <th style={{ padding: "10px" }}>Series</th>
              <th style={{ padding: "10px" }}>Chapter</th>
              <th style={{ padding: "10px" }}>Last Read</th>
              <th style={{ padding: "10px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #1f1f23" }}>
              <td style={{ padding: "12px 10px" }}>The Licensed Adventure</td>
              <td style={{ padding: "12px 10px" }}>Chapter 1</td>
              <td style={{ padding: "12px 10px", color: "#a1a1aa" }}>Just now</td>
              <td style={{ padding: "12px 10px" }}>
                <Link
                  href="/manga/sample-manga/chapter/1"
                  style={{ color: "#f43f5e", textDecoration: "none", fontWeight: "500" }}
                >
                  Continue
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
