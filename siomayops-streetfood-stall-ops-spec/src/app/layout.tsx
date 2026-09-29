import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SiomayOps | Operasional Hari Ini",
  description: "Dashboard operasional seluruh outlet SiomayOps.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f7f8f6" />
      </head>
      <body>{children}</body>
    </html>
  );
}
