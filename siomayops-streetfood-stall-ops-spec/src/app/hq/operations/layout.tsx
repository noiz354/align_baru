import type { ReactNode } from "react";
import { HQShell } from "@/shared/ui/hq-shell/HQShell";

export const metadata = {
  title: "Operasional · SiomayOps HQ",
};

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <HQShell active="operations" crumbs={["Operasional", "Peta Live"]}>
      {children}
    </HQShell>
  );
}
