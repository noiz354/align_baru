"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type StateKind = "unauthenticated" | "forbidden" | "invalid" | "not-found" | "error";

const COPY: Record<StateKind, { title: string; body: string; retry: boolean }> = {
  unauthenticated: { title: "Masuk diperlukan", body: "Sesi tidak ditemukan atau sudah berakhir. Masuk kembali untuk melihat data operasional.", retry: false },
  forbidden: { title: "Akses ditolak", body: "Akun Anda tidak memiliki izin untuk melihat dashboard operasional.", retry: false },
  invalid: { title: "Filter tidak valid", body: "Tanggal atau filter pada alamat halaman tidak dapat dipakai.", retry: false },
  "not-found": { title: "Outlet tidak ditemukan", body: "Outlet yang dipilih tidak tersedia dalam cakupan akun Anda.", retry: false },
  error: { title: "Data operasional tidak dapat dimuat.", body: "Terjadi kendala di server. Tidak ada data lama yang ditampilkan agar angka tidak menyesatkan.", retry: true },
};

export default function DashboardState({ kind }: { kind: StateKind }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = COPY[kind];
  return <main className="page-content dashboard-state" role="alert">
    <h1>{copy.title}</h1>
    <p>{copy.body}</p>
    <div className="heading-actions">
      {copy.retry && <button className="button button-primary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Memuat…" : "Coba Lagi"}</button>}
      {(kind === "invalid" || kind === "not-found") && <a className="button button-primary" href="/">Kembali ke semua outlet</a>}
    </div>
  </main>;
}
