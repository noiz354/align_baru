import type { ReactNode } from "react";

export const metadata = {
  title: "SiomayOps",
  description: "Siomay street-food stall operations - field-first POS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f766e" />
      </head>
      <body style={{ margin: 0, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", background: "#f9fafb", color: "#111827" }}>
        {children}
      </body>
    </html>
  );
}
