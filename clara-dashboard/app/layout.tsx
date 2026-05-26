import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: "SGB Sales Command Center",
  description:
    "Workspace operasional SGB untuk execution queue, lead management, audit trail, dan oversight tim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body
        suppressHydrationWarning
        className="theme-black-gold min-h-full flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
