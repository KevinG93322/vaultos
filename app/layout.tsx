import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans } from "next/font/google";

import { ConsoleShell } from "@/components/console/ConsoleShell";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-sans",
});

export const metadata: Metadata = {
  title: "VaultOS Console",
  description:
    "Technical demonstration of the VaultOS registry for Base Sepolia. Wallet transactions, deposits, and balances are not available in this console.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}
