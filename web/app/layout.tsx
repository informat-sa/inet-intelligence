import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I-NET Intelligence | Informat ERP",
  description: "Consulta tu ERP en lenguaje natural. Powered by Claude AI.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
