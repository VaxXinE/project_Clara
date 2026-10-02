import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import localFont from "next/font/local";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

config.autoAddCss = false;

// Font di-host sendiri (subset latin) supaya tampilan sama di semua perangkat dan build tidak
// bergantung pada jaringan. Manrope dipilih karena angka dan huruf kecilnya terbaca jelas di
// ukuran kecil pada tabel dan kartu yang padat.
const manrope = localFont({
  src: [{ path: "./fonts/manrope-latin.woff2", weight: "400 800", style: "normal" }],
  variable: "--font-manrope",
  display: "swap",
  fallback: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Clara",
  description:
    "Workspace operasional Clara untuk membalas chat, mengelola lead, tindak lanjut, review balasan AI, dan memantau tim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className={`${manrope.variable} h-full antialiased`}>
      <body
        suppressHydrationWarning
        className="theme-black-gold min-h-full flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
