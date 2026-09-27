"use client";

export default function HQExpensesPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Review Pengeluaran</h1>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Antrian pengeluaran lapangan dengan kategori netral. Reviewer ≠ submitter.</p>
      <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 8 }}>ID</th>
              <th style={{ padding: 8 }}>Shift</th>
              <th style={{ padding: 8 }}>Kategori</th>
              <th style={{ padding: 8 }}>Jumlah</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 8 }}>EXP-001</td>
              <td style={{ padding: 8 }}>SH-001</td>
              <td style={{ padding: 8 }}>UNVERIFIED_FIELD_EXPENSE</td>
              <td style={{ padding: 8 }}>Rp 50.000</td>
              <td style={{ padding: 8 }}><span style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>REVIEW_REQUIRED</span></td>
              <td style={{ padding: 8 }}><button style={{ fontSize: 12, padding: "4px 8px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6 }}>Review</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <a href="/hq" style={{ display: "inline-block", marginTop: 16, fontSize: 14, color: "#0f766e" }}>← Kembali ke Dashboard</a>
    </main>
  );
}
