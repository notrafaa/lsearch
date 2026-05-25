import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LSearch",
  description: "Console OSINT avec filtrage de donnees sensibles"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
