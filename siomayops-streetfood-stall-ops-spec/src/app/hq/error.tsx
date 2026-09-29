"use client";

/**
 * `/hq` error boundary.
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`. When the dashboard cannot be
 * rendered, the boundary shows a dashboard-level error state with a retry — it never falls back to
 * the previous numbers (there is no stale-data fallback anywhere in this flow).
 *
 * The raw error object is deliberately not rendered: only the framework digest, which is a
 * correlation hash and not a stack trace, path or secret.
 */

import { useEffect } from "react";

export default function HqError({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  useEffect(() => {
    // Server logs carry the detail; the browser console records that the boundary fired.
    console.error("HQ dashboard failed to render", error.digest ?? "");
  }, [error]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, minHeight: "100vh", background: "#f9fafb" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Data operasional tidak dapat dimuat.</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4b5563" }}>
        Dashboard tidak dapat membaca data tersimpan. Angka lama sengaja tidak ditampilkan agar tidak menyesatkan.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 16,
          padding: "10px 16px",
          background: "#0f766e",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Coba Lagi
      </button>
      {error.digest ? (
        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#9ca3af" }}>Kode kesalahan: {error.digest}</p>
      ) : null}
      <p style={{ margin: "16px 0 0", fontSize: 13 }}>
        <a href="/" style={{ color: "#0f766e", fontWeight: 600 }}>← Kembali ke Beranda</a>
      </p>
    </main>
  );
}
