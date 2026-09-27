export default function VerificationPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1>Verifikasi Pembayaran</h1>
      <p>QRIS yang belum diverifikasi tetap PENDING_VERIFICATION, bukan pendapatan terverifikasi.</p>
      <p>Webhook hanya boleh dikirim oleh penyedia terdaftar dengan HMAC sah. Verifikasi manual memerlukan identitas Finance, alasan, dan bukti melalui API yang terlindungi — bukan lewat halaman publik ini.</p>
      <a href="/hq">Kembali ke Dashboard</a>
    </main>
  );
}
