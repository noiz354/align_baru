/**
 * Dashboard-level problem states.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. Every message is written to be
 * true without a stack trace, a file path, a database location or a secret, and none of these
 * states renders a stale figure — a dashboard that cannot read its data shows no numbers at all.
 */

import type { DashboardFailureKind } from "@/server/dashboard/boundary";

export interface DashboardProblemProps {
  readonly kind: DashboardFailureKind;
  /** Same-URL retry target (for `INVALID_FILTER`, a scope-safe reset target). */
  readonly retryHref: string;
  readonly retryLabel?: string;
  readonly requestId: string;
}

interface Copy {
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string;
  readonly actionHref: string;
}

function copyFor(kind: DashboardFailureKind, retryHref: string, retryLabel?: string): Copy {
  switch (kind) {
    case "UNAUTHENTICATED":
      return {
        title: "Tidak ada sesi aktif.",
        body: "Dashboard HQ memerlukan sesi yang terautentikasi. Masuk kembali melalui alur yang berlaku, lalu buka dashboard ini lagi.",
        actionLabel: "Kembali ke Beranda",
        actionHref: "/",
      };
    case "FORBIDDEN":
      return {
        title: "Peran Anda tidak dapat membaca dashboard ini.",
        body: "Dashboard HQ memerlukan izin hq:view pada organisasi Anda. Hubungi pemilik organisasi bila akses ini dibutuhkan.",
        actionLabel: "Kembali ke Beranda",
        actionHref: "/",
      };
    case "INVALID_FILTER":
      return {
        title: "Filter tidak dikenali.",
        body: "Tanggal atau outlet yang dipilih tidak ada di dalam scope Anda. Pilih Semua Outlet atau tanggal lain untuk melanjutkan.",
        actionLabel: retryLabel ?? "Tampilkan Semua Outlet",
        actionHref: retryHref,
      };
    default:
      return {
        title: "Data operasional tidak dapat dimuat.",
        body: "Data tersimpan belum bisa dibaca saat ini. Angka lama sengaja tidak ditampilkan agar tidak menyesatkan.",
        actionLabel: "Coba Lagi",
        actionHref: retryHref,
      };
  }
}

export function DashboardProblem({ kind, retryHref, retryLabel, requestId }: DashboardProblemProps) {
  const copy = copyFor(kind, retryHref, retryLabel);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, minHeight: "100vh", background: "#f9fafb" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{copy.title}</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4b5563" }}>{copy.body}</p>
      <p style={{ margin: "16px 0 0" }}>
        <a
          href={copy.actionHref}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            background: "#0f766e",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {copy.actionLabel}
        </a>
      </p>
      <p style={{ margin: "16px 0 0", fontSize: 11, color: "#9ca3af" }}>Kode permintaan: {requestId}</p>
    </main>
  );
}
