import { createAuthPort } from "@/server/auth/port";
import { getDashboardReadModel } from "@/features/hq";
import { HQDashboardClient } from "./HQDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HQDashboardPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function HQDashboardPage({ searchParams }: HQDashboardPageProps) {
  const authPort = createAuthPort();
  const session = await authPort.resolveSession();
  if (!session) {
    return (
      <main style={{ maxWidth: 640, margin: "40px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Akses Ditolak</h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>Sesi tidak terautentikasi.</p>
      </main>
    );
  }

  const readModel = await getDashboardReadModel(session);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const autoOpenModal = resolvedParams?.action === "catat-transaksi";
  const autoOpenExpenseModal = resolvedParams?.action === "catat-pengeluaran";

  return (
    <HQDashboardClient
      initialData={readModel}
      autoOpenModal={autoOpenModal}
      autoOpenExpenseModal={autoOpenExpenseModal}
    />
  );
}
